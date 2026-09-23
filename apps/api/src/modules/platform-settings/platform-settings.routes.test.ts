import { setUserRole } from '../../testing/set-user-role.js';
import {
  adminActions,
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  platformSettings,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  PLATFORM_SETTINGS_ID,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  bearer,
  createTestHarness,
  TEST_ENV,
  type TestHarness,
} from '../../testing/test-server.js';
import { releaseDuePayouts, retryPayoutRelease } from '../payments/payouts.service.js';
import { forgetPlatformSwitches, readPlatformSwitches } from './platform-settings.service.js';

/**
 * The launch switches (VEN-404), end to end through the routes that obey them.
 *
 * Every switch is flipped through `PUT /admin/settings` rather than written to
 * the row, so each case also proves the writing instance obeys its own flip at
 * once despite the ten-second cache.
 */
const ADMIN = 'user_switch_admin';
const VENDOR = 'user_switch_vendor';
const VENDOR_TWO = 'user_switch_vendor_two';
const CUSTOMER = 'user_switch_customer';

const VENDOR_ACCOUNT = 'acct_test_switch_vendor';
const VENDOR_TWO_ACCOUNT = 'acct_test_switch_vendor_two';

const PRICE_CENTS = 145_000;
const BETA_CAP_CENTS = 50_000;

const START = new Date('2026-06-01T12:00:00Z');

type Response = Awaited<ReturnType<TestHarness['app']['inject']>>;

describe('launch switches', () => {
  let harness: TestHarness;
  let photographyId: string;
  let clockNow = START;
  let dateOffset = 30;

  async function inject(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    actor: string | null,
    payload?: Record<string, unknown>,
  ): Promise<Response> {
    return harness.app.inject({
      method,
      url,
      ...(actor ? { headers: bearer(actor) } : {}),
      ...(payload ? { payload } : {}),
    });
  }

  async function signInAsAdmin(): Promise<string> {
    expect((await inject('GET', '/v1/users/me', ADMIN)).statusCode).toBe(200);
    await setUserRole(harness.database.db, 'admin', eq(users.authUserId, ADMIN));
    const [row] = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, ADMIN));

    return row!.id;
  }

  async function setSwitches(patch: Record<string, unknown>): Promise<Response> {
    const response = await inject('PUT', '/v1/admin/settings', ADMIN, patch);
    expect(response.statusCode).toBe(200);

    return response;
  }

  /** A published, payout-ready vendor with one package at `priceCents`. */
  async function createVendor(
    authUserId: string,
    account: string,
    priceCents = PRICE_CENTS,
  ): Promise<{ vendorId: string; packageId: string }> {
    const profile = await inject('POST', '/v1/vendor/profile', authUserId, {
      businessName: authUserId === VENDOR ? 'Sunlit Studio' : 'Harbour Blooms',
      categoryIds: [photographyId],
      city: 'Austin',
      state: 'TX',
    });
    expect(profile.statusCode).toBe(201);
    const vendorId: string = profile.json().id;

    const created = await inject('POST', '/v1/vendor/packages', authUserId, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents,
      priceType: 'fixed',
      durationHours: 6,
      inclusions: ['6 hours'],
    });
    expect(created.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: account })
      .where(eq(vendorProfiles.id, vendorId));

    const agreed = await inject('POST', '/v1/vendor/agreement/accept', authUserId, {
      version: CURRENT_VENDOR_AGREEMENT_VERSION,
    });
    expect(agreed.statusCode).toBe(200);

    return { vendorId, packageId: created.json().id };
  }

  /** Each request takes a fresh date, so two to one vendor never collide. */
  async function requestBooking(vendor: {
    vendorId: string;
    packageId: string;
  }): Promise<Response> {
    dateOffset += 1;

    return inject('POST', '/v1/booking-requests', CUSTOMER, {
      vendorId: vendor.vendorId,
      packageId: vendor.packageId,
      eventDate: toDateString(addDays(START, dateOffset)),
      eventType: 'wedding',
    });
  }

  async function acceptedRequest(vendor: { vendorId: string; packageId: string }): Promise<string> {
    const request = await requestBooking(vendor);
    expect(request.statusCode).toBe(201);
    const requestId: string = request.json().id;
    const accepted = await inject('POST', `/v1/booking-requests/${requestId}/accept`, VENDOR);
    expect(accepted.statusCode).toBe(200);

    return requestId;
  }

  function checkout(requestId: string): Promise<Response> {
    return inject('POST', `/v1/customer/booking-requests/${requestId}/checkout`, CUSTOMER);
  }

  /** Checkout, the webhook, and a booking whose payout is owed. */
  async function paidBooking(
    authUserId: string,
    vendor: { vendorId: string; packageId: string },
  ): Promise<string> {
    const request = await requestBooking(vendor);
    expect(request.statusCode).toBe(201);
    const requestId: string = request.json().id;
    expect(
      (await inject('POST', `/v1/booking-requests/${requestId}/accept`, authUserId)).statusCode,
    ).toBe(200);

    const opened = await checkout(requestId);
    expect(opened.statusCode).toBe(200);
    const intentId: string = opened.json().paymentIntentId;
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
      payload: { id: `evt_${intentId}`, type: 'payment_intent.succeeded' },
    });
    expect(webhook.statusCode).toBe(200);

    const [row] = await harness.database.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.requestId, requestId));

    return row!.id;
  }

  /** Past `payoutReleaseAt` for every event requested so far (72 h after the latest). */
  function afterLastRelease(): Date {
    return addDays(START, dateOffset + 4);
  }

  /** What the operator was emailed, once the background sends have settled. */
  async function operatorMail(): Promise<{ subject: string; text: string }[]> {
    await harness.flushEmail();

    return harness.email.sent.filter((message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL);
  }

  function sweep(): ReturnType<typeof releaseDuePayouts> {
    return releaseDuePayouts(
      { db: harness.database.db, stripe: harness.stripe, log: harness.app.log },
      clockNow,
    );
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => clockNow });

    for (const [authUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [VENDOR_TWO, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    for (const account of [VENDOR_ACCOUNT, VENDOR_TWO_ACCOUNT]) {
      harness.stripe.accountStatuses.set(account, { transfersActive: true, payoutsActive: true });
    }

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = photography!.id;
  });

  afterEach(async () => {
    clockNow = START;
    dateOffset = 30;
    harness.stripe.paymentIntents.clear();
    harness.stripe.intentsByKey.clear();
    harness.stripe.transfers.length = 0;
    harness.email.sent.length = 0;
    vi.restoreAllMocks();
    await harness.database.db.delete(platformSettings);
    forgetPlatformSwitches(harness.database.db);
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

  describe('who may reach them', () => {
    it('answers 401 signed out and 403 to a customer or a vendor, on every route', async () => {
      await signInAsAdmin();
      const { vendorId } = await createVendor(VENDOR, VENDOR_ACCOUNT);
      expect((await inject('GET', '/v1/users/me', CUSTOMER)).statusCode).toBe(200);

      const routes = [
        ['GET', '/v1/admin/settings', undefined],
        ['PUT', '/v1/admin/settings', { checkoutPaused: true }],
        ['PUT', `/v1/admin/vendors/${vendorId}/payout-hold`, { payoutHold: true }],
      ] as const;

      for (const [method, url, payload] of routes) {
        expect((await inject(method, url, null, payload)).statusCode).toBe(401);
        for (const actor of [CUSTOMER, VENDOR]) {
          const response = await inject(method, url, actor, payload);
          expect(response.statusCode).toBe(403);
          expect(response.json().error).toBe('FORBIDDEN');
        }
      }

      const [row] = await harness.database.db.select().from(platformSettings);
      expect(row).toBeUndefined();
    });
  });

  describe('the settings record', () => {
    it('reads every switch off with no cap before anyone has changed one', async () => {
      await signInAsAdmin();
      const response = await inject('GET', '/v1/admin/settings', ADMIN);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        bookingRequestsPaused: false,
        checkoutPaused: false,
        payoutReleasePaused: false,
        maxBookingCents: null,
        vendorInviteOnly: false,
        updatedAt: null,
        updatedByName: null,
        heldVendors: [],
      });
    });

    it('audits each changed field with actor, before and after, and shows it in Activity', async () => {
      const adminId = await signInAsAdmin();

      const saved = await setSwitches({
        checkoutPaused: true,
        maxBookingCents: BETA_CAP_CENTS,
        bookingRequestsPaused: false,
      });
      expect(saved.json()).toMatchObject({
        checkoutPaused: true,
        maxBookingCents: BETA_CAP_CENTS,
        bookingRequestsPaused: false,
        updatedByName: 'Test User',
      });

      const activity = await inject(
        'GET',
        '/v1/admin/activity?action=platform_setting_changed',
        ADMIN,
      );
      expect(activity.statusCode).toBe(200);
      const items = activity.json().items as {
        actorId: string;
        actorName: string;
        subjectType: string;
        subjectId: string;
        detail: Record<string, unknown>;
      }[];
      expect(
        items
          .map((item) => item.detail)
          .sort((a, b) => String(a.field).localeCompare(String(b.field))),
      ).toEqual([
        { field: 'checkoutPaused', before: false, after: true },
        { field: 'maxBookingCents', before: null, after: BETA_CAP_CENTS },
      ]);
      for (const item of items) {
        expect(item).toMatchObject({
          actorId: adminId,
          actorName: 'Test User',
          subjectType: 'platform_settings',
          subjectId: PLATFORM_SETTINGS_ID,
        });
      }

      const alerts = await operatorMail();
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.subject).toContain('A launch switch was changed');
      expect(alerts[0]!.text).toContain('checkoutPaused: off → on');
      expect(alerts[0]!.text).toContain('maxBookingCents: no cap → $500');

      const repeat = await inject('PUT', '/v1/admin/settings', ADMIN, { checkoutPaused: true });
      expect(repeat.statusCode).toBe(409);
      expect(await harness.database.db.select().from(adminActions)).toHaveLength(2);
    });

    /*
     * Another instance never saw the write, so it obeys its own cached read —
     * for at most `PLATFORM_SETTINGS_CACHE_MS`, and then reads the row again.
     */
    it('trusts a cached read for ten seconds and no longer', async () => {
      const clock = vi.spyOn(Date, 'now').mockReturnValue(START.getTime());
      expect((await readPlatformSwitches(harness.database.db)).checkoutPaused).toBe(false);

      await harness.database.db.insert(platformSettings).values({ checkoutPaused: true });

      clock.mockReturnValue(START.getTime() + 9_999);
      expect((await readPlatformSwitches(harness.database.db)).checkoutPaused).toBe(false);

      clock.mockReturnValue(START.getTime() + 10_000);
      expect((await readPlatformSwitches(harness.database.db)).checkoutPaused).toBe(true);
    });

    it('refuses an empty change and a cap that is not a positive whole number of cents', async () => {
      await signInAsAdmin();

      for (const payload of [
        {},
        { maxBookingCents: 0 },
        { maxBookingCents: 12.5 },
        { paused: true },
      ]) {
        expect((await inject('PUT', '/v1/admin/settings', ADMIN, payload)).statusCode).toBe(400);
      }
    });
  });

  describe('checkout pause', () => {
    it('answers 503 checkout_paused and asks Stripe for nothing, then opens once lifted', async () => {
      await signInAsAdmin();
      const vendor = await createVendor(VENDOR, VENDOR_ACCOUNT);
      const requestId = await acceptedRequest(vendor);

      await setSwitches({ checkoutPaused: true });
      const paused = await checkout(requestId);

      expect(paused.statusCode).toBe(503);
      expect(paused.json()).toMatchObject({
        error: 'checkout_paused',
        message: 'Bookings are paused for a short while. Nothing has been charged.',
      });
      expect(harness.stripe.paymentIntents.size).toBe(0);

      await setSwitches({ checkoutPaused: false });
      const opened = await checkout(requestId);

      expect(opened.statusCode).toBe(200);
      expect(harness.stripe.paymentIntents.size).toBe(1);
    });
  });

  describe('booking request pause', () => {
    it('refuses a new request with 503 bookings_paused and still lets existing ones move', async () => {
      await signInAsAdmin();
      const vendor = await createVendor(VENDOR, VENDOR_ACCOUNT);
      const ids: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        const created = await requestBooking(vendor);
        expect(created.statusCode).toBe(201);
        ids.push(created.json().id);
      }

      await setSwitches({ bookingRequestsPaused: true });

      const refused = await requestBooking(vendor);
      expect(refused.statusCode).toBe(503);
      expect(refused.json().error).toBe('bookings_paused');

      const [toAccept, toDecline, toCancel] = ids as [string, string, string];
      const accepted = await inject('POST', `/v1/booking-requests/${toAccept}/accept`, VENDOR);
      const declined = await inject('POST', `/v1/booking-requests/${toDecline}/decline`, VENDOR);
      const cancelled = await inject('POST', `/v1/booking-requests/${toCancel}/cancel`, CUSTOMER);

      expect([accepted.statusCode, declined.statusCode, cancelled.statusCode]).toEqual([
        200, 200, 200,
      ]);
      expect([accepted.json().status, declined.json().status, cancelled.json().status]).toEqual([
        'accepted',
        'declined',
        'cancelled',
      ]);
    });
  });

  describe('beta cap', () => {
    it('refuses a request priced one cent over the cap with 422 over_beta_cap', async () => {
      await signInAsAdmin();
      const vendor = await createVendor(VENDOR, VENDOR_ACCOUNT, BETA_CAP_CENTS + 1);
      await setSwitches({ maxBookingCents: BETA_CAP_CENTS });

      const refused = await requestBooking(vendor);

      expect(refused.statusCode).toBe(422);
      expect(refused.json().error).toBe('over_beta_cap');
      expect(await harness.database.db.select().from(bookingRequests)).toHaveLength(0);
    });

    it('lets a request at exactly the cap through', async () => {
      await signInAsAdmin();
      const vendor = await createVendor(VENDOR, VENDOR_ACCOUNT, BETA_CAP_CENTS);
      await setSwitches({ maxBookingCents: BETA_CAP_CENTS });

      expect((await requestBooking(vendor)).statusCode).toBe(201);
    });

    it('refuses checkout on a request created before the cap was lowered', async () => {
      await signInAsAdmin();
      const vendor = await createVendor(VENDOR, VENDOR_ACCOUNT);
      const requestId = await acceptedRequest(vendor);

      await setSwitches({ maxBookingCents: BETA_CAP_CENTS });
      const refused = await checkout(requestId);

      expect(refused.statusCode).toBe(422);
      expect(refused.json().error).toBe('over_beta_cap');
      expect(harness.stripe.paymentIntents.size).toBe(0);
    });
  });

  describe('payout release pause', () => {
    it('transfers nothing while paused, releases on the next sweep after, and the retry releases by hand', async () => {
      await signInAsAdmin();
      const vendor = await createVendor(VENDOR, VENDOR_ACCOUNT);
      const retried = await paidBooking(VENDOR, vendor);
      const swept = await paidBooking(VENDOR, vendor);
      clockNow = afterLastRelease();

      await setSwitches({ payoutReleasePaused: true });
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toHaveLength(0);

      const manual = await retryPayoutRelease(
        { db: harness.database.db, stripe: harness.stripe, log: harness.app.log },
        retried,
        clockNow,
      );
      expect(manual.outcome).toBe('released');
      expect(harness.stripe.transfers.map((transfer) => transfer.bookingId)).toEqual([retried]);

      await setSwitches({ payoutReleasePaused: false });
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers.map((transfer) => transfer.bookingId)).toEqual([
        retried,
        swept,
      ]);
    });
  });

  describe('vendor payout hold', () => {
    it('skips a held vendor while another vendor releases, and releases once the hold lifts', async () => {
      await signInAsAdmin();
      const held = await createVendor(VENDOR, VENDOR_ACCOUNT);
      const other = await createVendor(VENDOR_TWO, VENDOR_TWO_ACCOUNT);
      const heldBooking = await paidBooking(VENDOR, held);
      const otherBooking = await paidBooking(VENDOR_TWO, other);
      clockNow = afterLastRelease();

      const hold = await inject('PUT', `/v1/admin/vendors/${held.vendorId}/payout-hold`, ADMIN, {
        payoutHold: true,
      });
      expect(hold.statusCode).toBe(200);
      expect(hold.json()).toEqual({ vendorId: held.vendorId, payoutHold: true });
      const holdAlerts = await operatorMail();
      expect(holdAlerts.map((message) => message.subject)).toEqual([
        expect.stringContaining("A vendor's payouts were put on hold"),
      ]);

      const settings = await inject('GET', '/v1/admin/settings', ADMIN);
      expect(settings.json().heldVendors).toEqual([
        { id: held.vendorId, businessName: 'Sunlit Studio', slug: expect.any(String) },
      ]);

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toHaveLength(1);
      expect(harness.stripe.transfers[0]).toMatchObject({
        bookingId: otherBooking,
        destinationAccountId: VENDOR_TWO_ACCOUNT,
      });

      const [audit] = await harness.database.db
        .select()
        .from(adminActions)
        .where(eq(adminActions.action, 'vendor_payout_hold_set'));
      expect(audit).toMatchObject({
        subjectType: 'vendor_profile',
        subjectId: held.vendorId,
        detail: { field: 'payoutHold', before: false, after: true },
      });

      expect(
        (
          await inject('PUT', `/v1/admin/vendors/${held.vendorId}/payout-hold`, ADMIN, {
            payoutHold: true,
          })
        ).statusCode,
      ).toBe(409);

      const lifted = await inject('PUT', `/v1/admin/vendors/${held.vendorId}/payout-hold`, ADMIN, {
        payoutHold: false,
      });
      expect(lifted.statusCode).toBe(200);
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers.map((transfer) => transfer.bookingId)).toEqual([
        otherBooking,
        heldBooking,
      ]);
    });

    it('answers 404 for a vendor that does not exist', async () => {
      await signInAsAdmin();
      const response = await inject(
        'PUT',
        '/v1/admin/vendors/00000000-0000-4000-8000-00000000abcd/payout-hold',
        ADMIN,
        { payoutHold: true },
      );

      expect(response.statusCode).toBe(404);
    });
  });
});
