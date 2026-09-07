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
 * `insertUserIfAbsent` collides on `clerk_user_id`. A retired identity keeps
 * getting the 401 it always got.
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
 */
export async function insertUserIfAbsent(
  db: AppDatabase,
  values: NewUserRow,
): Promise<UserRow | null> {
  const inserted = await db
    .insert(users)
    .values(values)
    .onConflictDoNothing({ target: users.clerkUserId })
    .returning();

  return inserted?.[0] ?? (await findUserByClerkId(db, values.clerkUserId));
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
