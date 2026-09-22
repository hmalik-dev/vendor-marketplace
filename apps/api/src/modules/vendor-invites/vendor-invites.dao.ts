import { and, count, desc, eq, gt, isNull, lt, notInArray, sql, type SQL } from 'drizzle-orm';
import {
  categories,
  users,
  vendorApplications,
  vendorInvites,
  type VendorApplicationRow,
  type VendorInviteRow,
} from '@vendor-marketplace/db/schema';
import { truncateFailureReason } from '../notifications/email-delivery.dao.js';
import {
  isVendorApplicationComplete,
  type AdminVendorApplicationRow,
  type AdminVendorInviteRow,
  type MyVendorApplication,
  type VendorApplicationInput,
  type VendorApplicationStatus,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/** Every address in both tables is stored lowercased; the check constraints refuse anything else. */
export function inviteKey(email: string): string {
  return email.trim().toLowerCase();
}

export async function findInviteByEmail(
  db: AppDatabase,
  email: string,
): Promise<VendorInviteRow | null> {
  const rows = await db
    .select()
    .from(vendorInvites)
    .where(eq(vendorInvites.email, inviteKey(email)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * The invite for an address, locked for the caller's transaction, so a revoke
 * racing an acceptance either lands first (and the acceptance is refused) or
 * waits until the account and its stamp have committed (and is refused as used).
 */
export async function lockInviteByEmail(
  tx: AppDatabase,
  email: string,
): Promise<VendorInviteRow | null> {
  const rows = await tx
    .select()
    .from(vendorInvites)
    .where(eq(vendorInvites.email, inviteKey(email)))
    .for('update')
    .limit(1);

  return rows[0] ?? null;
}

/** Stamps the first use of an invite; a later account on the same address changes nothing. */
export async function markInviteAccepted(tx: AppDatabase, email: string): Promise<void> {
  await tx
    .update(vendorInvites)
    .set({ acceptedAt: sql`now()` })
    .where(and(eq(vendorInvites.email, inviteKey(email)), isNull(vendorInvites.acceptedAt)));
}

/** Creates the invite, or returns `null` when the address is already invited. */
export async function insertInviteIfAbsent(
  tx: AppDatabase,
  email: string,
  invitedBy: string,
): Promise<VendorInviteRow | null> {
  const rows = await tx
    .insert(vendorInvites)
    .values({ email: inviteKey(email), invitedBy })
    .onConflictDoNothing({ target: vendorInvites.email })
    .returning();

  return rows[0] ?? null;
}

export async function findInviteById(
  db: AppDatabase,
  inviteId: string,
): Promise<VendorInviteRow | null> {
  const rows = await db.select().from(vendorInvites).where(eq(vendorInvites.id, inviteId)).limit(1);

  return rows[0] ?? null;
}

/** Deletes an invite nobody has used yet; `false` when it was used or is gone. */
export async function deleteUnusedInvite(tx: AppDatabase, inviteId: string): Promise<boolean> {
  const rows = await tx
    .delete(vendorInvites)
    .where(and(eq(vendorInvites.id, inviteId), isNull(vendorInvites.acceptedAt)))
    .returning({ id: vendorInvites.id });

  return rows.length > 0;
}

export async function findAdminInviteById(
  db: AppDatabase,
  inviteId: string,
): Promise<AdminVendorInviteRow | null> {
  const rows = await queryAdminInvites(db, 1, 0, eq(vendorInvites.id, inviteId));

  return rows[0] ?? null;
}

export function findAdminInvites(
  db: AppDatabase,
  limit: number,
  offset: number,
): Promise<AdminVendorInviteRow[]> {
  return queryAdminInvites(db, limit, offset, undefined);
}

async function queryAdminInvites(
  db: AppDatabase,
  limit: number,
  offset: number,
  where: SQL | undefined,
): Promise<AdminVendorInviteRow[]> {
  const rows = await db
    .select({
      id: vendorInvites.id,
      email: vendorInvites.email,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: vendorInvites.createdAt,
      acceptedAt: vendorInvites.acceptedAt,
      emailAttempts: vendorInvites.emailAttempts,
      emailSentAt: vendorInvites.emailSentAt,
      emailFailureReason: vendorInvites.emailFailureReason,
    })
    .from(vendorInvites)
    .leftJoin(users, eq(vendorInvites.invitedBy, users.id))
    .where(where)
    .orderBy(desc(vendorInvites.createdAt), desc(vendorInvites.id))
    .limit(limit)
    .offset(offset);

  return rows.map(
    ({ firstName, lastName, emailAttempts, emailSentAt, emailFailureReason, ...row }) => ({
      ...row,
      ...inviteEmailState({ emailAttempts, emailSentAt, emailFailureReason }),
      invitedByName:
        firstName === null || lastName === null ? null : `${firstName} ${lastName}`.trim() || null,
    }),
  );
}

/** What the console shows of an invite's email; see `vendor_invites.email_attempts`. */
export function inviteEmailState(
  invite: Pick<VendorInviteRow, 'emailAttempts' | 'emailSentAt' | 'emailFailureReason'>,
): Pick<AdminVendorInviteRow, 'emailStatus' | 'emailFailureReason'> {
  if (invite.emailSentAt !== null) {
    return { emailStatus: 'sent', emailFailureReason: null };
  }

  return invite.emailAttempts > 0
    ? { emailStatus: 'failed', emailFailureReason: invite.emailFailureReason }
    : { emailStatus: 'pending', emailFailureReason: null };
}

/** The invite row, locked for the caller's transaction and **waiting** for a holder. */
export async function lockInviteById(
  tx: AppDatabase,
  inviteId: string,
): Promise<VendorInviteRow | null> {
  const rows = await tx
    .select()
    .from(vendorInvites)
    .where(eq(vendorInvites.id, inviteId))
    .for('update')
    .limit(1);

  return rows[0] ?? null;
}

export interface RetryableEmailQuery {
  now: Date;
  maxAttempts: number;
  windowMs: number;
  /** Rows already tried this tick, so a failed retry is not retried again in the same sweep. */
  exclude: readonly string[];
}

/**
 * The next unaccepted invite whose email failed and is still inside the retry
 * budget, locked with `SKIP LOCKED` so a second sweep passes over it rather than
 * sending it twice. An operator's resend takes `lockInviteById` instead, which
 * waits for the holder and is then refused because the email already went out.
 */
export async function lockRetryableInvite(
  tx: AppDatabase,
  query: RetryableEmailQuery,
): Promise<VendorInviteRow | null> {
  const rows = await tx
    .select()
    .from(vendorInvites)
    .where(
      and(
        isNull(vendorInvites.acceptedAt),
        isNull(vendorInvites.emailSentAt),
        gt(vendorInvites.emailAttempts, 0),
        lt(vendorInvites.emailAttempts, query.maxAttempts),
        gt(vendorInvites.emailLastAttemptAt, new Date(query.now.getTime() - query.windowMs)),
        query.exclude.length > 0 ? notInArray(vendorInvites.id, [...query.exclude]) : undefined,
      ),
    )
    .orderBy(vendorInvites.emailLastAttemptAt)
    .for('update', { skipLocked: true })
    .limit(1);

  return rows[0] ?? null;
}

/** Records one send attempt on the invite the caller holds locked. */
export async function recordInviteEmailAttempt(
  tx: AppDatabase,
  inviteId: string,
  attempt: { at: Date; failureReason: string | null },
): Promise<void> {
  await tx
    .update(vendorInvites)
    .set({
      emailAttempts: sql`${vendorInvites.emailAttempts} + 1`,
      emailLastAttemptAt: attempt.at,
      emailSentAt: attempt.failureReason === null ? attempt.at : null,
      emailFailureReason: truncateFailureReason(attempt.failureReason),
    })
    .where(eq(vendorInvites.id, inviteId));
}

/**
 * Adds the applicant to the waitlist. A second application from the same
 * address writes nothing — unless `verified`, where the address is the
 * caller's own session email: then it replaces details still waiting on a
 * decision, so a stranger who filed first under that address cannot speak for
 * its owner.
 */
/**
 * Writes the details, returning the row's id — or `undefined` when nothing
 * was written (the unverified path's conflict, or a verified resubmit whose
 * `setWhere` no longer matches).
 */
export async function upsertApplication(
  db: AppDatabase,
  input: VendorApplicationInput,
  status: VendorApplicationStatus,
  verified: boolean,
): Promise<string | undefined> {
  const insert = db.insert(vendorApplications).values({
    email: inviteKey(input.email),
    businessName: input.businessName,
    category: input.category,
    city: input.city,
    state: input.state ?? null,
    message: input.message ?? null,
    status,
  });

  if (!verified) {
    const rows = await insert
      .onConflictDoNothing({ target: vendorApplications.email })
      .returning({ id: vendorApplications.id });
    return rows[0]?.id;
  }

  const rows = await insert
    .onConflictDoUpdate({
      target: vendorApplications.email,
      set: {
        businessName: input.businessName,
        category: input.category,
        city: input.city,
        state: input.state ?? null,
        message: input.message ?? null,
        /*
         * The row usually pre-exists now (seeded on refusal or arrival, VEN-512),
         * so this is the only write that can ever turn a seeded `new` row
         * `invited` for an address invited in between. Safe to set
         * unconditionally: `setWhere` already restricts the update to a row
         * still `new`, so this can only ever leave it `new` or promote it.
         */
        status,
        updatedAt: sql`now()`,
      },
      setWhere: eq(vendorApplications.status, 'new'),
    })
    .returning({ id: vendorApplications.id });

  return rows[0]?.id;
}

/**
 * The application for an address, locked for the caller's transaction — the
 * waitlist confirmation email's own gate (VEN-516), the same shape
 * `lockInviteByEmail` gives the invite send.
 */
export async function lockApplicationByEmail(
  tx: AppDatabase,
  email: string,
): Promise<VendorApplicationRow | null> {
  const rows = await tx
    .select()
    .from(vendorApplications)
    .where(eq(vendorApplications.email, inviteKey(email)))
    .for('update')
    .limit(1);

  return rows[0] ?? null;
}

/** Records one confirmation-email send attempt on the application the caller holds locked. */
export async function recordApplicationEmailAttempt(
  tx: AppDatabase,
  applicationId: string,
  attempt: { at: Date; failureReason: string | null },
): Promise<void> {
  await tx
    .update(vendorApplications)
    .set({
      confirmationEmailAttempts: sql`${vendorApplications.confirmationEmailAttempts} + 1`,
      confirmationEmailLastAttemptAt: attempt.at,
      confirmationEmailSentAt: attempt.failureReason === null ? attempt.at : null,
      confirmationEmailFailureReason: truncateFailureReason(attempt.failureReason),
    })
    .where(eq(vendorApplications.id, applicationId));
}

/**
 * The next application whose confirmation email failed and is still inside the
 * retry budget, locked with `SKIP LOCKED` — `lockRetryableInvite`'s own shape.
 */
export async function lockRetryableApplication(
  tx: AppDatabase,
  query: RetryableEmailQuery,
): Promise<VendorApplicationRow | null> {
  const rows = await tx
    .select()
    .from(vendorApplications)
    .where(
      and(
        isNull(vendorApplications.confirmationEmailSentAt),
        gt(vendorApplications.confirmationEmailAttempts, 0),
        lt(vendorApplications.confirmationEmailAttempts, query.maxAttempts),
        gt(
          vendorApplications.confirmationEmailLastAttemptAt,
          new Date(query.now.getTime() - query.windowMs),
        ),
        query.exclude.length > 0
          ? notInArray(vendorApplications.id, [...query.exclude])
          : undefined,
      ),
    )
    .orderBy(vendorApplications.confirmationEmailLastAttemptAt)
    .for('update', { skipLocked: true })
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Writes the waitlist row the moment an address is known and nothing else is
 * — the refusal, or the first arrival at the details screen (VEN-512). A
 * repeat call writes nothing: the row, once seeded, is only ever completed
 * through `upsertApplication`'s verified path.
 */
export async function seedApplication(db: AppDatabase, email: string): Promise<void> {
  await db
    .insert(vendorApplications)
    .values({ email: inviteKey(email), status: 'new' })
    .onConflictDoNothing({ target: vendorApplications.email });
}

/** The caller's own application row, for the details/waitlist routing decision. */
export async function findApplicationByEmail(
  db: AppDatabase,
  email: string,
): Promise<MyVendorApplication | null> {
  const rows = await db
    .select({
      email: vendorApplications.email,
      businessName: vendorApplications.businessName,
      category: vendorApplications.category,
      city: vendorApplications.city,
      state: vendorApplications.state,
      message: vendorApplications.message,
    })
    .from(vendorApplications)
    .where(eq(vendorApplications.email, inviteKey(email)))
    .limit(1);

  const row = rows[0];

  return row ? { ...row, complete: isVendorApplicationComplete(row) } : null;
}

export async function countAdminInvites(db: AppDatabase): Promise<number> {
  const rows = await db.select({ total: count() }).from(vendorInvites);

  return rows[0]?.total ?? 0;
}

/** Every application, and how many of them are still waiting on a decision. */
export async function countAdminApplications(
  db: AppDatabase,
): Promise<{ total: number; waiting: number }> {
  const rows = await db
    .select({
      total: count(),
      waiting: sql<number>`count(*) filter (where ${vendorApplications.status} = 'new')`.mapWith(
        Number,
      ),
    })
    .from(vendorApplications);

  return { total: rows[0]?.total ?? 0, waiting: rows[0]?.waiting ?? 0 };
}

/**
 * A stored `category` is a category id since VEN-512, and free text on a row
 * that predates it. The join guards the cast with a `CASE`, not `AND`: a join
 * condition's operands are not guaranteed left-to-right short-circuit the way
 * a plain `WHERE` boolean is, and a hash join built the cast eagerly to key
 * the join before the regex ever ran, throwing `invalid input syntax for type
 * uuid` on the first free-text row — reproduced against PGlite. `CASE` is
 * where Postgres does guarantee only the matching branch is evaluated.
 */
const UUID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

/** `category`, resolved to its name for a single row — the `PUT` decision's own response. */
export async function resolveCategoryName(
  db: AppDatabase,
  category: string | null,
): Promise<string | null> {
  if (category === null || !new RegExp(UUID_PATTERN).test(category)) {
    return null;
  }

  const rows = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, category))
    .limit(1);

  return rows[0]?.name ?? null;
}

export async function findAdminApplications(
  db: AppDatabase,
  limit: number,
  offset: number,
): Promise<AdminVendorApplicationRow[]> {
  const rows = await db
    .select({
      id: vendorApplications.id,
      email: vendorApplications.email,
      businessName: vendorApplications.businessName,
      category: vendorApplications.category,
      categoryName: categories.name,
      city: vendorApplications.city,
      state: vendorApplications.state,
      message: vendorApplications.message,
      status: vendorApplications.status,
      createdAt: vendorApplications.createdAt,
    })
    .from(vendorApplications)
    .leftJoin(
      categories,
      sql`${categories.id} = (case when ${vendorApplications.category} ~ ${UUID_PATTERN} then ${vendorApplications.category}::uuid else null end)`,
    )
    .orderBy(desc(vendorApplications.createdAt), desc(vendorApplications.id))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({ ...row, complete: isVendorApplicationComplete(row) }));
}

/** The application, locked for the caller's transaction. */
export async function lockApplication(
  tx: AppDatabase,
  applicationId: string,
): Promise<VendorApplicationRow | null> {
  const rows = await tx
    .select()
    .from(vendorApplications)
    .where(eq(vendorApplications.id, applicationId))
    .for('update')
    .limit(1);

  return rows[0] ?? null;
}

export async function setApplicationStatus(
  tx: AppDatabase,
  where: { id: string } | { email: string },
  status: VendorApplicationStatus,
): Promise<void> {
  await tx
    .update(vendorApplications)
    .set({ status, updatedAt: sql`now()` })
    .where(
      'id' in where
        ? eq(vendorApplications.id, where.id)
        : eq(vendorApplications.email, inviteKey(where.email)),
    );
}

/**
 * Marks every application from the address `invited`, remembering what it was so a
 * revoke can put it back. An application already `invited` keeps its remembered status.
 */
export async function markApplicationInvited(tx: AppDatabase, email: string): Promise<void> {
  await tx
    .update(vendorApplications)
    .set({
      statusBeforeInvite: sql`case when ${vendorApplications.status} <> 'invited' then ${vendorApplications.status} else ${vendorApplications.statusBeforeInvite} end`,
      status: 'invited',
      updatedAt: sql`now()`,
    })
    .where(eq(vendorApplications.email, inviteKey(email)));
}

/** Undoes `markApplicationInvited`: the remembered status, or `new` when there is none. */
export async function restoreApplicationStatus(tx: AppDatabase, email: string): Promise<void> {
  const key = inviteKey(email);
  const rows = await tx
    .select({ before: vendorApplications.statusBeforeInvite })
    .from(vendorApplications)
    .where(and(eq(vendorApplications.email, key), eq(vendorApplications.status, 'invited')))
    .for('update')
    .limit(1);

  if (rows.length === 0) {
    return;
  }

  await tx
    .update(vendorApplications)
    .set({
      status: rows[0]?.before ?? 'new',
      statusBeforeInvite: null,
      updatedAt: sql`now()`,
    })
    .where(eq(vendorApplications.email, key));
}

/** Whether the address already belongs to a live account, whatever its role. */
export async function hasLiveAccount(db: AppDatabase, email: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${inviteKey(email)}`, isNull(users.deletedAt)))
    .limit(1);

  return rows.length > 0;
}
