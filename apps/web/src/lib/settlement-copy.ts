import { BRAND_NAME, formatPrice } from '@vendor-marketplace/shared';
import type { WireBookingRequest } from '@/lib/wire-schemas';

/**
 * What a cancelled booking says about itself, to each side (#415).
 *
 * A cancelled request used to render one neutral sentence — "This request was
 * cancelled." — over three different events, on a row where money had moved
 * and come back. The sentence before it was worse: "You withdrew this
 * request.", told to a customer an operator had just refunded.
 *
 * The three are told apart structurally, not by reading copy back out of the
 * database:
 *
 * | Case                          | Shape                                |
 * | ----------------------------- | ------------------------------------ |
 * | Withdrawn before acceptance   | no settlement — no booking was made  |
 * | Cancelled after payment       | `cancelledBy: 'customer'`            |
 * | Unwound by an operator        | `cancelledBy: 'admin'`               |
 *
 * A fourth shape exists and is not a case: a booking cancelled before those
 * columns were written carries `cancelledBy: null`. It gets a sentence that
 * names no actor, because the row genuinely does not know who acted and
 * guessing is how the first defect happened.
 *
 * One module for both audiences, because the facts are one set and only the
 * pronouns differ — and two copies of "what happened to the money" is how the
 * customer's screen and the vendor's come to disagree about a refund.
 */

export type SettlementAudience = 'customer' | 'vendor';

export type Settlement = NonNullable<WireBookingRequest['settlement']>;

export interface CancellationNarrative {
  /** What happened, and who did it. Always present. */
  what: string;
  /** What the money did. `null` when no money was ever taken. */
  money: string | null;
}

/*
 * `timeZone: 'UTC'`, like every other formatter in the app. Without it the
 * customer's client-rendered screen and the vendor's server-rendered one would
 * put the same instant on different days, which is the two-screens-disagreeing
 * failure this module exists to prevent.
 */
const CANCELLED_ON = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** What a full refund is called, so the two audiences say it the same way. */
const ALL_OF_IT = 'all of it';

/** " on May 2", or nothing at all on a row that never recorded the moment. */
function onDate(cancelledAt: Date | null): string {
  return cancelledAt ? ` on ${CANCELLED_ON.format(cancelledAt)}` : '';
}

function whatHappened(settlement: Settlement, audience: SettlementAudience): string {
  const when = onDate(settlement.cancelledAt);

  if (settlement.cancelledBy === 'admin') {
    /*
     * The same sentence to both, and deliberately not "the *other* account".
     *
     * `cancelledBy: 'admin'` records who acted, not which side was suspended,
     * and `setUserBanned` unwinds a booking whichever party it banned. Naming
     * the other side reads as true only while the ban lasts — a ban is
     * reversible, an unban does not revisit the rows it cancelled, and the
     * reinstated account then opens its own booking and is told the
     * counterparty was suspended. That is false about the reader and a
     * fabricated moderation claim about a third party, from a column that
     * never recorded the direction.
     */
    return `${BRAND_NAME} cancelled this booking${when}, because an account involved was suspended.`;
  }

  if (settlement.cancelledBy === 'customer') {
    return audience === 'customer'
      ? `You cancelled this booking${when}.`
      : `The customer cancelled this booking${when}.`;
  }

  return `This booking was cancelled${when}.`;
}

function whatTheMoneyDid(settlement: Settlement, audience: SettlementAudience): string | null {
  const paid = formatPrice(settlement.totalAmountCents);
  const { refundAmountCents } = settlement;
  const payer = audience === 'customer' ? 'You' : 'They';

  /*
   * A booking with no `paidAt` was never charged, so there is nothing to
   * account for — and saying "You paid $1,450" about it would be the same
   * class of untruth this module exists to end. Reachable through the admin
   * unwind, whose own notification already branches on whether money moved.
   */
  if (settlement.paidAt === null) {
    return null;
  }

  if (refundAmountCents === null) {
    /*
     * Said plainly rather than smoothed over. A booking with no refund on
     * record is either one this product cancelled before it wrote the figure
     * down, or one whose refund never went through — and both are states the
     * person reading needs to know they are in, not ones to paper over with
     * "refunded in full".
     */
    return `${payer} paid ${paid}. This booking has no refund on record.`;
  }

  /* "all of it" rather than the figure again — the whole amount is the fact,
     and repeating the number reads like a second, different one. */
  const refunded =
    refundAmountCents === settlement.totalAmountCents ? ALL_OF_IT : formatPrice(refundAmountCents);

  if (audience === 'customer') {
    return `You paid ${paid}, and ${refunded} was refunded to your original payment method.`;
  }

  /*
   * The reversal is named here for the same reason D31 names it in the
   * notification: a destination charge takes the vendor's share back out of
   * their Stripe balance, and a vendor reading their own cancelled booking
   * should not have to discover that on a statement.
   */
  return refunded === ALL_OF_IT
    ? `They paid ${paid} and were refunded all of it. Your share was reversed out of your Stripe balance.`
    : `They paid ${paid} and were refunded ${refunded}. The same share of your payout was reversed out of your Stripe balance.`;
}

/**
 * The two sentences a cancelled request has to say.
 *
 * `settlement` is `null` for a request withdrawn before it was ever accepted,
 * which is the one case where nothing was taken and so nothing is owed an
 * explanation about money.
 */
export function cancellationNarrative(
  settlement: Settlement | null,
  audience: SettlementAudience,
): CancellationNarrative {
  if (!settlement) {
    return {
      what:
        audience === 'customer'
          ? 'You withdrew this request before it was accepted.'
          : 'The customer withdrew this request before it was accepted.',
      money: null,
    };
  }

  return {
    what: whatHappened(settlement, audience),
    money: whatTheMoneyDid(settlement, audience),
  };
}
