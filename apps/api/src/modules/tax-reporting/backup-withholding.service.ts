import {
  BACKUP_WITHHOLDING_RATE_BPS,
  toDateString,
  type AdminVendorBackupWithholdingResult,
  type SetVendorBackupWithholding,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { conflict, notFound, validationFailed } from '../../lib/errors.js';
import { insertAdminAction } from '../admin/admin.dao.js';
import {
  lockVendorBackupWithholding,
  updateVendorBackupWithholding,
} from './backup-withholding.dao.js';

/**
 * `PUT /admin/vendors/:vendorId/backup-withholding` (VEN-723, D49).
 *
 * A state, like the payout hold: two admins converge on what they both asked
 * for, and asking for the state a vendor is already in is a 409 that writes
 * nothing. Switching it on records the reason and the notice date; clearing it
 * records the day a corrected TIN or certified W-9 was received, which the
 * schema already refuses to accept without. A date in the future is a typing
 * mistake and is refused, because both dates are what the IRS clock runs from.
 *
 * The audit row is written in the same transaction as the change.
 */
export async function setVendorBackupWithholding(
  db: AppDatabase,
  actorId: string,
  vendorId: string,
  input: SetVendorBackupWithholding,
  now: Date,
): Promise<AdminVendorBackupWithholdingResult> {
  const today = toDateString(now);
  const stated = input.withholding ? input.noticeDate : input.receivedDate;

  if (stated > today) {
    throw validationFailed(
      input.withholding
        ? 'The notice date cannot be in the future'
        : 'The received date cannot be in the future',
    );
  }

  const backupWithholding = await db.transaction(async (tx) => {
    const vendor = await lockVendorBackupWithholding(tx, vendorId);

    if (!vendor) {
      throw notFound('No storefront with that id');
    }

    const before = vendor.backupWithholding;

    if (input.withholding) {
      if (before) {
        throw conflict('Backup withholding is already on for that vendor');
      }

      const next = { reason: input.reason, noticeDate: input.noticeDate };

      await updateVendorBackupWithholding(tx, vendorId, next);
      await insertAdminAction(tx, {
        actorId,
        action: 'vendor_backup_withholding_set',
        subjectType: 'vendor_profile',
        subjectId: vendorId,
        detail: {
          reason: next.reason,
          noticeDate: next.noticeDate,
          rateBps: BACKUP_WITHHOLDING_RATE_BPS,
        },
        createdAt: now,
      });

      return next;
    }

    if (!before) {
      throw conflict('Backup withholding is not on for that vendor');
    }

    await updateVendorBackupWithholding(tx, vendorId, null);
    await insertAdminAction(tx, {
      actorId,
      action: 'vendor_backup_withholding_cleared',
      subjectType: 'vendor_profile',
      subjectId: vendorId,
      detail: {
        receivedDate: input.receivedDate,
        reason: before.reason,
        noticeDate: before.noticeDate,
      },
      createdAt: now,
    });

    return null;
  });

  return { vendorId, backupWithholding };
}
