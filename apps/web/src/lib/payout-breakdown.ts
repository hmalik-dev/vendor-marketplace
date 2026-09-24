import { backupWithholdingCents } from '@vendor-marketplace/shared';

export interface PayoutBreakdown {
  /** Kept for the IRS while an admin has backup withholding on (VEN-723). */
  withheldCents: number;
  /** Kept back from what is left to repay a lost chargeback (VEN-658). */
  keptBackCents: number;
  /** What the transfer sends: the share less both. */
  sentCents: number;
}

/**
 * What one payout is reduced by, in the order the sweep applies it: withholding
 * comes off the share first, and debt is kept back from what is left. The
 * figure the card prints is therefore the transfer's own.
 */
export function payoutBreakdown(
  shareCents: number,
  outstandingDebtCents: number,
  backupWithholding: boolean,
): PayoutBreakdown {
  const withheldCents = backupWithholding ? backupWithholdingCents(shareCents) : 0;
  const keptBackCents = Math.min(shareCents - withheldCents, outstandingDebtCents);

  return { withheldCents, keptBackCents, sentCents: shareCents - withheldCents - keptBackCents };
}
