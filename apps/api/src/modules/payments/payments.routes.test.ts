import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  DEFAULT_PLATFORM_FEE_RATE,
  ERROR_CODES,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

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
  async function createVendor(): Promise<{ vendorId: string; packageId: string }> {
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
      inclusions: ['6 hours'],
    });
    expect(created.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    return { vendorId, packageId: created.json().id };
  }

  /** A request the vendor has accepted — the only state checkout opens on. */
  async function acceptedRequest(eventDate = EVENT_DATE): Promise<string> {
    const { vendorId, packageId } = await createVendor();

    const request = await inject('POST', '/booking-requests', CUSTOMER, {
      vendorId,
      packageId,
      eventDate,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      guestCount: 120,
    });
    expect(request.statusCode).toBe(201);

    const accepted = await inject('POST', `/booking-requests/${request.json().id}/accept`, VENDOR);
    expect(accepted.statusCode).toBe(200);

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

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
      [OUTSIDER, 'customer', 'edsger@example.com'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
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
      // "…accepted your request on…" needs a real acceptance timestamp.
      expect(new Date(body.acceptedAt).toISOString()).toBe(START.toISOString());
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
      expect(harness.stripe.refunds).toEqual([
        {
          paymentIntentId: booking!.stripePaymentIntentId,
          amountCents: PRICE_CENTS,
          reason: 'requested_by_customer',
          idempotencyKey: `cancel_${booking!.id}`,
        },
      ]);
    });

    /*
     * #399. The refund is sent before the guarded update that decides who won,
     * so two concurrent cancels both reach Stripe. The update's
     * `status = 'confirmed'` predicate means only one writes the row — and
     * without an idempotency key the customer was paid twice for one
     * cancellation. Fired with `Promise.all` so both are genuinely in flight.
     */
    it('refunds once when two cancels race, and answers the loser with a conflict', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);

      const responses = await Promise.all([
        inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {}),
        inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {}),
      ]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
      // Both calls reached Stripe; one key, so Stripe answers the second with
      // the first refund rather than making another.
      expect(new Set(harness.stripe.refunds.map((refund) => refund.idempotencyKey)).size).toBe(1);
      expect(harness.stripe.refunds.every((refund) => refund.idempotencyKey !== undefined)).toBe(
        true,
      );

      const [row] = await harness.database.db.select().from(bookings);
      expect(row?.status).toBe('cancelled');
    });

    it('refunds half inside the cutoff', async () => {
      // A day out: inside 48 hours, and still in the future.
      const requestId = await acceptedRequest(toDateString(addDays(START, 1)));
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

    it('refuses a second cancellation, and refunds nothing twice', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      const again = await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      expect(again.statusCode).toBe(409);
      expect(harness.stripe.refunds).toHaveLength(1);
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

    it('tells the vendor their date is free again', async () => {
      const requestId = await acceptedRequest();
      await payFor(requestId);
      const [booking] = await harness.database.db.select().from(bookings);
      await inject('PUT', `/customer/bookings/${booking!.id}/cancel`, CUSTOMER, {});

      const rows = await harness.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'booking_cancelled'));

      expect(rows).toHaveLength(1);
      expect(rows[0]?.body).toBe('The date is free again on your calendar.');
    });
  });
});
