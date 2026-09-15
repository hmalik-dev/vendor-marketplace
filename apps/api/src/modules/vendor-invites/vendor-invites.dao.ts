import { desc, eq, isNull, and, sql } from 'drizzle-orm';
import {
  users,
  vendorApplications,
  vendorInvites,
  type VendorApplicationRow,
  type VendorInviteRow,
} from '@vendor-marketplace/db/schema';
import {
  MAX_VENDOR_INVITE_LIST_ROWS,
  type AdminVendorApplicationRow,
  type AdminVendorInviteRow,
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

export async function findAdminInvites(db: AppDatabase): Promise<AdminVendorInviteRow[]> {
  const rows = await db
    .select({
      id: vendorInvites.id,
      email: vendorInvites.email,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: vendorInvites.createdAt,
      acceptedAt: vendorInvites.acceptedAt,
    })
    .from(vendorInvites)
    .leftJoin(users, eq(vendorInvites.invitedBy, users.id))
    .orderBy(desc(vendorInvites.createdAt), desc(vendorInvites.id))
    .limit(MAX_VENDOR_INVITE_LIST_ROWS);

  return rows.map(({ firstName, lastName, ...row }) => ({
    ...row,
    invitedByName:
      firstName === null || lastName === null ? null : `${firstName} ${lastName}`.trim() || null,
  }));
}

/** Adds the applicant to the waitlist; a second application from the same address writes nothing. */
export async function insertApplicationIfAbsent(
  db: AppDatabase,
  input: VendorApplicationInput,
): Promise<void> {
  await db
    .insert(vendorApplications)
    .values({ ...input, email: inviteKey(input.email) })
    .onConflictDoNothing({ target: vendorApplications.email });
}

export async function findAdminApplications(db: AppDatabase): Promise<AdminVendorApplicationRow[]> {
  return db
    .select({
      id: vendorApplications.id,
      email: vendorApplications.email,
      businessName: vendorApplications.businessName,
      category: vendorApplications.category,
      city: vendorApplications.city,
      message: vendorApplications.message,
      status: vendorApplications.status,
      createdAt: vendorApplications.createdAt,
    })
    .from(vendorApplications)
    .orderBy(desc(vendorApplications.createdAt), desc(vendorApplications.id))
    .limit(MAX_VENDOR_INVITE_LIST_ROWS);
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
