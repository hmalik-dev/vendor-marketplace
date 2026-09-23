import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import {
  platformBalanceShortAlert,
  type AlertResult,
  type OperatorAlerts,
} from '../operator-alerts/operator-alerts.service.js';
import { readPlatformLiabilities } from './payouts.dao.js';

export interface PlatformBalanceDeps {
  db: AppDatabase;
  stripe: Pick<StripeConnectGateway, 'retrievePlatformBalance'>;
  alerts: Pick<OperatorAlerts, 'alertNow'>;
  log: FastifyBaseLogger;
}

export interface PlatformBalanceReconciliation {
  balanceCents: number;
  requiredCents: number;
  /** Null when the balance covers what is owed and nobody was told anything. */
  alert: AlertResult | null;
}

/**
 * The daily reconciliation (VEN-644): does the platform's Stripe balance,
 * available and pending, still cover the vendor payouts it has not sent and
 * what its bookings could still refund? What it has beyond that is commission
 * the operator may pay out (docs/runbook-platform-balance.md).
 *
 * Under separate charges and transfers every customer's payment waits in this
 * balance until after the event, so a payout to the platform's bank — Stripe's
 * default automatic schedule, or a manual one taken too large — spends money
 * that belongs to vendors. Nothing fails at that moment; the transfer weeks
 * later does. This says so the day it happens.
 */
export async function reconcilePlatformBalance(
  deps: PlatformBalanceDeps,
  now: Date,
): Promise<PlatformBalanceReconciliation> {
  const [balance, liabilities] = await Promise.all([
    deps.stripe.retrievePlatformBalance(),
    readPlatformLiabilities(deps.db, now),
  ]);
  const balanceCents = balance.availableCents + balance.pendingCents;
  const requiredCents = liabilities.unreleasedPayoutCents + liabilities.refundableExposureCents;
  const figures = { ...balance, ...liabilities, balanceCents, requiredCents };

  if (balanceCents >= requiredCents) {
    deps.log.info(figures, 'Platform balance covers what it owes');
    return { balanceCents, requiredCents, alert: null };
  }

  deps.log.error(figures, 'Platform balance is short of what it owes');
  const alert = await deps.alerts.alertNow(
    platformBalanceShortAlert({ date: now.toISOString().slice(0, 10), ...balance, ...liabilities }),
  );

  return { balanceCents, requiredCents, alert };
}
