import {
  payoutReleaseAt,
  payoutStatusOf,
  type PayoutAccount,
  type VendorPayoutRow,
  type VendorPayouts,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import { findVendorDebtTotals } from '../payments/payouts.dao.js';
import {
  findNextPendingPayout,
  findOwedPayoutTotals,
  findPayoutRows,
  type PayoutRow,
} from './dashboard.dao.js';
import { toPayoutSummary } from './dashboard.service.js';
import { requireOwnVendorProfile } from './vendors.service.js';

export interface VendorPayoutsDeps {
  db: AppDatabase;
  stripe: Pick<StripeConnectGateway, 'readPayoutAccount'>;
  log: { warn: (details: Record<string, unknown>, message: string) => void };
}

/**
 * The vendor's payments page (VEN-768, frame `49`): the dashboard's payout
 * summary, the rows behind it, and the bank Stripe pays out to.
 *
 * The summary is `toPayoutSummary` over the same reads the dashboard makes, so
 * the two screens cannot disagree about what is owed or when it pays out.
 */
export async function getVendorPayouts(
  deps: VendorPayoutsDeps,
  userId: string,
  now: Date,
): Promise<VendorPayouts> {
  const vendor = await requireOwnVendorProfile(deps.db, userId);

  const [owedTotals, nextPending, debtTotals, rows, account] = await Promise.all([
    findOwedPayoutTotals(deps.db, vendor.id),
    findNextPendingPayout(deps.db, vendor.id),
    findVendorDebtTotals(deps.db, vendor.id),
    findPayoutRows(deps.db, vendor.id),
    readPayoutAccount(deps, vendor.id, vendor.stripeAccountId),
  ]);

  return {
    summary: toPayoutSummary(
      owedTotals,
      nextPending,
      debtTotals,
      now,
      vendor.backupWithholdingReason !== null,
    ),
    nextBookingId: nextPending?.bookingId ?? null,
    account,
    rows: rows.map(toPayoutRow),
  };
}

/**
 * The payout bank from Stripe. A failed read is `null`, never a guess: the
 * card then says the account is managed in Stripe.
 */
async function readPayoutAccount(
  deps: VendorPayoutsDeps,
  vendorId: string,
  stripeAccountId: string | null,
): Promise<PayoutAccount | null> {
  if (!stripeAccountId) {
    return null;
  }

  try {
    return await deps.stripe.readPayoutAccount(stripeAccountId);
  } catch (error) {
    deps.log.warn({ vendorId, err: error }, 'Could not read the vendor payout account from Stripe');

    return null;
  }
}

/** A released row reports what was sent; an owed one what is still owed. */
function toPayoutRow(row: PayoutRow): VendorPayoutRow {
  const payoutStatus = payoutStatusOf({
    status: row.status,
    residualHeld: row.residualHeld,
    payoutReleasedAt: row.payoutReleasedAt,
  });
  const cents =
    payoutStatus === 'released'
      ? Math.max(0, row.vendorPayoutCents - row.debtNettedCents - row.backupWithheldCents)
      : row.vendorPayoutCents;

  return {
    bookingId: row.bookingId,
    customerName: row.customerLastName.trim() || row.customerFirstName.trim(),
    eventType: row.eventType,
    eventDate: row.eventDate,
    cents,
    payoutStatus,
    releaseAt: payoutStatus === 'held' ? null : payoutReleaseAt(row.eventDate),
    paidAt: row.payoutReleasedAt,
  };
}
