import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  operatorAlerts,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  DEFAULT_PLATFORM_FEE_RATE,
  ERROR_CODES,
  paymentDeadline,
  toDateString,
  formatPrice,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  TEST_ENV,
  type TestHarness,
} from '../../testing/test-server.js';
import { expireLapsedRequests } from '../booking-requests/booking-requests.service.js';
import { bookingContextFor, expiryGuardFor } from './payments.service.js';

const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';
const OUTSIDER = 'user_customer_two';

/** $1,450 — the frame's own figure, so a wrong split is visible as a wrong price. */
const PRICE_CENTS = 145_000;
const EXPECTED_FEE_CENTS = 17_400;
const EXPECTED_PAYOUT_CENTS = 127_600;

/**
 * One fixed timeline, moved deliberately rather than read from the wall clock.
 *
 * Two assertions here are about which side of the 48-hour cutoff a cancellation
 * falls on, and one is about an event having already happened — all three are
 * answers that change with the moment the suite runs. `clockNow` is what the
 * server reads, so a test that needs the event to be in the past advances time
 * past it instead of back-dating a row into a state the app could not have
 * produced: a request for a past date is refused at creation, which is correct
 * and is why `PAST_DATE` cannot simply be handed to the booking route.
 */
const START = new Date('2026-06-01T12:00:00Z');
const EVENT_DATE = toDateString(addDays(START, 30));
let clockNow = START;

describe('payments', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function inject(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    actor: string | null,
    payload?: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method,
      url,
      ...(actor ? { headers: bearer(actor) } : {}),
      ...(payload ? { payload } : {}),
    });
  }

  /** A published, payout-ready vendor with one package. */
  async function createVendor(
    acceptsAgreement = true,
  ): Promise<{ vendorId: string; packageId: string }> {
    const profile = await inject('POST', '/vendor/profile', VENDOR, {
      businessName: 'Sunlit Studio',
      categoryIds: [photographyId],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    expect(profile.statusCode).toBe(201);
    const vendorId: string = profile.json().id;

    const created = await inject('POST', '/vendor/packages', VENDOR, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: PRICE_CENTS,
      priceType: 'fixed',
      durationHours: 6,
      inclusions: ['6 hours'],
    });
    expect(created.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    /*
     * A vendor cannot take payment until they hold the current vendor
     * agreement (#427), so a fixture that skips this is a vendor checkout
     * correctly refuses. Accepted through the real route rather than inserted,
     * because that is how a vendor reaches this state — and optional, so the
     * refusal has a fixture of its own rather than being simulated by editing
     * a row the database will not let anybody edit.
     */
    if (acceptsAgreement) {
      const accepted = await inject('POST', '/vendor/agreement/accept', VENDOR, {
        version: CURRENT_VENDOR_AGREEMENT_VERSION,
      });
      expect(accepted.statusCode).toBe(200);
    }

    return { vendorId, packageId: created.json().id };
  }

  /** A request the vendor has accepted — the only state checkout opens on. */
  async function acceptedRequest(eventDate = EVENT_DATE, acceptsAgreement = true): Promise<string> {
    const { vendorId, packageId } = await createVendor(acceptsAgreement);

    const request = await inject('POST', '/booking-requests', CUSTOMER, {
      vendorId,
      packageId,
      eventDate,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      guestCount: 120,
    });
    expect(request.statusCode).toBe(201);

    if (acceptsAgreement) {
      const accepted = await inject(
        'POST',
        `/booking-requests/${request.json().id}/accept`,
        VENDOR,
      );
      expect(accepted.statusCode).toBe(200);
    } else {
      /*
       * Accepting refuses a vendor without the agreement (VEN-428), so the only
       * way to reach this state is a request accepted before the agreement was
       * bumped. Written as the accept would have, straight to the row.
       */
      await harness.database.db
        .update(bookingRequests)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
          expiresAt: paymentDeadline(new Date(), eventDate),
        })
        .where(eq(bookingRequests.id, request.json().id));
    }

    return request.json().id;
  }

  /** Opens checkout and settles the charge, as confirming the card would. */
  /** Delivers the succeeded event again, without asserting the answer. */
  function redeliver(intentId: string): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    harness.stripe.nextEvent = {
      type: 'payment_intent.succeeded',
      accountId: null,
      objectId: intentId,
    };

    return harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: { id: 'evt_test', type: 'payment_intent.succeeded' },
    });
  }

  async function payFor(requestId: string): Promise<string> {
    const checkout = await inject(
      'POST',
      `/customer/booking-requests/${requestId}/checkout`,
      CUSTOMER,
    );
    expect(checkout.statusCode).toBe(200);

    const intentId: string = checkout.json().paymentIntentId;
    harness.stripe.succeed(intentId);
    harness.stripe.nextEvent = {
      type: 'payment_intent.succeeded',
      accountId: null,
      objectId: intentId,
    };

    const webhook = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: { id: 'evt_test', type: 'payment_intent.succeeded' },
    });
    expect(webhook.statusCode).toBe(200);

    return intentId;
  }

  /**
   * A paid booking whose event has since happened — the state completion needs.
   * The clock moves forward rather than the row moving backward, because the
   * booking route refuses a past date and a hand-written one would be a state
   * the application cannot reach.
   */
  async function pastBooking(): Promise<{ id: string; customerId: string }> {
    const requestId = await acceptedRequest();
    await payFor(requestId);
    clockNow = addDays(START, 31);

    const [booking] = await harness.database.db.select().from(bookings);

    return { id: booking!.id, customerId: booking!.customerId };
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => clockNow });

    for (const [authUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
      [OUTSIDER, 'customer', 'edsger@example.com'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  afterEach(async () => {
    clockNow = START;
    harness.stripe.paymentIntents.clear();
    harness.stripe.intentsByKey.clear();
    harness.stripe.refunds.length = 0;
    harness.stripe.cancelRequests.length = 0;
    harness.stripe.refundsToRefuse.clear();
    harness.email.sent.length = 0;
    await harness.database.db.delete(operatorAlerts);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('opening checkout on a date that has passed (VEN-433)', () => {
    it('refuses with 409 and mints no PaymentIntent', async () => {
      const requestId = await acceptedRequest();
      /*
       * Payment deadline out of the way (VEN-528): this asserts the date guard on
       * its own, and a week's window has always closed before a month-out event.
       */
      await harness.database.db
        .update(bookingRequests)
        .set({ expiresAt: null })
        .where(eq(bookingRequests.id, requestId));
      clockNow = addDays(START, 33);

      const response = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'That date has passed, so this booking can no longer be paid for',
      );
      expect(harness.stripe.paymentIntents.size).toBe(0);
    });

    it('still opens on the day of the event, which has not passed everywhere', async () => {
      const requestId = await acceptedRequest();
      /*
       * Payment deadline out of the way (VEN-528): this asserts the date guard on
       * its own, and a week's window has always closed before a month-out event.
       */
      await harness.database.db
        .update(bookingRequests)
        .set({ expiresAt: null })
        .where(eq(bookingRequests.id, requestId));
      clockNow = new Date(`${EVENT_DATE}T12:00:00Z`);

      const response = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(200);
      expect(harness.stripe.paymentIntents.size).toBe(1);
    });

    it('keeps answering succeeded for a request that was paid before its date passed', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      clockNow = addDays(START, 33);

      const response = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('succeeded');
    });
  });

  describe('the payment deadline (VEN-528)', () => {
    /** Past the seven-day payment window, well before the event. */
    const LAPSED = addDays(START, 8);

    const checkout = (requestId: string): ReturnType<typeof inject> =>
      inject('POST', `/customer/booking-requests/${requestId}/checkout`, CUSTOMER);

    /** What the sweep runs, built the way the plugin builds it. */
    const sweep = (): Promise<number> => {
      const context = {
        ...bookingContextFor(harness.app, harness.app.log, 'https://web.test'),
        platformFeeRate: DEFAULT_PLATFORM_FEE_RATE,
      };

      return expireLapsedRequests(harness.app.db, LAPSED, context.mail, expiryGuardFor(context));
    };

    const statusOf = async (requestId: string): Promise<string | undefined> =>
      (
        await harness.database.db
          .select({ status: bookingRequests.status })
          .from(bookingRequests)
          .where(eq(bookingRequests.id, requestId))
      )[0]?.status;

    it('refuses to open checkout on a lapsed request with 409 and mints no intent', async () => {
      const requestId = await acceptedRequest();
      clockNow = LAPSED;

      const response = await checkout(requestId);

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'That request is no longer open, so there is nothing to pay for',
      );
      expect(harness.stripe.paymentIntents.size).toBe(0);
      expect(await statusOf(requestId)).toBe('expired');
    });

    it('cancels the unpaid intent when its request expires', async () => {
      const requestId = await acceptedRequest();
      const opened = await checkout(requestId);
      const intentId: string = opened.json().paymentIntentId;

      expect(await sweep()).toBe(1);

      expect(harness.stripe.cancelRequests).toEqual([intentId]);
      expect(harness.stripe.paymentIntents.get(intentId)?.status).toBe('canceled');
      expect(await statusOf(requestId)).toBe('expired');
    });

    it('books a payment made in time when the sweep reaches the request first', async () => {
      const requestId = await acceptedRequest();
      const opened = await checkout(requestId);
      harness.stripe.succeed(opened.json().paymentIntentId);

      expect(await sweep()).toBe(0);

      const rows = await harness.database.db.select().from(bookings);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.totalAmountCents).toBe(PRICE_CENTS);
      expect(rows[0]?.status).toBe('confirmed');
      expect(harness.stripe.refunds).toEqual([]);
      expect(harness.stripe.cancelRequests).toEqual([]);
      expect(await statusOf(requestId)).toBe('accepted');
    });

    it('books a payment made in time when a read reaches the request first', async () => {
      const requestId = await acceptedRequest();
      const opened = await checkout(requestId);
      harness.stripe.succeed(opened.json().paymentIntentId);
      clockNow = LAPSED;

      const response = await inject('GET', `/booking-requests/${requestId}`, CUSTOMER);

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('accepted');
      expect(await harness.database.db.select().from(bookings)).toHaveLength(1);
      expect(harness.stripe.refunds).toEqual([]);
    });

    it('answers a lapsed checkout for a paid request with the booking, not a refusal', async () => {
      const requestId = await acceptedRequest();
      const opened = await checkout(requestId);
      harness.stripe.succeed(opened.json().paymentIntentId);
      clockNow = LAPSED;

      const response = await checkout(requestId);

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('succeeded');
      expect(await harness.database.db.select().from(bookings)).toHaveLength(1);
      expect(harness.stripe.refunds).toEqual([]);
    });

    it('holds the expiry while a payment is still processing', async () => {
      const requestId = await acceptedRequest();
      const opened = await checkout(requestId);
      const intentId: string = opened.json().paymentIntentId;
      const intent = harness.stripe.paymentIntents.get(intentId)!;
      harness.stripe.paymentIntents.set(intentId, { ...intent, status: 'processing' });

      expect(await sweep()).toBe(0);

      expect(await statusOf(requestId)).toBe('accepted');
      expect(harness.stripe.cancelRequests).toEqual([]);
      expect(await harness.database.db.select().from(bookings)).toEqual([]);
    });

    it('holds the expiry, and refunds nothing, when Stripe cannot be asked', async () => {
      const requestId = await acceptedRequest();
      await checkout(requestId);
      harness.stripe.paymentIntents.clear();

      expect(await sweep()).toBe(0);

      expect(await statusOf(requestId)).toBe('accepted');
      expect(harness.stripe.refunds).toEqual([]);
    });
  });

  describe('opening checkout', () => {
    it('returns the intent and the numbers the summary rail renders', async () => {
      const requestId = await acceptedRequest();

      const response = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.clientSecret).toMatch(/_secret_/);
      expect(body.amountCents).toBe(PRICE_CENTS);
      // Nothing is added to the quoted price — the rail's "Service fee: None".
      expect(body.customerFeeCents).toBe(0);
      expect(body.vendor.businessName).toBe('Sunlit Studio');
      expect(body.eventDate).toBe(EVENT_DATE);
      expect(body.guestCount).toBe(120);
      // Frame `05`'s rail sub-line: `<package> · <duration>`, #395.
      expect(body.servicePackage).toEqual({ name: 'Full day coverage', durationHours: 6 });
      // "…accepted your request on…" needs a real acceptance timestamp.
      expect(new Date(body.acceptedAt).toISOString()).toBe(START.toISOString());
    });

    /*
     * A custom request has no package, and the left join hands back a row whose
     * package columns are all null — the same shape as a package that exists.
     * The rail must drop the sub-line rather than draw an empty one.
     */
    it('answers a null package for a custom request', async () => {
      const { vendorId } = await createVendor();

      const request = await inject('POST', '/booking-requests', CUSTOMER, {
        vendorId,
        eventDate: EVENT_DATE,
        eventType: 'wedding',
        eventLocation: 'Barr Mansion, Austin, TX',
        guestCount: 120,
        customDetails: 'Two hours of engagement portraits at Zilker, golden hour.',
      });
      expect(request.statusCode).toBe(201);
      const requestId: string = request.json().id;

      /*
       * The quote comes first and the *customer* accepts it: #401 refuses
       * accepting a custom request straight from `pending`, because the row
       * that produced was terminal and could never be paid.
       */
      const quoted = await inject('POST', `/booking-requests/${requestId}/quote`, VENDOR, {
        quotedPriceCents: PRICE_CENTS,
      });
      expect(quoted.statusCode).toBe(200);
      expect(
        (await inject('POST', `/booking-requests/${requestId}/accept`, CUSTOMER)).statusCode,
      ).toBe(200);

      const response = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(200);
      expect(response.json().servicePackage).toBeNull();
    });

    /**
     * The acceptance criterion, fired twice as it asks. Stripe replays an intent
     * for a repeated idempotency key, so the second call cannot mint a second
     * charge against the same booking — which is what makes a double-submitted
     * button a UI nicety rather than the only guard.
     */
    it('is impossible to double-pay: the same request returns the same intent', async () => {
      const requestId = await acceptedRequest();

      const first = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );
      const second = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(first.json().paymentIntentId).toBe(second.json().paymentIntentId);
      expect(harness.stripe.paymentIntents.size).toBe(1);
    });

    it('carries the platform fee and the payout account onto the intent', async () => {
      const requestId = await acceptedRequest();
      await inject('POST', `/customer/booking-requests/${requestId}/checkout`, CUSTOMER);

      // The fee is the platform's cut *out of* the price, not an addition.
      expect(Math.round(PRICE_CENTS * DEFAULT_PLATFORM_FEE_RATE)).toBe(EXPECTED_FEE_CENTS);
      const [intent] = [...harness.stripe.paymentIntents.values()];
      expect(intent?.metadata.requestId).toBe(requestId);
      expect(intent?.amountReceivedCents).toBe(PRICE_CENTS);
    });

    it('refuses to charge for a vendor who cannot be paid', async () => {
      const requestId = await acceptedRequest();
      await harness.database.db.update(vendorProfiles).set({ stripeOnboarded: false });

      const response = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(402);
      expect(response.json().error).toBe(ERROR_CODES.PAYMENT_REQUIRED);
    });

    /**
     * Acceptance 10 of #427. The vendor agreement is what the platform pays a
     * vendor **under** — the commission and the payout timing are agreed there
     * — so a charge taken against a vendor who has not accepted the version in
     * force is money moved under terms nobody agreed to.
     *
     * The customer's message is deliberately the one a missing Connect account
     * earns. Which of the two the vendor has not done is the vendor's business,
     * and a customer cannot act on the difference.
     */
    it('refuses to charge for a vendor who has not accepted the current agreement', async () => {
      const requestId = await acceptedRequest(EVENT_DATE, false);

      const response = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(402);
      expect(response.json().error).toBe(ERROR_CODES.PAYMENT_REQUIRED);
      expect(response.json().message).toContain('Sunlit Studio');
      // No intent was opened, so nothing has to be cleaned up at Stripe.
      expect(harness.stripe.paymentIntents.size).toBe(0);
    });

    it('refuses a request nobody has accepted', async () => {
      const { vendorId, packageId } = await createVendor();
      const request = await inject('POST', '/booking-requests', CUSTOMER, {
        vendorId,
        packageId,
        eventDate: EVENT_DATE,
      });

      const response = await inject(
        'POST',
        `/customer/booking-requests/${request.json().id}/checkout`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(409);
    });

    /* 404 rather than 403: a stranger probing ids learns nothing. */
    /*
     * Stripe forgets the creation key after 24 hours; the fake's key map is
     * cleared to model that. The stored intent is what must come back.
     */
    it('hands back the stored intent instead of minting a second after the key expires', async () => {
      const requestId = await acceptedRequest();
      const first = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );
      harness.stripe.intentsByKey.clear();

      const second = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(second.statusCode).toBe(200);
      expect(second.json().paymentIntentId).toBe(first.json().paymentIntentId);
      const [row] = await harness.database.db
        .select({ intent: bookingRequests.stripePaymentIntentId })
        .from(bookingRequests)
        .where(eq(bookingRequests.id, requestId));
      expect(row?.intent).toBe(first.json().paymentIntentId);
    });

    it('mints a new intent when the stored one was cancelled', async () => {
      const requestId = await acceptedRequest();
      const first = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );
      harness.stripe.intentsByKey.clear();
      harness.stripe.cancel(first.json().paymentIntentId);

      const second = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      expect(second.statusCode).toBe(200);
      expect(second.json().paymentIntentId).not.toBe(first.json().paymentIntentId);
    });

    /*
     * Both intents get paid: the second charge is the one nothing pointed at.
     */
    it('refunds and alerts on a second payment for an already-booked request', async () => {
      const requestId = await acceptedRequest();
      const firstIntentId = await payFor(requestId);
      harness.stripe.intentsByKey.clear();
      const stray = await harness.stripe.createPaymentIntent({
        requestId,
        amountCents: PRICE_CENTS,
        customerId: 'cus_test',
        vendorId: 'ven_test',
      });
      harness.stripe.succeed(stray.id);

      const response = await redeliver(stray.id);
      await harness.flushEmail();

      expect(response.statusCode).toBe(200);
      expect(response.json().outcome).toBe('already-booked');
      expect(harness.stripe.refunds).toHaveLength(1);
      expect(harness.stripe.refunds[0]).toMatchObject({
        paymentIntentId: stray.id,
        amountCents: PRICE_CENTS,
      });
      expect(harness.stripe.refunds[0]?.idempotencyKey).toMatch(
        new RegExp(`^${stray.id}_duplicate_intent_\\d+$`),
      );
      const [mail] = harness.email.sent.filter(
        (message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL,
      );
      expect(mail?.subject).toContain('second payment');
      expect(mail?.text).toContain(requestId);
      const rows = await harness.database.db.select().from(bookings);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.stripePaymentIntentId).toBe(firstIntentId);
    });

    it('will not let another customer open someone elses checkout', async () => {
      const requestId = await acceptedRequest();

      const response = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        OUTSIDER,
      );

      expect(response.statusCode).toBe(404);
    });

    it('rejects an unauthenticated checkout', async () => {
      const requestId = await acceptedRequest();

      expect(
        (await inject('POST', `/customer/booking-requests/${requestId}/checkout`, null)).statusCode,
      ).toBe(401);
    });
  });

  describe('the succeeded webhook', () => {
    it('creates the booking, splits the money and books the date — in one go', async () => {
      const requestId = await acceptedRequest();

      await payFor(requestId);

      const [booking] = await harness.database.db.select().from(bookings);
      expect(booking?.status).toBe('confirmed');
      expect(booking?.totalAmountCents).toBe(PRICE_CENTS);
      expect(booking?.platformFeeCents).toBe(EXPECTED_FEE_CENTS);
      expect(booking?.vendorPayoutCents).toBe(EXPECTED_PAYOUT_CENTS);
      // The two parts sum back to the total exactly — no cent is invented or lost.
      expect(booking!.platformFeeCents + booking!.vendorPayoutCents).toBe(PRICE_CENTS);
      expect(booking?.paidAt).not.toBeNull();

      const [held] = await harness.database.db.select().from(availability);
      expect(held?.status).toBe('booked');
      expect(held?.date).toBe(EVENT_DATE);
      expect(booking?.requestId).toBe(requestId);
    });

    /**
     * Stripe retries a webhook it could not confirm for three days, so a second
     * delivery is the normal case rather than an error. It must report success
     * and write nothing — a duplicate booking row would sell the date twice.
     */
    it('is safe to deliver twice', async () => {
      const requestId = await acceptedRequest();
      const intentId = await payFor(requestId);

      harness.stripe.nextEvent = {
        type: 'payment_intent.succeeded',
        accountId: null,
        objectId: intentId,
      };
      const again = await harness.app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
        payload: { id: 'evt_test', type: 'payment_intent.succeeded' },
      });

      expect(again.statusCode).toBe(200);
      expect(again.json().outcome).toBe('already-booked');
      expect(await harness.database.db.select().from(bookings)).toHaveLength(1);
    });

    /**
     * The platform refused the request (an account unwind declined it) while the
     * customer's tab still held a live client secret and confirmed against
     * Stripe.js. The money moved; booking it would sell a date the vendor no
     * longer offers, so the webhook refunds the charge and tells the operator.
     */
    it('refunds a payment on a declined request instead of booking it', async () => {
      const requestId = await acceptedRequest();
      const checkout = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );
      const intentId: string = checkout.json().paymentIntentId;
      await harness.database.db
        .update(bookingRequests)
        .set({ status: 'declined' })
        .where(eq(bookingRequests.id, requestId));
      const calendarBefore = await harness.database.db.select().from(availability);
      harness.stripe.succeed(intentId);

      const response = await redeliver(intentId);
      await harness.flushEmail();

      expect(response.statusCode).toBe(200);
      expect(response.json().outcome).toBe('refunded');
      expect(await harness.database.db.select().from(bookings)).toEqual([]);
      expect(await harness.database.db.select().from(availability)).toEqual(calendarBefore);
      expect(harness.stripe.refunds).toHaveLength(1);
      expect(harness.stripe.refunds[0]).toMatchObject({
        paymentIntentId: intentId,
        amountCents: PRICE_CENTS,
      });
      expect(harness.stripe.refunds[0]?.idempotencyKey).toMatch(
        new RegExp(`^${intentId}_declined_request_\\d+$`),
      );
      const [mail] = harness.email.sent.filter(
        (message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL,
      );
      expect(mail?.subject).toContain('declined request');
      expect(mail?.text).toContain(requestId);

      // Stripe retries what it cannot confirm: the second delivery answers 200 and refunds nothing more.
      const again = await redeliver(intentId);
      expect(again.statusCode).toBe(200);
      expect(again.json().outcome).toBe('refunded');
      expect(harness.stripe.refunds).toHaveLength(1);
      expect(await harness.database.db.select().from(bookings)).toEqual([]);
    });

    /* VEN-477: a smaller refund made elsewhere is not the whole refund owed. */
    it('refunds only the remainder of a declined payment already partly refunded', async () => {
      const requestId = await acceptedRequest();
      const checkout = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );
      const intentId: string = checkout.json().paymentIntentId;
      await harness.database.db
        .update(bookingRequests)
        .set({ status: 'declined' })
        .where(eq(bookingRequests.id, requestId));
      harness.stripe.succeed(intentId);
      harness.stripe.refunds.push({
        paymentIntentId: intentId,
        amountCents: 1_000,
        reason: undefined,
        idempotencyKey: undefined,
        reverseTransfer: false,
        refundApplicationFee: false,
      });

      const response = await redeliver(intentId);

      expect(response.statusCode).toBe(200);
      expect(harness.stripe.refunds).toHaveLength(2);
      expect(harness.stripe.refunds[1]).toMatchObject({
        paymentIntentId: intentId,
        amountCents: PRICE_CENTS - 1_000,
      });
    });

    it('answers 500 and alerts when the refund of a declined request fails, so Stripe retries', async () => {
      const requestId = await acceptedRequest();
      const checkout = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );
      const intentId: string = checkout.json().paymentIntentId;
      await harness.database.db
        .update(bookingRequests)
        .set({ status: 'declined' })
        .where(eq(bookingRequests.id, requestId));
      harness.stripe.succeed(intentId);
      harness.stripe.refundsToRefuse.add(intentId);

      const response = await redeliver(intentId);
      await harness.flushEmail();

      expect(response.statusCode).toBe(500);
      expect(await harness.database.db.select().from(bookings)).toEqual([]);
      const [mail] = harness.email.sent.filter(
        (message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL,
      );
      expect(mail?.text).toContain('has not been refunded');

      // The redelivery refunds, and its alert is not swallowed by the first one's dedupe.
      harness.stripe.refundsToRefuse.clear();
      const retried = await redeliver(intentId);
      await harness.flushEmail();

      expect(retried.statusCode).toBe(200);
      expect(harness.stripe.refunds).toHaveLength(1);
      expect(
        harness.email.sent.filter((message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL),
      ).toHaveLength(2);
    });

    it('still answers 200 with no new row when the delivery follows a cancellation', async () => {
      const requestId = await acceptedRequest();
      const intentId = await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      expect(
        (await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {})).statusCode,
      ).toBe(200);

      const again = await redeliver(intentId);

      expect(again.statusCode).toBe(200);
      expect(again.json().outcome).toBe('already-booked');
      expect(await harness.database.db.select().from(bookings)).toHaveLength(1);
      // The refund the cancellation issued is the only one.
      expect(harness.stripe.refunds).toHaveLength(1);
    });

    it('tells both parties the booking is confirmed', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);

      const rows = await harness.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'booking_confirmed'));

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.title).sort()).toEqual([
        'A booking is confirmed',
        'Sunlit Studio is booked',
      ]);
    });

    /**
     * `stripe trigger payment_intent.succeeded`, a Dashboard test payment, or
     * any other product sharing the Stripe account produces a succeeded intent
     * that names no booking request. Answering it with 4xx made Stripe retry
     * for three days and count the endpoint as failing; an intent the platform
     * did not create is acknowledged and ignored, exactly like one that has
     * not succeeded yet. Observed on 2026-09-03 as a 422 per trigger.
     */
    it('acknowledges and ignores a succeeded intent the platform never created', async () => {
      harness.stripe.paymentIntents.set('pi_foreign', {
        id: 'pi_foreign',
        status: 'succeeded',
        amountReceivedCents: 5_000,
        clientSecret: null,
        metadata: {},
      });
      harness.stripe.nextEvent = {
        type: 'payment_intent.succeeded',
        accountId: null,
        objectId: 'pi_foreign',
      };

      const webhook = await harness.app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
        payload: { id: 'evt_test', type: 'payment_intent.succeeded' },
      });

      expect(webhook.statusCode).toBe(200);
      expect(webhook.json().outcome).toBe('ignored');
      expect(await harness.database.db.select().from(bookings)).toEqual([]);
    });

    it('ignores an intent that has not succeeded', async () => {
      const requestId = await acceptedRequest();
      const checkout = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );

      harness.stripe.nextEvent = {
        type: 'payment_intent.succeeded',
        accountId: null,
        objectId: checkout.json().paymentIntentId,
      };
      const webhook = await harness.app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
        payload: { id: 'evt_test', type: 'payment_intent.succeeded' },
      });

      expect(webhook.json().outcome).toBe('ignored');
      expect(await harness.database.db.select().from(bookings)).toEqual([]);
    });
  });

  describe('reconciliation', () => {
    /**
     * The webhook that never arrives — a deploy mid-delivery, a rotated signing
     * secret, a paused endpoint. Without this the customer sits on a charged
     * card and an unbooked date with no path forward but support.
     */
    it('books from Stripe directly when no webhook ever landed', async () => {
      const requestId = await acceptedRequest();
      const checkout = await inject(
        'POST',
        `/customer/booking-requests/${requestId}/checkout`,
        CUSTOMER,
      );
      harness.stripe.succeed(checkout.json().paymentIntentId);

      expect(await harness.database.db.select().from(bookings)).toEqual([]);

      const response = await inject(
        'GET',
        `/customer/booking-requests/${requestId}/booking`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('confirmed');
      expect(response.json().totalAmountCents).toBe(PRICE_CENTS);
      expect(await harness.database.db.select().from(bookings)).toHaveLength(1);
    });

    it('says not-found while the charge is still unconfirmed', async () => {
      const requestId = await acceptedRequest();
      await inject('POST', `/customer/booking-requests/${requestId}/checkout`, CUSTOMER);

      expect(
        (await inject('GET', `/customer/booking-requests/${requestId}/booking`, CUSTOMER))
          .statusCode,
      ).toBe(404);
    });

    /*
     * Found by driving the flow for #387, the first time anyone reached a paid
     * booking in a browser. The route answered `bookingSchema`, so Fastify
     * stripped `eventType` and `venue` — and the confirmed screen validates
     * with `bookingWithContextSchema`, which requires both. Frame `06` reads
     * "Wedding · Barr Mansion", and the screen was rendering the 500 boundary
     * over a booking that had been paid for.
     */
    it('answers with the occasion and venue the confirmed screen renders', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);

      const response = await inject(
        'GET',
        `/customer/booking-requests/${requestId}/booking`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'confirmed',
        eventType: 'wedding',
        venue: 'Barr Mansion, Austin, TX',
        eventLocation: 'Barr Mansion, Austin, TX',
      });
    });

    /*
     * #407. The confirmed screen's own read carried the platform's commission,
     * the vendor's payout split and the Stripe payment-intent id straight to
     * the customer — the same customer `payments.service.ts` records the
     * commission "is none of the business of". The projection lives in
     * `toBookingWithContext`, so this read and `GET /bookings` cannot drift.
     */
    it('keeps the fee split and the Stripe ids off the confirmed screens read', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);

      const response = await inject(
        'GET',
        `/customer/booking-requests/${requestId}/booking`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(200);
      const keys = Object.keys(response.json() as Record<string, unknown>);
      for (const field of [
        'platformFeeCents',
        'vendorPayoutCents',
        'stripePaymentIntentId',
        'stripeTransferId',
      ]) {
        expect(keys).not.toContain(field);
      }
      expect(response.payload).not.toContain('pi_');
    });

    /*
     * The already-booked branch returned whatever booking the request id named
     * to any signed-in caller — amounts, payout split and Stripe intent id — so
     * a stranger walking ids read other people's bookings. 404, not 403, so a
     * prober still learns nothing about which ids exist.
     */
    it('will not let another customer read someone elses booking', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);

      const response = await inject(
        'GET',
        `/customer/booking-requests/${requestId}/booking`,
        OUTSIDER,
      );

      expect(response.statusCode).toBe(404);
    });
  });

  /*
   * #408: `users.total/completed/cancelled_bookings_count` are documented as
   * derived from bookings and had **no writer anywhere**, so every customer
   * read as a permanent 0-booking "New member" — on their own profile, in
   * `/admin/customers`, and in the profile a vendor sees before agreeing to
   * work with them. The three DAO functions that write a `bookings` row are now
   * the only writers of these counters, so each of them is driven here.
   */
  describe('the derived booking counters', () => {
    async function countsFor(customerId: string): Promise<{
      total: number;
      completed: number;
      cancelled: number;
    }> {
      const [row] = await harness.database.db
        .select({
          total: users.totalBookingsCount,
          completed: users.completedBookingsCount,
          cancelled: users.cancelledBookingsCount,
        })
        .from(users)
        .where(eq(users.id, customerId));

      return row!;
    }

    it('counts the booking a payment confirms', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);

      const [booking] = await harness.database.db.select().from(bookings);

      expect(await countsFor(booking!.customerId)).toEqual({
        total: 1,
        completed: 0,
        cancelled: 0,
      });
    });

    it('moves the booking into completed when the vendor marks it done', async () => {
      const booking = await pastBooking();

      expect(
        (await inject('PUT', `/vendor/bookings/${booking.id}/complete`, VENDOR)).statusCode,
      ).toBe(200);

      expect(await countsFor(booking.customerId)).toEqual({
        total: 1,
        completed: 1,
        cancelled: 0,
      });
    });

    it('moves it into cancelled when the customer cancels', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);

      expect(
        (await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {})).statusCode,
      ).toBe(200);

      expect(await countsFor(booking!.customerId)).toEqual({
        total: 1,
        completed: 0,
        cancelled: 1,
      });
    });
  });

  describe('completion', () => {
    it('lets the vendor mark a past event complete', async () => {
      const booking = await pastBooking();

      const response = await inject('PUT', `/vendor/bookings/${booking.id}/complete`, VENDOR);

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('completed');
      expect(response.json().completedAt).not.toBeNull();
    });

    it('refuses to complete an event that has not happened', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);

      const response = await inject('PUT', `/vendor/bookings/${booking!.id}/complete`, VENDOR);

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('That event has not happened yet');
    });

    /*
     * #409. The button that offers this is client-rendered and reads the
     * *browser's* day; this guard used to read the server's UTC day. East of
     * UTC those are different days at the end of a UTC one, so a vendor who had
     * just worked the event was shown `Mark complete` and then told the event
     * had not happened — the exact outcome the control exists to prevent.
     *
     * The server cannot know the vendor's day, so it refuses only what is still
     * ahead for **everyone**. At 16:00Z on the day before, a vendor in Tokyo is
     * already living the event day — and used to be told they were not.
     */
    it('lets a vendor east of UTC complete on the day the event ends there', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      // 16:00Z on the day before is already the event day in Tokyo.
      clockNow = new Date(`${toDateString(addDays(START, 29))}T16:00:00Z`);

      const response = await inject('PUT', `/vendor/bookings/${booking!.id}/complete`, VENDOR);

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('completed');
    });

    /* Still refused while no vendor anywhere could have worked it yet. */
    it('refuses on the day before, which is nobody’s event day yet', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      clockNow = new Date(`${toDateString(addDays(START, 28))}T12:00:00Z`);

      const response = await inject('PUT', `/vendor/bookings/${booking!.id}/complete`, VENDOR);

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('That event has not happened yet');
    });

    it('refuses the customer marking their own booking complete', async () => {
      const booking = await pastBooking();

      expect(
        (await inject('PUT', `/vendor/bookings/${booking.id}/complete`, CUSTOMER)).statusCode,
      ).toBe(403);
    });

    it('invites the customer to review once it is complete', async () => {
      const booking = await pastBooking();
      await inject('PUT', `/vendor/bookings/${booking.id}/complete`, VENDOR);

      const rows = await harness.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'booking_completed'));

      expect(rows).toHaveLength(1);
      expect(rows[0]?.userId).toBe(booking.customerId);
    });
  });

  describe('cancellation', () => {
    /*
     * D3's tiers, asserted with exact cent amounts rather than with the rate.
     * A rate can be right while the rounding is wrong, and the customer is
     * refunded cents rather than percentages.
     */
    it('refunds everything outside the 48-hour cutoff', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);

      const response = await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {
        reason: 'The venue fell through.',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().refundCents).toBe(PRICE_CENTS);
      expect(response.json().isFullRefund).toBe(true);
      /*
       * #423 acceptance 12 — a plain refund, with neither unwind flag.
       *
       * The event is months out, so the payout has not been released: nothing
       * has been transferred, there is nothing to reverse, and there is no way
       * for this cancellation to push the vendor's balance negative. That is
       * the consequence D31 had to accept, and holding the money until the
       * event has happened is what removes it for every cancellation before
       * the event.
       */
      expect(harness.stripe.refunds).toEqual([
        {
          paymentIntentId: booking!.stripePaymentIntentId,
          amountCents: PRICE_CENTS,
          reason: 'requested_by_customer',
          idempotencyKey: `cancel_${booking!.id}_marked`,
          reverseTransfer: false,
          refundApplicationFee: false,
        },
      ]);
    });

    /*
     * VEN-425. The page quotes on the browser's clock; a booking that crossed the
     * cutoff between render and press must not refund a different amount than the
     * one confirmed. Refused before any money moves, with the true figure named.
     */
    it('refuses a cancel confirmed against a stale refund quote', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      clockNow = addDays(START, 28);

      const stale = await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {
        expectedRefundCents: PRICE_CENTS,
      });

      expect(stale.statusCode).toBe(409);
      expect(stale.json().message).toContain(formatPrice(PRICE_CENTS / 2));
      expect(harness.stripe.refunds).toEqual([]);

      const confirmed = await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {
        expectedRefundCents: PRICE_CENTS / 2,
      });

      expect(confirmed.statusCode).toBe(200);
      expect(confirmed.json().refundCents).toBe(PRICE_CENTS / 2);
    });

    /*
     * VEN-425. The vendor completes across the event-date boundary while the
     * refund is in flight: the refund stands, so the row must end cancelled and
     * not `completed` with a full payout owed.
     */
    it('leaves a cancel that raced a completion cancelled, not completed and refunded', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      clockNow = addDays(START, 28);
      harness.stripe.duringNextRefund = async () => {
        await harness.database.db
          .update(bookings)
          .set({ status: 'completed', completedAt: clockNow })
          .where(eq(bookings.id, booking!.id));
      };

      const response = await inject(
        'PUT',
        `/customer/bookings/${booking!.id}/cancel`,
        CUSTOMER,
        {},
      );

      expect(response.statusCode).toBe(200);
      const [after] = await harness.database.db.select().from(bookings);
      expect(after).toMatchObject({
        status: 'cancelled',
        refundAmountCents: PRICE_CENTS / 2,
      });
      expect(harness.stripe.refunds).toHaveLength(1);
    });

    /*
     * #415. The screens on both sides have to say who ended the booking and
     * what came back, and neither survived on the row: `cancellation_reason`
     * is the customer's free text here and an operator's sentence on the ban
     * path, so telling them apart meant matching a string that is one copy
     * edit from being wrong — and the refund figure existed only in this
     * response, which nothing stores.
     */
    it('records who cancelled it and what was refunded', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [before] = await harness.database.db.select().from(bookings);

      await inject('PUT', `/customer/bookings/${before!.id}/cancel`, CUSTOMER, {
        reason: 'The venue fell through.',
      });

      const [after] = await harness.database.db.select().from(bookings);
      expect(after).toMatchObject({
        status: 'cancelled',
        cancelledBy: 'customer',
        refundAmountCents: PRICE_CENTS,
      });
    });

    /*
     * #399. The refund is sent before the guarded update that decides who won,
     * so two concurrent cancels both reach Stripe. The update's
     * `status = 'confirmed'` predicate means only one writes the row — and
     * without an idempotency key the customer was paid twice for one
     * cancellation. Fired with `Promise.all` so both are genuinely in flight.
     */
    it('refunds once when two cancels race, and answers both with the cancellation', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);

      const responses = await Promise.all([
        inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {}),
        inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {}),
      ]);

      // VEN-472: the loser's cancellation worked, so it is told so.
      expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
      expect(responses[0]!.json()).toEqual(responses[1]!.json());
      // Both calls reached Stripe; one key, so Stripe answers the second with
      // the first refund rather than making another.
      expect(new Set(harness.stripe.refunds.map((refund) => refund.idempotencyKey)).size).toBe(1);
      expect(harness.stripe.refunds.every((refund) => refund.idempotencyKey !== undefined)).toBe(
        true,
      );

      const [row] = await harness.database.db.select().from(bookings);
      expect(row?.status).toBe('cancelled');
      await harness.flushEmail();
      expect(
        harness.email.sent.filter((message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL),
      ).toEqual([]);
    });

    /*
     * VEN-472. The refund is out and a payout sweep commits before the row is
     * written: the customer is refunded and the vendor paid, which is a person's
     * problem, so the operator is told before the 409.
     */
    it('alerts the operator and answers 409 when a payout release beats a cancel that refunded', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      harness.stripe.duringNextRefund = async () => {
        await harness.database.db
          .update(bookings)
          .set({ payoutReleasedAt: clockNow })
          .where(eq(bookings.id, booking!.id));
      };

      const response = await inject(
        'PUT',
        `/customer/bookings/${booking!.id}/cancel`,
        CUSTOMER,
        {},
      );
      await harness.flushEmail();

      expect(response.statusCode).toBe(409);
      expect(harness.stripe.refunds).toHaveLength(1);
      const alerts = harness.email.sent.filter(
        (message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL,
      );
      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.text).toContain(booking!.id);
      expect(alerts[0]?.text).toContain('re_test_1');
      const [after] = await harness.database.db.select().from(bookings);
      expect(after?.status).toBe('confirmed');
    });

    it('still refuses, and alerts, when someone other than the customer cancelled it mid-refund', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      harness.stripe.duringNextRefund = async () => {
        await harness.database.db
          .update(bookings)
          .set({ status: 'cancelled', cancelledBy: 'admin', cancelledAt: clockNow })
          .where(eq(bookings.id, booking!.id));
      };

      const response = await inject(
        'PUT',
        `/customer/bookings/${booking!.id}/cancel`,
        CUSTOMER,
        {},
      );
      await harness.flushEmail();

      expect(response.statusCode).toBe(409);
      expect(
        harness.email.sent.filter((message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL),
      ).toHaveLength(1);
    });

    it('refuses a cancel of a booking the admin already cancelled', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      await harness.database.db
        .update(bookings)
        .set({ status: 'cancelled', cancelledBy: 'admin', cancelledAt: clockNow })
        .where(eq(bookings.id, booking!.id));

      const response = await inject(
        'PUT',
        `/customer/bookings/${booking!.id}/cancel`,
        CUSTOMER,
        {},
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('That booking is already cancelled');
      expect(harness.stripe.refunds).toHaveLength(0);
    });

    it('refunds half inside the cutoff', async () => {
      // Two days out: inside 48 hours of the event's midnight, and future in every zone.
      const requestId = await acceptedRequest(toDateString(addDays(START, 2)));
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);

      const response = await inject(
        'PUT',
        `/customer/bookings/${booking!.id}/cancel`,
        CUSTOMER,
        {},
      );

      expect(response.json().refundCents).toBe(PRICE_CENTS / 2);
      expect(response.json().isFullRefund).toBe(false);
      /*
       * #423 acceptance 14 — the tiers are untouched. Half comes back, and the
       * refund is as plain at this tier as at the other one: the boundary is
       * the release, not the amount.
       */
      expect(harness.stripe.refunds).toEqual([
        {
          paymentIntentId: booking!.stripePaymentIntentId,
          amountCents: PRICE_CENTS / 2,
          reason: 'requested_by_customer',
          idempotencyKey: `cancel_${booking!.id}_marked`,
          reverseTransfer: false,
          refundApplicationFee: false,
        },
      ]);
    });

    /*
     * VEN-477. A refund made elsewhere (a Dashboard goodwill refund) is not the
     * cancellation's refund: the customer is topped up to what they are owed,
     * and the row records the total returned, not the one figure Stripe listed.
     */
    it('tops up a cancel to the owed amount after a smaller refund made elsewhere', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      const goodwillCents = 1_000;
      harness.stripe.refunds.push({
        paymentIntentId: booking!.stripePaymentIntentId!,
        amountCents: goodwillCents,
        reason: undefined,
        idempotencyKey: undefined,
        reverseTransfer: false,
        refundApplicationFee: false,
      });

      const response = await inject(
        'PUT',
        `/customer/bookings/${booking!.id}/cancel`,
        CUSTOMER,
        {},
      );

      expect(response.statusCode).toBe(200);
      expect(response.json().refundCents).toBe(PRICE_CENTS);
      expect(harness.stripe.refunds).toHaveLength(2);
      expect(harness.stripe.refunds[1]).toMatchObject({
        amountCents: PRICE_CENTS - goodwillCents,
        idempotencyKey: `cancel_${booking!.id}_marked`,
      });
      const [after] = await harness.database.db.select().from(bookings);
      expect(after).toMatchObject({ status: 'cancelled', refundAmountCents: PRICE_CENTS });
    });

    it('frees the date again', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);

      await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      const [held] = await harness.database.db.select().from(availability);
      expect(held?.status).toBe('available');
    });

    /*
     * #400, the root of five findings: cancel flipped `bookings.status` and
     * freed the date, and stopped. The parent request stayed `accepted`, so
     * `syncHeldDate` — which derives the calendar cell from the statuses on the
     * date — re-locked it as `booked` on the next transition touching that day,
     * for a booking that no longer exists. Nothing could undo it:
     * `setOwnAvailability` 409s on a booked date, and `setHeldDate(null)`
     * refused to delete while any `bookings` row sat on the date, whatever its
     * status.
     */
    it('settles the parent request rather than leaving it accepted', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);

      await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      const [request] = await harness.database.db
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, requestId));

      expect(request?.status).toBe('cancelled');
    });

    /*
     * The permanent re-lock, which is what made this a P0 rather than a
     * cosmetic inconsistency. Cancel freed the date, but the parent request
     * stayed `accepted` — and `syncHeldDate` derives the cell from the
     * statuses on that date, so the **next** transition touching the day found
     * an accepted request and wrote `booked` again, for a booking that no
     * longer exists. Nothing reachable could undo it.
     */
    it('does not let a later transition re-lock the freed date', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      // Any later transition on the same date re-derives the calendar cell.
      const [vendorProfile] = await harness.database.db.select().from(vendorProfiles);
      const second = await inject('POST', '/booking-requests', OUTSIDER, {
        vendorId: vendorProfile!.id,
        eventDate: EVENT_DATE,
        customDetails: 'A second enquiry for the same day, after the first was cancelled.',
      });
      expect(second.statusCode).toBe(201);

      const declined = await inject(
        'POST',
        `/booking-requests/${second.json().id}/decline`,
        VENDOR,
      );
      expect(declined.statusCode).toBe(200);

      const [held] = await harness.database.db
        .select()
        .from(availability)
        .where(eq(availability.date, EVENT_DATE));

      expect(held?.status ?? 'available').not.toBe('booked');
    });

    /*
     * Every read built on `findBookingByRequest` reported a cancelled booking
     * as paid, because that query had no status filter: checkout redirected to
     * the confirmation, and the detail page told the customer who had just
     * cancelled that the vendor "is booked", showed the amount paid, and
     * offered `Cancel booking` a second time.
     */
    it('stops reading the cancelled booking as the request payment', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      const response = await inject(
        'GET',
        `/customer/booking-requests/${requestId}/booking`,
        CUSTOMER,
      );

      expect(response.statusCode).toBe(404);
    });

    /*
     * The read that answers "is this request paid for" and the read that
     * answers "have I already recorded this event" are different questions,
     * and #400 briefly made them the same function.
     *
     * Stripe redelivers for three days and disables an endpoint that keeps
     * failing. With the cancelled-booking filter on the idempotency read, a
     * redelivery after a cancellation found nothing, fell through to
     * `confirmBooking`, conflicted on `bookings_request_id_key` and answered
     * 409 — so the customer-facing narrowing would have cost the webhook
     * endpoint itself, and the unique index was the only thing standing
     * between that and a second confirmed booking re-locking the date.
     */
    it('acknowledges a webhook redelivered after the booking was cancelled', async () => {
      const requestId = await acceptedRequest();
      const intentId = await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      const replay = await redeliver(intentId);

      expect(replay.statusCode).toBe(200);

      // And it recorded nothing new: one row, still cancelled, date still free.
      const rows = await harness.database.db.select().from(bookings);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe('cancelled');

      const [held] = await harness.database.db.select().from(availability);
      expect(held?.status).toBe('available');
    });

    it('cannot cancel an event that already happened', async () => {
      const booking = await pastBooking();
      await inject('PUT', `/vendor/bookings/${booking.id}/complete`, VENDOR);

      const response = await inject('PUT', `/customer/bookings/${booking.id}/cancel`, CUSTOMER, {});

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'That event already happened, so it cannot be cancelled',
      );
      expect(harness.stripe.refunds).toEqual([]);
    });

    /*
     * The case the test above never reached: it completes the booking first, so
     * its 409 is the status message. A `confirmed` booking whose event has
     * passed is what the vendor's optional `complete` leaves behind, and it used
     * to refund half of a delivered event.
     */
    it('refuses to cancel a confirmed booking whose event has passed, refunding nothing', async () => {
      const booking = await pastBooking();

      const response = await inject('PUT', `/customer/bookings/${booking.id}/cancel`, CUSTOMER, {});

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('too close to cancel');
      expect(harness.stripe.refunds).toEqual([]);
      expect(harness.stripe.reversals).toEqual([]);
      const [row] = await harness.database.db.select().from(bookings);
      expect(row?.status).toBe('confirmed');
      const [held] = await harness.database.db.select().from(availability);
      expect(held?.status).toBe('booked');
    });

    it('refuses to cancel a booking that has already been paid out, reversing nothing', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      await harness.database.db
        .update(bookings)
        .set({ payoutReleasedAt: new Date(), stripeTransferId: 'tr_test_released' })
        .where(eq(bookings.id, booking!.id));

      const response = await inject(
        'PUT',
        `/customer/bookings/${booking!.id}/cancel`,
        CUSTOMER,
        {},
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('already been paid out');
      expect(harness.stripe.refunds).toEqual([]);
      expect(harness.stripe.reversals).toEqual([]);
      const [held] = await harness.database.db.select().from(availability);
      expect(held?.status).toBe('booked');
    });

    it('answers a repeated cancellation with the first, and refunds nothing twice', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      const first = await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      const again = await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      expect(again.statusCode).toBe(200);
      expect(again.json()).toEqual(first.json());
      expect(harness.stripe.refunds).toHaveLength(1);
    });

    /*
     * The refund goes out before the row moves, so an update that *throws*
     * leaves the money returned on a booking still reading `confirmed` — and
     * Stripe forgets the idempotency key after 24 hours, so the customer's
     * retry the next day used to be a second refund. Under D31 that reverses
     * the vendor's transfer twice and takes a third party's account negative.
     */
    it('completes a retry against an existing refund instead of paying it twice', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      // The state a throw leaves behind: refunded at Stripe, row untouched, and
      // far enough in the past that no idempotency key survives.
      harness.stripe.refunds.push({
        paymentIntentId: booking!.stripePaymentIntentId!,
        amountCents: PRICE_CENTS,
        reason: 'requested_by_customer',
        idempotencyKey: undefined,
        reverseTransfer: false,
        refundApplicationFee: false,
      });

      const response = await inject(
        'PUT',
        `/customer/bookings/${booking!.id}/cancel`,
        CUSTOMER,
        {},
      );

      expect(response.statusCode).toBe(200);
      expect(response.json().refundCents).toBe(PRICE_CENTS);
      // Read off the money that moved: the event is months out, so the quote
      // and the existing refund agree here — the point is that both are the
      // full amount rather than a second payment.
      expect(response.json().isFullRefund).toBe(true);
      // Still the one refund the first attempt made — no second one.
      expect(harness.stripe.refunds).toHaveLength(1);

      const [row] = await harness.database.db.select().from(bookings);
      expect(row?.status).toBe('cancelled');
    });

    it('refuses the vendor cancelling on the customers behalf', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);

      expect(
        (await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, VENDOR, {})).statusCode,
      ).toBe(403);
      expect(harness.stripe.refunds).toEqual([]);
    });

    it('tells the vendor their date is free and that nothing is taken back', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      const rows = await harness.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'booking_cancelled'));

      expect(rows).toHaveLength(1);
      /*
       * This notification is the only message the product sends the vendor
       * about the cancellation, so which of the two sentences it carries is a
       * money claim rather than a copy choice — telling a vendor their balance
       * is being clawed back when it is not is as wrong as the reverse.
       *
       * The event here is months out, so nothing has been transferred and
       * nothing comes back. D31's reversal sentence is still sent, and still
       * warns about a negative balance, on a booking cancelled after its
       * payout has been released — the assertion beside `payout_released_at`
       * covers that side.
       */
      expect(rows[0]?.body).toBe(
        'The date is free again on your calendar. This booking had not been paid out yet, so ' +
          'nothing is taken back out of your Stripe balance.',
      );
    });
  });
});
