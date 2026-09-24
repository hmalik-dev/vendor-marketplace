import { vendorProfiles } from '@vendor-marketplace/db/schema';
import type { VendorBackupWithholding } from '@vendor-marketplace/shared';
import { eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '../../lib/database.js';

/**
 * The vendor's withholding state, locked for the caller's transaction. `null`
 * when there is no such vendor; `backupWithholding` is `null` when it is off.
 */
export async function lockVendorBackupWithholding(
  tx: AppDatabase,
  vendorId: string,
): Promise<{ backupWithholding: VendorBackupWithholding | null } | null> {
  const rows = await tx
    .select({
      reason: vendorProfiles.backupWithholdingReason,
      noticeDate: vendorProfiles.backupWithholdingNoticeDate,
    })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.id, vendorId))
    .for('no key update')
    .limit(1);
  const row = rows?.[0];

  if (!row) {
    return null;
  }

  return {
    backupWithholding:
      row.reason && row.noticeDate ? { reason: row.reason, noticeDate: row.noticeDate } : null,
  };
}

/** Switches withholding on with its reason and notice date, or off with `null`. */
export async function updateVendorBackupWithholding(
  tx: AppDatabase,
  vendorId: string,
  backupWithholding: VendorBackupWithholding | null,
): Promise<void> {
  await tx
    .update(vendorProfiles)
    .set({
      backupWithholdingReason: backupWithholding?.reason ?? null,
      backupWithholdingNoticeDate: backupWithholding?.noticeDate ?? null,
      updatedAt: sql`now()`,
    })
    .where(eq(vendorProfiles.id, vendorId));
}
