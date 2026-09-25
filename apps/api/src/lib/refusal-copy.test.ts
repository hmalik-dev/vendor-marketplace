import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SERVICE_PACKAGE_MODERATION_HOLD_MESSAGE,
  VENDOR_PROFILE_MODERATION_HOLD_MESSAGE,
} from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * VEN-748: the refusals and alert lines whose paths no route test reaches
 * cheaply, pinned exactly as written in their source. Each is a whole string
 * literal, quotes included, so a rewording or a stray British spelling fails
 * here. The rest of the rewritten copy is pinned by the route tests and by
 * `modules/notifications/email-copy.test.ts`.
 */
const modules = join(import.meta.dirname, '../modules');

const PINNED: Record<string, string[]> = {
  'lib/stream-tickets.ts': ["'Too many live-update tickets are open. Try again shortly.'"],
  'admin-alerts/admin-alerts.service.ts': [
    "'No case was opened and no payout was held. Stripe has debited the platform. Check the Stripe dashboard before the evidence deadline.'",
    '`Stripe disabled connected account ${stripeAccountId}. Payouts to this vendor fail until it is fixed.`',
    "'Confirm the platform payout schedule is manual. Then find what left the balance: a payout, a refund or a dispute. Runbook: docs/runbook-platform-balance.md.'",
    "'The payout was already released, so nothing was held. Decide whether to recover it from the vendor.'",
    '"The booking could not be put on hold, so this run did not send the payout. The next sweep sends it unless you hold the vendor\'s payouts from their page."',
    "`Stripe marked the ${formatPrice(input.amountCents)} refund ${input.status} after accepting it. The customer's money has not moved.`",
    "'The refund failed. Stripe will redeliver the event.'",
  ],
  'admin/admin.service.ts': [
    '"Only a review of a vendor can be hidden or shown. This is a vendor\'s private note about a customer. Delete it instead."',
  ],
  'admin/data-rights.service.ts': [
    "`This account holds ${blocked.length} upcoming confirmed ${one ? 'booking' : 'bookings'}. ` +",
    "`Cancel ${one ? 'it' : 'them'} from the booking screens first. That prices the refund; closing the account does not.`",
  ],
  'admin/admins.service.ts': [
    "'More than one active account holds that address.'",
    "'A suspended account cannot be made an admin.'",
    '"The sign-in provider has not confirmed this account\'s new address yet."',
  ],
  'availability/availability.service.ts': [
    '`${readableDate(pending[0]!)} has an open request. Block it once the request is answered or lapses.`',
    '`${pending.length} of those dates have open requests. Block them once the requests are answered or lapse.`',
  ],
  'cases/cases.service.ts': [
    "'This case holds a payout. Resolve it for the vendor or the customer instead.'",
    '"The card network ruled against the platform and took this payment back. The vendor\'s remaining share cannot be paid out."',
    '"This case holds the vendor\'s remaining share while the chargeback is with the card network. Close it once the network rules in the platform\'s favor."',
  ],
  'legal/terms.service.ts': [
    '`The current Terms are ${CURRENT_TERMS_VERSION}. Reload and read them before accepting.`',
  ],
  'vendors/legal-agreement.service.ts': [
    '`The current agreement is ${CURRENT_VENDOR_AGREEMENT_VERSION}. Reload and read it before accepting.`',
  ],
  'payments/payouts.service.ts': [
    "'The vendor was paid when the card succeeded. No transfer is owed.'",
    '`This payout is not due yet. It is released ${PAYOUT_RELEASE_HOURS} hours after the event.`',
  ],
  'platform-settings/platform-settings.service.ts': [
    '`Bookings are limited to a price${cap} during the beta. This one is ${formatPrice(priceCents)}.`',
  ],
  'uploads/uploads.routes.ts': [
    '`Image is larger than the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit.`',
  ],
  'vendor-invites/vendor-invites.service.ts': [
    "'That applicant is already invited. Revoke the invite instead.'",
    "'That address is already invited. Revoke the invite instead.'",
    "'This applicant has not given a business name, category and city yet. Invite by email instead, or wait for them to finish the form.'",
  ],
};

describe('refusal copy', () => {
  for (const [file, literals] of Object.entries(PINNED)) {
    it(`${file} says each refusal as written`, () => {
      const path = file.startsWith('lib/')
        ? join(import.meta.dirname, file.slice('lib/'.length))
        : join(modules, file);
      const source = readFileSync(path, 'utf8');

      for (const literal of literals) {
        expect(source).toContain(literal);
      }
    });
  }

  it('says a moderated storefront or package in two short sentences', () => {
    expect(VENDOR_PROFILE_MODERATION_HOLD_MESSAGE).toBe(
      'Our team took this storefront off search. Contact support to publish it again.',
    );
    expect(SERVICE_PACKAGE_MODERATION_HOLD_MESSAGE).toBe(
      'Our team took this package off your storefront. Contact support to switch it back on.',
    );
  });
});
