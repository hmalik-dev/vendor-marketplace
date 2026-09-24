import { asc, eq, sql } from 'drizzle-orm';
import {
  platformSettings,
  users,
  vendorProfiles,
  type PlatformSettingsRow,
} from '@vendor-marketplace/db/schema';
import {
  PLATFORM_SETTINGS_ID,
  type AdminHeldVendor,
  type PlatformSwitches,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/** The switches as stored, or `null` before anyone has changed one. */
export async function findPlatformSettings(db: AppDatabase): Promise<PlatformSettingsRow | null> {
  const rows = await db.select().from(platformSettings).limit(1);

  return rows?.[0] ?? null;
}

/** The row with the name of the operator who last changed it. */
export async function findPlatformSettingsWithEditor(
  db: AppDatabase,
): Promise<{ row: PlatformSettingsRow; updatedByName: string | null } | null> {
  const rows = await db
    .select({
      row: platformSettings,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(platformSettings)
    .leftJoin(users, eq(platformSettings.updatedBy, users.id))
    .limit(1);
  const found = rows?.[0];

  if (!found) {
    return null;
  }

  const updatedByName =
    found.firstName === null || found.lastName === null
      ? null
      : `${found.firstName} ${found.lastName}`.trim();

  return { row: found.row, updatedByName };
}

/**
 * Creates the row if it is missing and takes its lock, in the caller's
 * transaction, so two operators flipping at once each read the other's result
 * as their "before".
 */
export async function lockPlatformSettings(tx: AppDatabase): Promise<PlatformSettingsRow> {
  await tx.insert(platformSettings).values({ id: PLATFORM_SETTINGS_ID }).onConflictDoNothing();

  const rows = await tx
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .for('update')
    .limit(1);
  const row = rows?.[0];

  if (!row) {
    throw new Error('platform_settings row missing after upsert');
  }

  return row;
}

export async function updatePlatformSettingsRow(
  tx: AppDatabase,
  values: Partial<PlatformSwitches & Pick<PlatformSettingsRow, 'noticeMessage' | 'noticeTone'>> & {
    updatedBy: string;
  },
): Promise<void> {
  await tx
    .update(platformSettings)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID));
}

/** Every vendor an operator is holding payouts for, by name. */
export async function findHeldVendors(db: AppDatabase): Promise<AdminHeldVendor[]> {
  return db
    .select({
      id: vendorProfiles.id,
      businessName: vendorProfiles.businessName,
      slug: vendorProfiles.slug,
    })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.payoutHold, true))
    .orderBy(asc(vendorProfiles.businessName));
}

/** The vendor's current hold, locked for the caller's transaction; `null` when no such vendor. */
export async function lockVendorPayoutHold(
  tx: AppDatabase,
  vendorId: string,
): Promise<{ payoutHold: boolean } | null> {
  const rows = await tx
    .select({ payoutHold: vendorProfiles.payoutHold })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.id, vendorId))
    .for('no key update')
    .limit(1);

  return rows?.[0] ?? null;
}

export async function updateVendorPayoutHold(
  tx: AppDatabase,
  vendorId: string,
  payoutHold: boolean,
): Promise<void> {
  await tx
    .update(vendorProfiles)
    .set({ payoutHold, updatedAt: sql`now()` })
    .where(eq(vendorProfiles.id, vendorId));
}
