import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { cancellationNarrative, type Settlement } from './settlement-copy';

function settlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    bookingId: 'bk-1',
    status: 'cancelled',
    totalAmountCents: 145_000,
    paidAt: new Date('2026-05-02T00:00:00Z'),
    cancelledAt: new Date('2026-06-01T12:00:00Z'),
    cancelledBy: 'customer',
    refundAmountCents: 145_000,
    ...overrides,
  };
}

/*
 * The three ways a request reaches `cancelled` read identically on the request
 * row, and one sentence covered all of them: first "You withdrew this
 * request." — false for a paid booking an operator unwound — and then "This
 * request was cancelled.", which is never false and never says what happened
 * to the money (#415).
 */
describe('cancellationNarrative', () => {
  describe('the three origins', () => {
    it('names a withdrawal by the absence of a booking', () => {
      const { what, money } = cancellationNarrative(null, 'customer');

      expect(what).toBe('You withdrew this request before it was accepted.');
      // Nothing was ever taken, so there is nothing to account for.
      expect(money).toBeNull();
    });

    it('names the customer when they cancelled the booking themselves', () => {
      expect(cancellationNarrative(settlement(), 'customer').what).toBe(
        'You cancelled this booking on June 1, 2026.',
      );
    });

    /*
     * The same sentence to both sides, and it must not name which one was
     * suspended: `cancelledBy` records who acted, and a ban unwinds a booking
     * whichever party it banned. A reinstated account reading its own booking
     * would otherwise be told the counterparty was suspended.
     */
    it('names the operator without claiming which account was suspended', () => {
      const unwound = settlement({ cancelledBy: 'admin' });
      const sentence = `${BRAND_NAME} cancelled this booking on June 1, 2026, because an account involved was suspended.`;

      expect(cancellationNarrative(unwound, 'customer').what).toBe(sentence);
      expect(cancellationNarrative(unwound, 'vendor').what).toBe(sentence);
      expect(cancellationNarrative(unwound, 'customer').what).not.toContain('the other account');
    });

    /*
     * The fourth shape, and not a fourth case: a booking cancelled before the
     * column existed does not know who acted. Guessing one of the two is the
     * exact defect this function was written to end.
     */
    it('names no actor on a row that does not record one', () => {
      expect(cancellationNarrative(settlement({ cancelledBy: null }), 'customer').what).toBe(
        'This booking was cancelled on June 1, 2026.',
      );
    });

    it('drops the date rather than printing one it does not have', () => {
      expect(cancellationNarrative(settlement({ cancelledAt: null }), 'customer').what).toBe(
        'You cancelled this booking.',
      );
    });
  });

  describe('what the money did', () => {
    it('states the amount paid and a full refund', () => {
      expect(cancellationNarrative(settlement(), 'customer').money).toBe(
        'You paid $1,450, and all of it was refunded to your original payment method.',
      );
    });

    it('states a partial refund as partial', () => {
      expect(
        cancellationNarrative(settlement({ refundAmountCents: 72_500 }), 'customer').money,
      ).toBe('You paid $1,450, and $725 was refunded to your original payment method.');
    });

    /*
     * Said plainly rather than smoothed over. A row with no refund recorded is
     * either one cancelled before this figure was written down or one whose
     * refund never went through, and both are states the reader needs.
     */
    it('does not invent a refund for a row that records none', () => {
      expect(cancellationNarrative(settlement({ refundAmountCents: null }), 'customer').money).toBe(
        'You paid $1,450. This booking has no refund on record.',
      );
    });

    /*
     * And does not invent the *payment* either. An admin unwind cancels
     * unpaid bookings too — its own notification branches on whether money
     * moved — so "You paid $1,450" about one nobody was charged for is the
     * same class of untruth, one field over.
     */
    it('says nothing about money on a booking that was never charged', () => {
      const unpaid = settlement({ paidAt: null, refundAmountCents: null });

      expect(cancellationNarrative(unpaid, 'customer').money).toBeNull();
      expect(cancellationNarrative(unpaid, 'vendor').money).toBeNull();
      /* The cancellation itself is still described. */
      expect(cancellationNarrative(unpaid, 'customer').what).toContain('cancelled this booking');
    });
  });

  describe('the vendor reads the same facts in their own person', () => {
    it('attributes the cancellation to the customer', () => {
      expect(cancellationNarrative(settlement(), 'vendor').what).toBe(
        'The customer cancelled this booking on June 1, 2026.',
      );
    });

    it('withdraws are the customer’s, not the vendor’s', () => {
      expect(cancellationNarrative(null, 'vendor').what).toBe(
        'The customer withdrew this request before it was accepted.',
      );
    });

    /*
     * D31: the unwind reverses the vendor's share out of their Stripe balance,
     * and the ruling requires the product to say so rather than leave it to be
     * discovered on a statement.
     */
    it('names the payout reversal, which is what a refund does to the vendor', () => {
      expect(cancellationNarrative(settlement(), 'vendor').money).toBe(
        'They paid $1,450 and were refunded all of it. Your share was reversed out of your Stripe balance.',
      );
    });

    it('names the proportional reversal on a partial refund', () => {
      expect(cancellationNarrative(settlement({ refundAmountCents: 72_500 }), 'vendor').money).toBe(
        'They paid $1,450 and were refunded $725. The same share of your payout was reversed out of your Stripe balance.',
      );
    });
  });
});
