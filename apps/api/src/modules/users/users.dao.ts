import { and, eq, exists, inArray, isNotNull, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  bookingRequests,
  bookings,
  emailDeliveries,
  legalAcceptances,
  supportCases,
  USERS_EMAIL_UNIQUE_INDEX,
  users,
  vendorApplications,
  vendorProfiles,
  type NewUserRow,
  type UserRow,
} from '@vendor-marketplace/db/schema';
import {
  CLOSED_ACCOUNT_PLACEHOLDER,
  type AuthProvider,
  type LegalAcceptanceDocument,
} from '@vendor-marketplace/shared';
import { violatesUniqueConstraint } from '../../lib/constraint-violation.js';
import type { AppDatabase } from '../../lib/database.js';
import { closedAccountFields } from './closed-account.js';

/**
 * What a retirement reports: the retired row, or what stood in the way of it.
 * `Extra` widens the retired case for a caller that needs more out of the
 * transaction than the row itself — `retireUserInTransaction`'s released
 * address, below.
 */
export type RetireOutcome<B, Extra extends object = Record<never, never>> =
  ({ user: UserRow; profileRetired: boolean } & Extra) | { blocked: B[] };

/** Read inside the retirement's transaction, under the row lock, so it cannot go stale. */
export type RetirementBlockers<B> = (tx: AppDatabase) => Promise<B[]>;

/**
 * Written inside the retirement's transaction once the row is retired, so a
 * failure rolls the retirement back (VEN-463). Receives what the retirement did.
 */
export type RetirementAudit = (
  tx: AppDatabase,
  outcome: { profileRetired: boolean },
) => Promise<void>;

interface RetirementGuard<B> {
  userId: string;
  blockersOf: RetirementBlockers<B>;
}

/** Live users only — an auth-deleted identity must not resolve to a session. */
const notDeleted = isNull(users.deletedAt);

/**
 * The row for an auth subject **including a retired one**.
 *
 * Almost nothing wants this — `findUserByAuthId` below hides a retired row on
 * purpose, and is what every caller should reach for. The two exceptions are
 * the acceptance gate and the acceptance itself, which have to tell "no account
 * yet" from "account erased": since #429 the absence of a row means "has not
 * accepted, send them to the interstitial", and an auth-deleted identity
 * offered that interstitial would try to bring its erased account back, where
 * `insertUserIfAbsent` finds the retired row under the same `auth_user_id` and
 * answers `null` rather than reviving it. A retired identity keeps getting the
 * 401 it always got.
 */
export async function findUserByAuthIdIncludingRetired(
  db: AppDatabase,
  authUserId: string,
): Promise<UserRow | null> {
  if (!authUserId) {
    return null;
  }

  const rows = await db.select().from(users).where(eq(users.authUserId, authUserId)).limit(1);

  return rows?.[0] ?? null;
}

/**
 * The live row for an auth subject.
 *
 * Derived from the wide read rather than repeating it with one extra `where`
 * clause: two query builders differing only by `notDeleted` are two places for
 * the rule to be edited out of, and the rule is what stops a deleted identity
 * resolving to a session.
 */
export async function findUserByAuthId(
  db: AppDatabase,
  authUserId: string,
): Promise<UserRow | null> {
  const row = await findUserByAuthIdIncludingRetired(db, authUserId);

  return row?.deletedAt ? null : row;
}

/**
 * Everything the session gate needs, in **one** round trip: the row behind a
 * Auth subject, and whether that account holds `version` of `document`.
 *
 * The acceptance check used to be a second query, and it ran on every
 * authenticated request — so against a hosted Postgres it was a whole extra
 * network round trip on the hot path, for a boolean. As a correlated `EXISTS`
 * it is evaluated for the single outer row and short-circuits on the first
 * match, which costs a fraction of a millisecond of planner work instead.
 *
 * Retired rows are included for the reason `findUserByAuthIdIncludingRetired`
 * gives: the gate has to answer "erased" differently from "not accepted yet".
 */
export async function findSessionSubject(
  db: AppDatabase,
  authUserId: string,
  document: LegalAcceptanceDocument,
  version: string,
): Promise<{ user: UserRow; holdsDocument: boolean } | null> {
  if (!authUserId) {
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
    .where(eq(users.authUserId, authUserId))
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Bumps `sessions_invalidated_at` to "now", so a JWT minted before this call
 * fails the auth hook's `iat` comparison even though it is still signed and
 * unexpired (VEN-628). A no-op for an auth subject with no row yet — nothing
 * to invalidate, and the acceptance gate handles that subject on its own path.
 * Returns the account's row id (what live streams are keyed by), or `null` when
 * there is no such account.
 */
export async function invalidateSessionsFor(
  db: AppDatabase,
  authUserId: string,
): Promise<string | null> {
  if (!authUserId) {
    return null;
  }

  const rows = await db
    .update(users)
    .set({ sessionsInvalidatedAt: sql`now()` })
    .where(eq(users.authUserId, authUserId))
    .returning({ id: users.id });

  return rows[0]?.id ?? null;
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
 * Inserts a user, tolerating the race between the auth webhook and the user's
 * own first API call. Returns the winning row either way.
 *
 * **The `DO NOTHING` names no target, and that is the whole point** (#442).
 * `users` carries two unique indexes — `users_auth_user_id_key` and
 * `users_email_key` — and one identity signing in twice at once collides on
 * *both*, because the two inserts carry the same auth id and the same address.
 * A targeted `DO NOTHING` arbitrates only the index it names, so whenever
 * Postgres reached the email index first the loser raised a 23505 that the
 * acceptance endpoint answered as an opaque 500. Reproduced at roughly one run
 * in four by `legal-acceptance-race.contention.test.ts` before this line
 * changed; the unique index that ticket adds neither caused it nor fixed it.
 *
 * **Naming both keys is not available**, which is why the target is dropped
 * rather than widened: `ON CONFLICT (a, b)` names one arbiter *index* over
 * those columns, and there is no unique index on `(auth_user_id, email)`. Nor
 * can the email violation be caught and retried — the first-sign-in caller runs
 * this inside `db.transaction`, and a raised 23505 aborts the whole transaction,
 * so every statement after it fails with 25P02. Not raising is the only shape
 * that works there.
 *
 * **Widening what is swallowed is not the same as swallowing it silently, and
 * the difference is the last read below.** A declined insert has exactly two
 * causes and they are not alike. If this auth id is already in the table the
 * conflict was this identity meeting itself — the race, or a retired row — and
 * `null` is the answer every caller already expects. If it is *not* in the
 * table, the arbiter was some other unique index, which means an address that
 * belongs to **somebody else**, and answering `null` there would report an
 * admin-actionable data problem as the ordinary "this identity has no
 * account yet". So it throws instead.
 *
 * **The message carries the auth id because the 23505 it replaces carried
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
 * account holding the address needs two auth identities sharing one address,
 * which the auth provider refuses within an instance — so through the product that half is
 * unreachable, and the seeds are where it happens, which is why all three say
 * so where they explain that a fixture may not invent an auth id.
 *
 * A **retired** account holding it *was* the ordinary case and is no longer
 * reachable at all. #442 wrote that `retireUserWhere` writes only `deleted_at`
 * while `users_email_key` carried no predicate, so a closed account kept its
 * address in the index while the auth provider freed it, and the same person signing up
 * again collided on that retained address and landed here — a 500 that had been
 * true since the row could first be retired. #442 named the repair as #451's
 * and outstanding; **#451 has since landed it.** `users_email_key` is now
 * `UNIQUE (email) WHERE deleted_at IS NULL`, so a retired row's address does
 * not participate, that insert **does not conflict**, and this function returns
 * the new row from `inserted[0]` without ever reaching the reads below.
 *
 * Which leaves the live-account case as the only way here, and it is the one
 * that genuinely wants an admin. That is why the throw stays: it is not
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
   * Retired rows included, deliberately: an auth-deleted identity signing in
   * again is the one case that must read as "no account" rather than as a
   * collision, and it is the reason this is not simply `findUserByAuthId`.
   */
  const held = await findUserByAuthIdIncludingRetired(db, values.authUserId);

  if (held) {
    return held.deletedAt ? null : held;
  }

  /*
   * Read back who holds the address before giving up, because "which row holds
   * this?" is the whole of the admin's question and neither the 23505 nor a
   * sentence answers it. Only on this path, which is the one that is about to
   * throw anyway.
   *
   * The address itself is not interpolated. It is the one value here that is
   * personal data rather than a pseudonymous identifier, the log is the wrong
   * place to copy it to, and it is already known to whoever is reading — they
   * arrived holding it. The holder's auth id and whether that account is
   * retired are what they do not have, and `retired` is the answer that says
   * this is closure-then-return rather than a genuine clash.
   */
  const holder = await findUserByEmailIncludingRetired(db, values.email);

  throw new Error(
    `users: the insert for ${values.authUserId} was declined — its address is held by ` +
      (holder
        ? `${holder.authUserId} (${holder.deletedAt ? 'retired' : 'live'})`
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

/**
 * What a mirrored `user.updated` did to the row.
 *
 * `emailDiverged` is the half the caller cannot infer from the row: it says the
 * address the auth provider sent could not be written, so `email` below is the **old** one
 * and `pendingEmail` is what it should have been.
 */
export interface AuthMirrorResult {
  user: UserRow;
  emailDiverged: boolean;
}

/**
 * The two divergence columns, written together or not at all.
 *
 * A union rather than two optional fields, because the only three legal writes
 * are "record a divergence", "clear one" and "leave them alone", and half of a
 * divergence — an address with no timestamp, or the reverse — is a state the
 * console would have to guess about.
 */
type EmailDivergenceWrite =
  | { pendingEmail: string; emailSyncFailedAt: SQL }
  | { pendingEmail: null; emailSyncFailedAt: null }
  | Record<string, never>;

/**
 * Mirrors an auth `user.updated` event onto the local row, if one exists.
 *
 * **The email write can be declined, and abandoning it silently is the defect
 * this shape exists to prevent** (#462). `users_email_key` covers `email`, so a
 * `user.updated` carrying an address some other row already holds raises a
 * 23505 here. That used to escape: the webhook answered 500, svix redelivered
 * until it gave up, and `users.email` kept the **old** address for ever with
 * nothing anywhere saying so — while `notification-email.dao.ts` went on
 * sending booking detail about other people to it.
 *
 * **Retrying cannot help**, which is why the event is not failed. The collision
 * is a fact about a different row and will be exactly as true on the next
 * delivery; exhausting svix's retries only turns a permanent condition into a
 * permanent condition nobody was told about. So the address is recorded as
 * pending, everything else in the patch is still mirrored, and the handler
 * reports success.
 *
 * **Catching it here is available and inside `insertUserIfAbsent` it is not.**
 * That path runs under the first-sign-in caller's `db.transaction`, where a
 * raised 23505 aborts the transaction and every later statement fails 25P02 —
 * which is why #442 had to reach for an untargeted `DO NOTHING` there instead.
 * This statement has no transaction around it, so the error is catchable and
 * the follow-up write is possible.
 *
 * **A successful email write clears the record**, so `pending_email` always
 * means *currently* diverged. And when a write moves a row **off** an address,
 * the row waiting on that address takes it in the same call
 * (`handAddressToWaiter`, VEN-386), so the ordering race repairs itself on the
 * event that ends it. A holder the auth provider no longer backs is `auth-sync.service.ts`'s to
 * resolve.
 *
 * **Rows that diverged before this landed carry neither column**, and no
 * migration backfills them: the old code never learnt which address it failed
 * to write, so there is nothing in the database to backfill *from*. The repair
 * is `pnpm reconcile:auth`, which reads every live row's current address out
 * of the auth provider and hands it to this function — a diverged row records its pending
 * address on that pass, and an agreeing one is left alone.
 */
export async function updateUserByAuthId(
  db: AppDatabase,
  authUserId: string,
  patch: Partial<NewUserRow>,
): Promise<AuthMirrorResult | null> {
  if (!authUserId || Object.keys(patch).length === 0) {
    return null;
  }

  const { email, ...rest } = patch;

  /*
   * An event carrying **no** address leaves the divergence columns alone, and
   * that distinction is load-bearing rather than incidental: clearing them on
   * a name or avatar change would be a repair nothing performed — the address
   * would still disagree with the auth provider and the console would have stopped saying
   * so. Only a write that actually lands the address resolves the divergence.
   *
   * Nothing else differs between the two, and a patch with no `email` cannot
   * raise `users_email_key` at all, so both go through the one statement.
   */
  const resolving: EmailDivergenceWrite =
    email === undefined ? {} : { pendingEmail: null, emailSyncFailedAt: null };

  try {
    // Read first: `RETURNING` carries only the new address, and the old one is what is released.
    const previousEmail =
      email === undefined ? undefined : (await findUserByAuthId(db, authUserId))?.email;
    const user = await writeAuthPatch(db, authUserId, patch, resolving);

    if (user && previousEmail !== undefined && previousEmail !== user.email) {
      await handAddressToWaiter(db, previousEmail);
    }

    return user ? { user, emailDiverged: false } : null;
  } catch (error) {
    /*
     * Narrow on purpose, and never on message text: this catch swallows the
     * error, so a match on the wrapper's message would let any failure of
     * this statement — a deadlock, a timeout, a dropped connection — be
     * recorded as a collision and answered 200, for an account whose own name
     * happened to contain the index's name. `violatesUniqueConstraint`
     * matches the SQLSTATE and an exact constraint name and nothing else.
     *
     * Anything wider than `users_email_key` has to keep failing loudly, and
     * the constraint name comes from the schema rather than being spelled
     * again here, so renaming the index moves both ends.
     *
     * A patch carrying no address cannot have raised that constraint at all,
     * so it is rethrown for the same reason: whatever failed there is not this.
     */
    if (email === undefined || !violatesUniqueConstraint(error, USERS_EMAIL_UNIQUE_INDEX)) {
      throw error;
    }

    /*
     * The rest of the patch still applies — a name change that arrived in the
     * same event is not in dispute, and dropping it would make one contested
     * address freeze every other mirrored field on the account.
     *
     * `coalesce` keeps the timestamp at the **first** failure across
     * redeliveries and across later events that collide again, so it answers
     * "since when has this been wrong" rather than "when did we last look".
     */
    const user = await writeAuthPatch(db, authUserId, rest, {
      pendingEmail: email,
      emailSyncFailedAt: sql`coalesce(${users.emailSyncFailedAt}, now())`,
    });

    return user ? { user, emailDiverged: true } : null;
  }
}

/**
 * Writes a just-released address onto the live row that diverged waiting for it
 * (VEN-386).
 *
 * The ordering race is the reason: a `user.updated` moving onto an address can
 * be delivered before the one moving its holder off it, and the second event
 * is the last that will ever arrive for either account. Without this the waiter
 * stayed diverged until its holder edited their profile again.
 *
 * **Only a sole waiter is handed the address.** Auth gives an address to one
 * identity, so of two rows waiting on it at most one is genuine, and nothing
 * in the database says which — `email_sync_failed_at` is the first failure on
 * *any* address, not when this one was claimed. Guessing would send one
 * account's notifications to another's inbox. With several waiters, each
 * stays diverged (and mail-silent) until its own next event, which asks auth.
 *
 * A waiter that collides anyway (the address was taken in between) keeps its
 * record, the state it was already in. One level only — the waiter's own old
 * address is not re-offered, so a chain of swaps cannot recurse here.
 */
async function handAddressToWaiter(db: AppDatabase, address: string): Promise<void> {
  const waiters = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.pendingEmail, address), notDeleted))
    .limit(2);

  const [waiter] = waiters;

  if (!waiter || waiters.length > 1) {
    return;
  }

  try {
    await db
      .update(users)
      .set({ email: address, pendingEmail: null, emailSyncFailedAt: null, updatedAt: sql`now()` })
      .where(and(eq(users.id, waiter.id), eq(users.pendingEmail, address), notDeleted));
  } catch (error) {
    if (!violatesUniqueConstraint(error, USERS_EMAIL_UNIQUE_INDEX)) {
      throw error;
    }
  }
}

/**
 * The live row holding an address, for a collision's caller to ask auth
 * about (VEN-386). Live only: `users_email_key` ignores retired rows, so only a
 * live one can be what refused the write.
 */
export async function findLiveUserByEmail(db: AppDatabase, email: string): Promise<UserRow | null> {
  if (!email) {
    return null;
  }

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), notDeleted))
    .limit(1);

  return rows?.[0] ?? null;
}

/** The one `UPDATE` both branches above run, so they cannot drift apart. */
async function writeAuthPatch(
  db: AppDatabase,
  authUserId: string,
  patch: Partial<NewUserRow>,
  divergence: EmailDivergenceWrite,
): Promise<UserRow | null> {
  const updated = await db
    .update(users)
    .set({ ...patch, ...divergence, updatedAt: sql`now()` })
    .where(and(eq(users.authUserId, authUserId), notDeleted))
    .returning();

  return updated?.[0] ?? null;
}

/**
 * Retires the local row for a deleted auth identity, **and the storefront it
 * owns** (#433). Bookings, reviews, and messages reference this user, so the row
 * stays for referential integrity.
 *
 * One transaction, because the two halves are one fact. This used to set
 * `deleted_at` and stop: `vendor_profiles.is_deleted` is the tombstone four
 * public reads check, nothing outside the seed scripts ever wrote it, and no
 * visibility predicate joined `users` — so a vendor who deleted their auth
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
 * will arrive. `/admin/bookings?flag=refund-stuck` lists them for an admin,
 * which is the whole of the answer; it is a pre-launch database and there is no
 * migration worth writing for it.
 */
export async function retireUserByAuthId(
  db: AppDatabase,
  authUserId: string,
): Promise<UserRow | null> {
  if (!authUserId) {
    return null;
  }

  const retired = await retireUserWhere(db, and(eq(users.authUserId, authUserId), notDeleted));

  return retired && 'user' in retired ? retired.user : null;
}

/**
 * The same retirement, addressed by the **local** id (#438).
 *
 * An admin closing an account on its holder's request has a `users.id` and
 * not necessarily a usable auth identity, so it needs this door — but it must
 * not be a second implementation of the retirement. A closure requested through
 * the product and one that arrives as `user.deleted` have to leave the database
 * in the same state, or the product's own route becomes the lenient one and the
 * The auth provider backstop the strict one, which is exactly backwards.
 *
 * It reports whether a storefront actually came down, which the auth path has
 * no response to put anywhere and the console's does.
 */
export async function retireUserById<B>(
  db: AppDatabase,
  userId: string,
  blockersOf?: RetirementBlockers<B>,
  audit?: RetirementAudit,
): Promise<RetireOutcome<B> | null> {
  if (!userId) {
    return null;
  }

  return retireUserWhere(
    db,
    and(eq(users.id, userId), notDeleted),
    undefined,
    blockersOf && { userId, blockersOf },
    audit,
  );
}

/**
 * Any admin other than `userId` who can still sign in to the console: not
 * retired and not banned. Takes the table so the same rule can be read on its
 * own and correlated inside a retirement predicate.
 */
function isOtherLiveAdmin(
  table: Record<'role' | 'deletedAt' | 'isBanned' | 'id', AnyPgColumn>,
  userId: string,
): SQL | undefined {
  return and(
    eq(table.role, 'admin'),
    isNull(table.deletedAt),
    eq(table.isBanned, false),
    ne(table.id, userId),
  );
}

/** Whether an admin other than `userId` would still hold the console. */
export async function hasAnotherLiveAdmin(db: AppDatabase, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(isOtherLiveAdmin(users, userId))
    .limit(1);

  return rows.length > 0;
}

/** The one lock every admin retirement takes; exported for its contention test. */
export const ADMIN_RETIREMENT_LOCK = sql`select pg_advisory_xact_lock(hashtextextended('admin_retirement', 0))`;

/**
 * Retires an **admin** — refused when nobody else would hold the console
 * (VEN-391).
 *
 * The check is the `UPDATE`'s own predicate, taken under one transaction-scoped
 * advisory lock every admin retirement shares. The predicate alone is not
 * enough under READ COMMITTED: two admins closing each other at once would
 * each see the other still live and both commit, leaving nobody. The lock makes
 * the second retirement start its statement after the first has committed, so
 * its snapshot sees one live admin fewer.
 */
export async function retireAdminById<B>(
  db: AppDatabase,
  userId: string,
  blockersOf?: RetirementBlockers<B>,
  audit?: RetirementAudit,
): Promise<RetireOutcome<B> | 'last-admin' | null> {
  const other = alias(users, 'other_admin');
  const retired = await retireUserWhere(
    db,
    and(
      eq(users.id, userId),
      notDeleted,
      exists(
        db
          .select({ one: sql`1` })
          .from(other)
          .where(isOtherLiveAdmin(other, userId)),
      ),
    ),
    ADMIN_RETIREMENT_LOCK,
    blockersOf && { userId, blockersOf },
    audit,
  );

  if (retired) {
    return retired;
  }

  const [live] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), notDeleted))
    .limit(1);

  return live ? 'last-admin' : null;
}

/**
 * Bans an **admin** — refused when nobody else would hold the console
 * (VEN-417).
 *
 * A ban takes an admin out of the live set as surely as a retirement does,
 * so it shares the retirement's lock and its predicate. Without the lock, one
 * admin banning the other while that one closes the first both commit, each
 * statement's snapshot still counting its own actor as live. It also takes a
 * held storefront down, as `setBanned` does, in the same transaction.
 *
 * `null` when the row was not ours to ban: gone, or already banned by a request
 * that won the claim.
 */
export async function banAdminById(
  db: AppDatabase,
  userId: string,
  now: Date,
): Promise<{ profileUnpublished: boolean } | 'last-admin' | null> {
  return db.transaction(async (tx) => {
    await tx.execute(ADMIN_RETIREMENT_LOCK);

    const other = alias(users, 'other_admin');
    const banned = await tx
      .update(users)
      .set({ isBanned: true, bannedAt: now, updatedAt: now })
      .where(
        and(
          eq(users.id, userId),
          eq(users.isBanned, false),
          exists(
            tx
              .select({ one: sql`1` })
              .from(other)
              .where(isOtherLiveAdmin(other, userId)),
          ),
        ),
      )
      .returning({ id: users.id });

    if (banned.length === 0) {
      const [unbanned] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.isBanned, false)))
        .limit(1);

      return unbanned ? 'last-admin' : null;
    }

    const unpublished = await tx
      .update(vendorProfiles)
      .set({ isPublished: false, updatedAt: now })
      .where(and(eq(vendorProfiles.userId, userId), eq(vendorProfiles.isPublished, true)))
      .returning({ id: vendorProfiles.id });

    return { profileUnpublished: unpublished.length > 0 };
  });
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
async function retireUserWhere<B>(
  db: AppDatabase,
  where: SQL | undefined,
  lock?: SQL,
  guard?: RetirementGuard<B>,
  audit?: RetirementAudit,
): Promise<RetireOutcome<B> | null> {
  const retired = await retireUserInTransaction(db, where, lock, guard, audit);

  /*
   * A retired row's address leaves `users_email_key`, so it is released as
   * surely as by a `user.updated` — and a `user.deleted` delivered after the
   * event of the account that took the address over is the same ordering race
   * (VEN-386). After the commit, not inside it: a 23505 there would abort the
   * retirement itself.
   */
  if (retired && 'user' in retired) {
    await handAddressToWaiter(db, retired.releasedEmail);

    return { user: retired.user, profileRetired: retired.profileRetired };
  }

  return retired;
}

async function retireUserInTransaction<B>(
  db: AppDatabase,
  where: SQL | undefined,
  lock?: SQL,
  guard?: RetirementGuard<B>,
  audit?: RetirementAudit,
): Promise<RetireOutcome<B, { releasedEmail: string }> | null> {
  return db.transaction(async (tx) => {
    if (lock) {
      await tx.execute(lock);
    }

    if (guard) {
      /*
       * `FOR UPDATE`, not the retirement's own row lock: the `UPDATE` below
       * takes `FOR NO KEY UPDATE`, which a concurrent booking insert's
       * `FOR KEY SHARE` on this row (its `customer_id` foreign key) does not
       * conflict with. `FOR UPDATE` does, so a booking being confirmed either
       * commits before the blockers are read or waits behind this retirement
       * (VEN-483).
       */
      await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, guard.userId), notDeleted))
        .for('update');

      const blocked = await guard.blockersOf(tx);

      if (blocked.length > 0) {
        return { blocked };
      }
    }

    /*
     * Read and locked before the write, because the write replaces the address
     * with its tombstone (VEN-614) and the real one is still owed to a waiter
     * once this commits. The `UPDATE` repeats the predicate, so the claim is
     * unchanged: a concurrent closure that committed first leaves it no row.
     */
    const [target] = await tx
      .select({ id: users.id, role: users.role, email: users.email })
      .from(users)
      .where(where)
      .for('update');

    if (!target) {
      return null;
    }

    const updated = await tx
      .update(users)
      .set({ ...closedAccountFields(target), deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(users.id, target.id), where))
      .returning();

    const row = updated?.[0];

    if (!row) {
      return null;
    }

    const profiles = await tx
      .update(vendorProfiles)
      .set({
        isDeleted: true,
        isPublished: false,
        // The coordinates are the address to eight decimal places.
        address: null,
        latitude: null,
        longitude: null,
        // What they wrote about themselves (VEN-687).
        bio: null,
        tagline: null,
        updatedAt: sql`now()`,
      })
      .where(eq(vendorProfiles.userId, row.id))
      .returning({ id: vendorProfiles.id });

    const profileRetired = profiles.length > 0;
    const profileIds = profiles.map((profile) => profile.id);

    /*
     * Where the event was, and what the customer wrote about it (VEN-687), on
     * every request and booking the closed person is a party to: as the
     * customer, or as the vendor whose profile was just retired. The rows stay
     * for the financial record. A placeholder rather than null, so a surface
     * that prints the column prints it and none renders a blank.
     */
    const partyOf = (customerId: AnyPgColumn, vendorId: AnyPgColumn): SQL | undefined =>
      profileIds.length > 0
        ? or(eq(customerId, row.id), inArray(vendorId, profileIds))
        : eq(customerId, row.id);

    await tx
      .update(bookingRequests)
      .set({
        eventLocation: CLOSED_ACCOUNT_PLACEHOLDER,
        customDetails: CLOSED_ACCOUNT_PLACEHOLDER,
      })
      .where(partyOf(bookingRequests.customerId, bookingRequests.vendorId));
    await tx
      .update(bookings)
      .set({ eventLocation: CLOSED_ACCOUNT_PLACEHOLDER })
      .where(partyOf(bookings.customerId, bookings.vendorId));
    /*
     * An application is keyed by the address it was made with, which is what
     * `target.email` still is here.
     */
    await tx
      .update(vendorApplications)
      .set({ businessName: null, city: null, message: null })
      .where(eq(vendorApplications.email, target.email));

    /*
     * The rows stay, the address does not (VEN-672): the same tombstone the
     * `users` row took, so nothing a console search can reach still names them.
     */
    await tx
      .update(emailDeliveries)
      .set({ recipientEmail: row.email })
      .where(eq(emailDeliveries.userId, row.id));
    /*
     * Cases from their account, and those they sent signed out from the same
     * address (which carry no `sender_user_id`). A chargeback has no address and
     * is left without one.
     */
    await tx
      .update(supportCases)
      .set({ senderEmail: row.email, message: CLOSED_ACCOUNT_PLACEHOLDER })
      .where(
        and(
          isNotNull(supportCases.senderEmail),
          or(
            eq(supportCases.senderUserId, row.id),
            and(
              isNull(supportCases.senderUserId),
              sql`lower(${supportCases.senderEmail}) = lower(${target.email})`,
            ),
          ),
        ),
      );

    await audit?.(tx, { profileRetired });

    return { user: row, profileRetired, releasedEmail: target.email };
  });
}

/**
 * Every live row, for the reconciliation pass.
 *
 * Only the columns the identity owns are selected, plus the divergence record:
 * reconciliation compares against Neon Auth and must never be tempted to
 * overwrite anything it does not know about, such as the narrowed local `role`.
 */
export async function listLiveAuthIdentities(db: AppDatabase): Promise<
  {
    authUserId: string;
    authProvider: AuthProvider;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    pendingEmail: string | null;
  }[]
> {
  return db
    .select({
      authUserId: users.authUserId,
      authProvider: users.authProvider,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      pendingEmail: users.pendingEmail,
    })
    .from(users)
    .where(notDeleted)
    .orderBy(users.authUserId);
}
