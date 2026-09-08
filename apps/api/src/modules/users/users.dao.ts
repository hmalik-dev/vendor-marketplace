import { and, eq, exists, isNull, sql, type SQL } from 'drizzle-orm';
import {
  legalAcceptances,
  users,
  vendorProfiles,
  type NewUserRow,
  type UserRow,
} from '@vendor-marketplace/db/schema';
import type { LegalAcceptanceDocument } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/** Live users only — a Clerk-deleted identity must not resolve to a session. */
const notDeleted = isNull(users.deletedAt);

/**
 * The row for a Clerk subject **including a retired one**.
 *
 * Almost nothing wants this — `findUserByClerkId` below hides a retired row on
 * purpose, and is what every caller should reach for. The two exceptions are
 * the acceptance gate and the acceptance itself, which have to tell "no account
 * yet" from "account erased": since #429 the absence of a row means "has not
 * accepted, send them to the interstitial", and a Clerk-deleted identity
 * offered that interstitial would try to bring its erased account back, where
 * `insertUserIfAbsent` finds the retired row under the same `clerk_user_id` and
 * answers `null` rather than reviving it. A retired identity keeps getting the
 * 401 it always got.
 */
export async function findUserByClerkIdIncludingRetired(
  db: AppDatabase,
  clerkUserId: string,
): Promise<UserRow | null> {
  if (!clerkUserId) {
    return null;
  }

  const rows = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);

  return rows?.[0] ?? null;
}

/**
 * The live row for a Clerk subject.
 *
 * Derived from the wide read rather than repeating it with one extra `where`
 * clause: two query builders differing only by `notDeleted` are two places for
 * the rule to be edited out of, and the rule is what stops a deleted identity
 * resolving to a session.
 */
export async function findUserByClerkId(
  db: AppDatabase,
  clerkUserId: string,
): Promise<UserRow | null> {
  const row = await findUserByClerkIdIncludingRetired(db, clerkUserId);

  return row?.deletedAt ? null : row;
}

/**
 * Everything the session gate needs, in **one** round trip: the row behind a
 * Clerk subject, and whether that account holds `version` of `document`.
 *
 * The acceptance check used to be a second query, and it ran on every
 * authenticated request — so against a hosted Postgres it was a whole extra
 * network round trip on the hot path, for a boolean. As a correlated `EXISTS`
 * it is evaluated for the single outer row and short-circuits on the first
 * match, which costs a fraction of a millisecond of planner work instead.
 *
 * Retired rows are included for the reason `findUserByClerkIdIncludingRetired`
 * gives: the gate has to answer "erased" differently from "not accepted yet".
 */
export async function findSessionSubject(
  db: AppDatabase,
  clerkUserId: string,
  document: LegalAcceptanceDocument,
  version: string,
): Promise<{ user: UserRow; holdsDocument: boolean } | null> {
  if (!clerkUserId) {
    return null;
  }

  const rows = await db
    .select({
      user: users,
      holdsDocument: sql<boolean>`${exists(
        db
          .select({ one: sql`1` })
          .from(legalAcceptances)
          .where(
            and(
              eq(legalAcceptances.acceptedByUserId, users.id),
              eq(legalAcceptances.document, document),
              eq(legalAcceptances.version, version),
            ),
          ),
      )}`,
    })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return rows?.[0] ?? null;
}

export async function findUserById(db: AppDatabase, id: string): Promise<UserRow | null> {
  if (!id) {
    return null;
  }

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), notDeleted))
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Inserts a user, tolerating the race between the Clerk webhook and the user's
 * own first API call. Returns the winning row either way.
 *
 * **The `DO NOTHING` names no target, and that is the whole point** (#442).
 * `users` carries two unique indexes — `users_clerk_user_id_key` and
 * `users_email_key` — and one identity signing in twice at once collides on
 * *both*, because the two inserts carry the same Clerk id and the same address.
 * A targeted `DO NOTHING` arbitrates only the index it names, so whenever
 * Postgres reached the email index first the loser raised a 23505 that the
 * acceptance endpoint answered as an opaque 500. Reproduced at roughly one run
 * in four by `legal-acceptance-race.contention.test.ts` before this line
 * changed; the unique index that ticket adds neither caused it nor fixed it.
 *
 * **Naming both keys is not available**, which is why the target is dropped
 * rather than widened: `ON CONFLICT (a, b)` names one arbiter *index* over
 * those columns, and there is no unique index on `(clerk_user_id, email)`. Nor
 * can the email violation be caught and retried — the first-sign-in caller runs
 * this inside `db.transaction`, and a raised 23505 aborts the whole transaction,
 * so every statement after it fails with 25P02. Not raising is the only shape
 * that works there.
 *
 * **Widening what is swallowed is not the same as swallowing it silently, and
 * the difference is the last read below.** A declined insert has exactly two
 * causes and they are not alike. If this Clerk id is already in the table the
 * conflict was this identity meeting itself — the race, or a retired row — and
 * `null` is the answer every caller already expects. If it is *not* in the
 * table, the arbiter was some other unique index, which means an address that
 * belongs to **somebody else**, and answering `null` there would report an
 * operator-actionable data problem as the ordinary "this identity has no
 * account yet". So it throws instead.
 *
 * **The message carries the Clerk id because the 23505 it replaces carried
 * more than a sentence.** `log-error-serializer.ts` strips a pg error's
 * value-bearing `detail` and deliberately keeps `code`, `constraint` and
 * `table` — what says *what to fix* — so the old failure named
 * `users_email_key` in the record. A bare `Error` carries none of that, and a
 * 500 saying only that some constraint declined some insert is quieter than
 * what it replaced, on the one path where knowing *whose* address collided is
 * the entire remedy. Bare rather than an `AppError` all the same: nothing about
 * it is the caller's to fix or the reader's to see, so it stays an opaque 500
 * and the identifier goes only to the log.
 *
 * **Two ways to reach it, and the second is not a fixture problem.** A *live*
 * account holding the address needs two Clerk identities sharing one address,
 * which Clerk refuses within an instance — so through the product that half is
 * unreachable, and the seeds are where it happens, which is why all three say
 * so where they explain that a fixture may not invent a Clerk id.
 *
 * A **retired** account holding it *was* the ordinary case and is no longer
 * reachable at all. #442 wrote that `retireUserWhere` writes only `deleted_at`
 * while `users_email_key` carried no predicate, so a closed account kept its
 * address in the index while Clerk freed it, and the same person signing up
 * again collided on that retained address and landed here — a 500 that had been
 * true since the row could first be retired. #442 named the repair as #451's
 * and outstanding; **#451 has since landed it.** `users_email_key` is now
 * `UNIQUE (email) WHERE deleted_at IS NULL`, so a retired row's address does
 * not participate, that insert **does not conflict**, and this function returns
 * the new row from `inserted[0]` without ever reaching the reads below.
 *
 * Which leaves the live-account case as the only way here, and it is the one
 * that genuinely wants an operator. That is why the throw stays: it is not
 * softened by the repair, it is *narrowed* to the case it was written for.
 */
export async function insertUserIfAbsent(
  db: AppDatabase,
  values: NewUserRow,
): Promise<UserRow | null> {
  const inserted = await db.insert(users).values(values).onConflictDoNothing().returning();

  if (inserted?.[0]) {
    return inserted[0];
  }

  /*
   * Retired rows included, deliberately: a Clerk-deleted identity signing in
   * again is the one case that must read as "no account" rather than as a
   * collision, and it is the reason this is not simply `findUserByClerkId`.
   */
  const held = await findUserByClerkIdIncludingRetired(db, values.clerkUserId);

  if (held) {
    return held.deletedAt ? null : held;
  }

  /*
   * Read back who holds the address before giving up, because "which row holds
   * this?" is the whole of the operator's question and neither the 23505 nor a
   * sentence answers it. Only on this path, which is the one that is about to
   * throw anyway.
   *
   * The address itself is not interpolated. It is the one value here that is
   * personal data rather than a pseudonymous identifier, the log is the wrong
   * place to copy it to, and it is already known to whoever is reading — they
   * arrived holding it. The holder's Clerk id and whether that account is
   * retired are what they do not have, and `retired` is the answer that says
   * this is closure-then-return rather than a genuine clash.
   */
  const holder = await findUserByEmailIncludingRetired(db, values.email);

  throw new Error(
    `users: the insert for ${values.clerkUserId} was declined — its address is held by ` +
      (holder
        ? `${holder.clerkUserId} (${holder.deletedAt ? 'retired' : 'live'})`
        : 'a row this read could not find'),
  );
}

/**
 * Who holds an address, retired accounts included — the diagnosis behind the
 * throw above, and deliberately not exported.
 *
 * Retired rows are the point rather than an inclusion: they are the ones
 * `users_email_key` keeps reserved and the ones a live-only read would report
 * as "nobody", which is the least useful answer available.
 */
async function findUserByEmailIncludingRetired(
  db: AppDatabase,
  email: string,
): Promise<UserRow | null> {
  if (!email) {
    return null;
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return rows?.[0] ?? null;
}

export async function updateUserById(
  db: AppDatabase,
  id: string,
  patch: Partial<NewUserRow>,
): Promise<UserRow | null> {
  if (!id || Object.keys(patch).length === 0) {
    return null;
  }

  const updated = await db
    .update(users)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(users.id, id), notDeleted))
    .returning();

  return updated?.[0] ?? null;
}

/** Mirrors a Clerk `user.updated` event onto the local row, if one exists. */
export async function updateUserByClerkId(
  db: AppDatabase,
  clerkUserId: string,
  patch: Partial<NewUserRow>,
): Promise<UserRow | null> {
  if (!clerkUserId || Object.keys(patch).length === 0) {
    return null;
  }

  const updated = await db
    .update(users)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(users.clerkUserId, clerkUserId), notDeleted))
    .returning();

  return updated?.[0] ?? null;
}

/**
 * Retires the local row for a deleted Clerk identity, **and the storefront it
 * owns** (#433). Bookings, reviews, and messages reference this user, so the row
 * stays for referential integrity.
 *
 * One transaction, because the two halves are one fact. This used to set
 * `deleted_at` and stop: `vendor_profiles.is_deleted` is the tombstone four
 * public reads check, nothing outside the seed scripts ever wrote it, and no
 * visibility predicate joined `users` — so a vendor who deleted their Clerk
 * identity kept a published, searchable, bookable profile, and a customer could
 * pay for a booking against an account that could never sign in to answer it.
 *
 * `is_published` comes down as well as `is_deleted`, not either: `is_deleted` is
 * the tombstone the reads already check, and leaving `is_published` true would
 * make any future un-delete republish the storefront silently.
 *
 * Returns `null` for an identity that was already retired, which is what makes a
 * redelivered `user.deleted` a no-op rather than a second unwind — and what
 * lets the caller use this as its claim on the event.
 *
 * **What happens to the rows written before this was corrected.** Accounts
 * deleted under the old `deleted_at`-only path are not backfilled, and
 * deliberately not: they keep `is_deleted = false`, so every read that matters
 * already hides them — `OWNER_NOT_DELETED` on the public side, `RETIRED` on the
 * console — without touching a row. What is **not** repaired is their money:
 * those accounts still hold undeclined open requests and unrefunded confirmed
 * future bookings, and nothing revisits them, because no second `user.deleted`
 * will arrive. `/admin/bookings?flag=refund-stuck` lists them for an operator,
 * which is the whole of the answer; it is a pre-launch database and there is no
 * migration worth writing for it.
 */
export async function retireUserByClerkId(
  db: AppDatabase,
  clerkUserId: string,
): Promise<UserRow | null> {
  if (!clerkUserId) {
    return null;
  }

  const retired = await retireUserWhere(db, and(eq(users.clerkUserId, clerkUserId), notDeleted));

  return retired?.user ?? null;
}

/**
 * The same retirement, addressed by the **local** id (#438).
 *
 * An operator closing an account on its holder's request has a `users.id` and
 * not necessarily a usable Clerk identity, so it needs this door — but it must
 * not be a second implementation of the retirement. A closure requested through
 * the product and one that arrives as `user.deleted` have to leave the database
 * in the same state, or the product's own route becomes the lenient one and the
 * Clerk backstop the strict one, which is exactly backwards.
 *
 * It reports whether a storefront actually came down, which the Clerk path has
 * no response to put anywhere and the console's does.
 */
export async function retireUserById(
  db: AppDatabase,
  userId: string,
): Promise<{ user: UserRow; profileRetired: boolean } | null> {
  if (!userId) {
    return null;
  }

  return retireUserWhere(db, and(eq(users.id, userId), notDeleted));
}

/**
 * The retirement itself, once: `deleted_at` on the account and the storefront
 * down with it, in one transaction.
 *
 * `notDeleted` is in every caller's predicate rather than here, and it is the
 * claim as well as a filter — two concurrent closures both read a live account,
 * and only the one whose UPDATE matches a row does the work. That is what makes
 * a redelivered `user.deleted` a no-op rather than a second unwind.
 */
async function retireUserWhere(
  db: AppDatabase,
  where: SQL | undefined,
): Promise<{ user: UserRow; profileRetired: boolean } | null> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(users)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(where)
      .returning();

    const row = updated?.[0];

    if (!row) {
      return null;
    }

    const profiles = await tx
      .update(vendorProfiles)
      .set({ isDeleted: true, isPublished: false, updatedAt: sql`now()` })
      .where(eq(vendorProfiles.userId, row.id))
      .returning({ id: vendorProfiles.id });

    return { user: row, profileRetired: profiles.length > 0 };
  });
}

/**
 * Every live row, for the reconciliation pass.
 *
 * Only the columns Clerk owns are selected: reconciliation compares against
 * Clerk and must never be tempted to overwrite anything Clerk does not know
 * about, such as the narrowed local `role`.
 */
export async function listLiveClerkIdentities(db: AppDatabase): Promise<
  {
    clerkUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  }[]
> {
  return db
    .select({
      clerkUserId: users.clerkUserId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(notDeleted)
    .orderBy(users.clerkUserId);
}
