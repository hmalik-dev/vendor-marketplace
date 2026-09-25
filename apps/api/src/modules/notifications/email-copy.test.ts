import { describe, expect, it } from 'vitest';
import { composeDigestLines } from '../admin-alerts/admin-digest.service.js';
import {
  expiryPaymentUnsettledAlert,
  refundFailedAlert,
  renderAdminEmail,
} from '../admin-alerts/admin-alerts.service.js';
import { renderStepUpCodeEmail } from '../admin/admin-step-up.service.js';
import { renderSupportConfirmation } from '../support/support-email.js';
import {
  renderVendorApplicationConfirmationEmail,
  renderVendorInviteEmail,
} from '../vendor-invites/vendor-invites.service.js';

/*
 * VEN-748: the rendered subject and body of every email outside the booking
 * group, pinned whole. One fact per sentence, no justifying tail, US English.
 * A wording change fails here and has to be made on purpose.
 */

const SUPPORT = {
  reference: 'SUP-7K2M9Q',
  topic: 'booking-or-payment',
  message: 'The vendor never showed up.',
  replyTo: 'mara@example.com',
  signedIn: true,
} as const;

describe('support receipt', () => {
  it('says when we reply and nothing else about waiting', () => {
    const mail = renderSupportConfirmation(SUPPORT);

    expect(mail.subject).toBe('We got your message · SUP-7K2M9Q');
    expect(mail.text.split('\n')).toEqual([
      'Orla',
      'We got your message',
      '',
      "We'll reply to this address, usually within one business day.",
      '',
      'Reference SUP-7K2M9Q',
      'Quote this if you follow up. Here is what you sent:',
      '',
      'The vendor never showed up.',
    ]);
    expect(mail.html).toContain(
      `<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#4A443C;">We'll reply to this address, usually within one business day.</p>`,
    );
  });

  it('adds the payout hold on a booking report', () => {
    const mail = renderSupportConfirmation({
      ...SUPPORT,
      booking: {
        id: 'b-1',
        eventDate: '2026-12-19',
        totalAmountCents: 145_000,
        vendorBusinessName: 'Hopper Florals',
      },
    });

    expect(mail.text.split('\n').slice(3, 6)).toEqual([
      "We'll reply to this address, usually within one business day.",
      '',
      "We've put the vendor's payout for this booking on hold while we look into it.",
    ]);
  });
});

describe('vendor invite', () => {
  it('tells a new vendor to sign up with the invited address', () => {
    const mail = renderVendorInviteEmail('https://orla.test', 'mara@example.com', false);

    expect(mail.subject).toBe("You're invited to join Orla as a vendor");
    expect(mail.text.split('\n')).toEqual([
      "You're invited to join Orla as a vendor.",
      '',
      'Sign up with mara@example.com to open your vendor account.',
      'Then set your prices, add your work and open the dates you want booked.',
      '',
      'https://orla.test/sign-up?role=vendor',
      '',
      "Your business was put forward to join Orla. If you'd rather not, ignore this email.",
    ]);
  });

  it('tells a waitlisted vendor to sign in with what they made', () => {
    const mail = renderVendorInviteEmail('https://orla.test', 'mara@example.com', true);

    expect(mail.text.split('\n')).toEqual([
      "You're invited to join Orla as a vendor.",
      '',
      'Sign in with the email and password you already made to open your vendor account.',
      'Then set your prices, add your work and open the dates you want booked.',
      '',
      'https://orla.test/sign-in',
      '',
      "You asked to join Orla as a vendor. If that wasn't you, ignore this email.",
    ]);
  });

  it('confirms the waitlist with the saved facts', () => {
    const mail = renderVendorApplicationConfirmationEmail({
      businessName: 'Hopper Florals',
      categoryName: 'Florist',
      city: 'Austin',
      state: 'TX',
      email: 'mara@example.com',
    });

    expect(mail.subject).toBe("You're on the Orla waitlist");
    expect(mail.text.split('\n')).toEqual([
      "We saved your details. We'll email you when you're invited. Then sign in with this same address.",
      '',
      'Business: Hopper Florals',
      'Category: Florist',
      'Where: Austin, Texas',
      'Email: mara@example.com',
      '',
      "If any of that is wrong, reply to this email and we'll fix it.",
      '',
      'You signed up to join Orla as a vendor.',
    ]);
  });
});

describe('admin alert', () => {
  it('renders a refund that went out on a booking it could not cancel', () => {
    const alert = refundFailedAlert({
      bookingId: 'bk_1',
      during: 'a cancellation',
      refundId: 're_1',
    });
    const mail = renderAdminEmail({ ...alert, link: 'https://orla.test/admin/bookings' });

    expect(mail.subject).toBe('[Orla ops] Refund sent but booking bk_1 could not be updated');
    expect(mail.text.split('\n')).toEqual([
      'Refund sent but booking bk_1 could not be updated',
      '',
      'A refund sent during a cancellation went out, but the booking changed underneath it and could not be canceled. The customer is refunded. Check whether the vendor was also paid.',
      'Booking: bk_1',
      'Refund: re_1',
      'Open: https://orla.test/admin/bookings',
    ]);
  });

  it('renders a refund that did not go through', () => {
    expect(refundFailedAlert({ bookingId: 'bk_1', during: 'a dispute' }).details[0]).toBe(
      "A refund attempted during a dispute did not go through. The customer's money has not moved.",
    );
  });

  it('renders an expired request whose payment Stripe would not settle', () => {
    expect(
      expiryPaymentUnsettledAlert({ requestId: 'rq_1', paymentIntentId: 'pi_1', attempts: 3 })
        .details,
    ).toEqual([
      "The payment window closed. For 3 checks in a row, Stripe could not confirm the payment or still reported it processing. The request expired and the vendor's date is open again.",
      'The payment intent has not been canceled or refunded. If it succeeds later, the usual path refunds it. Check it in Stripe.',
      'Request: rq_1',
      'Payment intent: pi_1',
    ]);
  });
});

describe('daily digest', () => {
  it('renders a day with activity', () => {
    const mail = renderAdminEmail({
      summary: 'Daily digest for 2026-09-14',
      details: composeDigestLines({
        signups: [
          { role: 'customer', count: 3 },
          { role: 'vendor', count: 1 },
        ],
        requests: 4,
        payments: { count: 2, totalCents: 290_000 },
        refunds: { count: 1, totalCents: 72_500 },
        payouts: { count: 1, totalCents: 130_500 },
        openCases: { underOneDay: 1, oneToThreeDays: 0, overThreeDays: 2 },
        bounces: 0,
        unpaidSoon: [{ requestId: 'rq_1', eventDate: '2026-09-15' }],
        overduePayouts: 1,
      }),
      link: 'https://orla.test/admin',
    });

    expect(mail.subject).toBe('[Orla ops] Daily digest for 2026-09-14');
    expect(mail.text.split('\n')).toEqual([
      'Daily digest for 2026-09-14',
      '',
      'Last 24 hours',
      'New sign-ups: 3 customer, 1 vendor',
      'Booking requests: 4',
      'Payments: 2 totalling $2,900',
      'Refunds: 1 totalling $725',
      'Payouts released: 1 totalling $1,305',
      'Bounced emails: 0',
      'Open cases',
      'Under 1 day: 1; 1–3 days: 0; over 3 days: 2',
      'Accepted but unpaid, event today or in the next 2 days: 1',
      '  Request rq_1, event 2026-09-15',
      'Payouts overdue by more than one sweep: 1',
      'Open: https://orla.test/admin',
    ]);
  });
});

describe('step-up code', () => {
  it('gives the code, how long it works, and what to do if it was not asked for', () => {
    const mail = renderStepUpCodeEmail('482913');

    expect(mail.subject).toBe('Orla confirmation code');
    expect(mail.text).toBe(
      [
        'Your Orla confirmation code is 482913.',
        '',
        "It works for 10 minutes. Didn't ask for it? Someone has your session. Sign out everywhere and reset your password.",
      ].join('\n'),
    );
    expect(mail.html).toBe(
      "<p>Your Orla confirmation code is 482913.</p><p>It works for 10 minutes. Didn't ask for it? Someone has your session. Sign out everywhere and reset your password.</p>",
    );
  });
});
