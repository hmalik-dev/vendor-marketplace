import { formatPrice } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import { externalRefundAlert, type AdminAlerts } from '../admin-alerts/admin-alerts.service.js';
import { findBookingIdByPaymentIntent } from '../admin-alerts/admin-alerts.dao.js';
import { recordExternalRefund, type ExternalRefundFinding } from './refunds.dao.js';

export type RefundReconciliation = 'refund-unchanged' | 'refund-held' | 'refund-recorded';

export interface RefundReconciliationDeps {
  db: AppDatabase;
  stripe: Pick<StripeConnectGateway, 'findRefund'>;
  alerts?: Pick<AdminAlerts, 'dispatch'>;
}

/** The sentence the booking carries while it is held, and the admin reads on it. */
export function externalRefundReason(externalCents: number): string {
  return `${formatPrice(externalCents)} was refunded at Stripe outside the platform, so the payout is on hold until an admin rules`;
}

/** Tells the admin, once per booking and total — the alert's own dedupe is the guard. */
export function announceExternalRefund(
  alerts: Pick<AdminAlerts, 'dispatch'> | undefined,
  bookingId: string,
  finding: ExternalRefundFinding,
): void {
  alerts?.dispatch(
    externalRefundAlert({
      bookingId,
      externalCents: finding.externalCents,
      outcome: finding.outcome,
      payoutReleased: finding.payoutReleased,
    }),
  );
}

/**
 * `charge.refunded` (VEN-469): compares what Stripe has refunded on the intent
 * with what the booking records, and holds the payout when Stripe holds more.
 *
 * Our own refunds are told apart by the marker they carry, so the event Stripe
 * echoes for a cancellation the route is still writing changes nothing. A
 * duplicate delivery finds the difference already recorded.
 */
export async function reconcileRefundedIntent(
  deps: RefundReconciliationDeps,
  paymentIntentId: string,
): Promise<RefundReconciliation> {
  const bookingId = await findBookingIdByPaymentIntent(deps.db, paymentIntentId);

  if (!bookingId) {
    return 'refund-unchanged';
  }

  const found = await deps.stripe.findRefund(paymentIntentId);

  if (!found) {
    return 'refund-unchanged';
  }

  const finding = await recordExternalRefund(deps.db, bookingId, found, externalRefundReason);

  if (!finding) {
    return 'refund-unchanged';
  }

  announceExternalRefund(deps.alerts, bookingId, finding);

  return finding.outcome === 'held' ? 'refund-held' : 'refund-recorded';
}
