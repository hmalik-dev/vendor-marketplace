import { describe, expect, it } from 'vitest';
import { PAYOUT_NOTICES } from './notify-user.js';

/*
 * The release is a Stripe transfer into the vendor's connected account
 * (`payouts.service.ts`); the move to their bank is Stripe's own schedule, which
 * this platform neither runs nor knows. A notice that says the money "has been
 * sent to your bank account" states a step the code never takes.
 */
describe('the payout notices state what the release does', () => {
  it('says the release lands in the Stripe account and that Stripe pays it on', () => {
    expect(PAYOUT_NOTICES.sent.body).toBe(
      'Your payment for a completed booking has been sent to your Stripe account. Stripe pays it on to your bank on its own schedule.',
    );
    expect(PAYOUT_NOTICES.sent.body).not.toContain('sent to your bank account');
  });

  it('restates no interval or rate, which `payoutReleaseAt` alone decides', () => {
    for (const notice of Object.values(PAYOUT_NOTICES)) {
      expect(notice.body).not.toMatch(/\d/);
    }
  });
});
