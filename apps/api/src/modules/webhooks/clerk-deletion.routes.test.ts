import { addDays, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import {
  bookingRequests,
  bookings,
  categories,
  notifications,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  SVIX_HEADERS,
  bearer,
  createTestHarness,
  type TestHarness,
} from '../../testing/test-server.js';

/* Inside the booking horizon, so a rejection here is the vendor and not the date. */
const REQUEST_EVENT_DATE = toDateString(addDays(new Date(), 30));

const VENDOR = 'user_deleted_vendor';
const CUSTOMER = 'user_deleted_customer';

/**
 * The deletion unwind (#433).
 *
 * A vendor who deleted their Clerk identity used to keep a published,
 * searchable, bookable storefront: `softDeleteUserByClerkId` set `deleted_at`
 * and stopped, and no visibility predicate anywhere joined it. Every test here
 * drives the public surface rather than reading the column the fix writes — a
 * grep for `is_deleted` cannot tell a retired storefront from a live one.
 */
describe('POST /webhooks/clerk — user.deleted retires a vendor', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function post(payload: string) {
    return harness.app.inject({
      method: 'POST',
      url: '/webhooks/clerk',
      headers: { ...SVIX_HEADERS, 'content-type': 'application/json' },
      payload,
    });
  }

  function deleteEvent(clerkUserId: string): string {
    return JSON.stringify({ type: 'user.deleted', data: { id: clerkUserId, deleted: true } });
  }

  async function signIn(clerkUserId: string): Promise<string> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(clerkUserId),
    });
    expect(response.statusCode).toBe(200);

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    return rows[0]!.id;
  }

  /** A published storefront on a real vendor account. */
  async function createPublishedVendor(): Promise<{
    profileId: string;
    userId: string;
    slug: string;
  }> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });
    expect(created.statusCode).toBe(201);

    const rows = await harness.database.db
      .select({
        id: vendorProfiles.id,
        userId: vendorProfiles.userId,
        slug: vendorProfiles.slug,
      })
      .from(vendorProfiles)
      .limit(1);
    const row = rows[0]!;

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeAccountId: 'acct_test_433', stripeOnboarded: true })
      .where(eq(vendorProfiles.id, row.id));

    return { profileId: row.id, userId: row.userId, slug: row.slug };
  }

  async function createFutureBooking(
    customerId: string,
    vendorProfileId: string,
    overrides: { eventDate?: string; stripePaymentIntentId?: string } = {},
  ): Promise<string> {
    const eventDate = overrides.eventDate ?? '2099-06-01';

    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendorProfileId,
        eventDate,
        status: 'accepted',
        finalPriceCents: 120_000,
      })
      .returning({ id: bookingRequests.id });

    const bookingRows = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestRows[0]!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate,
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        stripePaymentIntentId: overrides.stripePaymentIntentId ?? 'pi_test_delete',
      })
      .returning({ id: bookings.id });

    return bookingRows[0]!.id;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
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
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.stripe.refunds.length = 0;
    harness.stripe.refundsToRefuse.clear();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('retires the storefront in the same transaction as the user row', async () => {
    const vendor = await createPublishedVendor();

    const response = await post(deleteEvent(VENDOR));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true, outcome: 'deleted' });

    const profiles = await harness.database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendor.profileId));
    expect(profiles[0]).toMatchObject({ isDeleted: true, isPublished: false });

    const rows = await harness.database.db.select().from(users).where(eq(users.id, vendor.userId));
    expect(rows[0]?.deletedAt).toBeInstanceOf(Date);
  });

  it('takes the storefront off every public surface', async () => {
    const vendor = await createPublishedVendor();

    // Live before, so the assertions below are about the deletion and not about
    // a storefront that was never reachable.
    expect((await harness.app.inject({ url: `/vendors/${vendor.slug}` })).statusCode).toBe(200);

    await post(deleteEvent(VENDOR));

    const profile = await harness.app.inject({ url: `/vendors/${vendor.slug}` });
    expect(profile.statusCode).toBe(404);

    const search = await harness.app.inject({ url: '/vendors?name=Sunlit' });
    expect(search.statusCode).toBe(200);
    expect(search.json().items).toEqual([]);

    const nearby = await harness.app.inject({
      url: '/vendors/availability/nearby?date=2099-06-01&city=Austin&state=TX',
    });
    expect(nearby.statusCode).toBe(200);
    expect(nearby.json().items).toEqual([]);

    const conversation = await harness.app.inject({
      method: 'POST',
      url: '/conversations',
      headers: bearer(CUSTOMER),
      payload: { vendorSlug: vendor.slug },
    });
    expect(conversation.statusCode).toBe(404);
  });

  it('declines open requests and refunds future confirmed bookings in full', async () => {
    const customerId = await signIn(CUSTOMER);
    const vendor = await createPublishedVendor();
    const bookingId = await createFutureBooking(customerId, vendor.profileId);

    const openRequest = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendor.profileId,
        eventDate: '2099-07-01',
        status: 'pending',
      })
      .returning({ id: bookingRequests.id });

    await post(deleteEvent(VENDOR));

    expect(harness.stripe.refunds).toHaveLength(1);
    expect(harness.stripe.refunds[0]).toMatchObject({
      paymentIntentId: 'pi_test_delete',
      amountCents: 120_000,
    });

    const booked = await harness.database.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    expect(booked[0]).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'admin',
      refundAmountCents: 120_000,
      vendorPayoutCents: 0,
    });

    const requests = await harness.database.db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, openRequest[0]!.id));
    expect(requests[0]?.status).toBe('declined');
  });

  it('leaves a booking whose refund Stripe refused confirmed, and unwinds the rest', async () => {
    const customerId = await signIn(CUSTOMER);
    const vendor = await createPublishedVendor();
    const refused = await createFutureBooking(customerId, vendor.profileId, {
      eventDate: '2099-06-02',
      stripePaymentIntentId: 'pi_test_refused',
    });
    const refunded = await createFutureBooking(customerId, vendor.profileId, {
      eventDate: '2099-06-03',
      stripePaymentIntentId: 'pi_test_ok',
    });
    harness.stripe.refundsToRefuse.add('pi_test_refused');

    await post(deleteEvent(VENDOR));

    const refusedRow = await harness.database.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, refused));
    expect(refusedRow[0]?.status).toBe('confirmed');

    const refundedRow = await harness.database.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, refunded));
    expect(refundedRow[0]?.status).toBe('cancelled');

    // The storefront still comes down: one stuck refund must not abandon the
    // rest of the unwind, exactly as it does not abandon a ban.
    const profiles = await harness.database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendor.profileId));
    expect(profiles[0]).toMatchObject({ isDeleted: true, isPublished: false });
  });

  it('does not re-refund when Clerk redelivers user.deleted', async () => {
    const customerId = await signIn(CUSTOMER);
    const vendor = await createPublishedVendor();
    await createFutureBooking(customerId, vendor.profileId);

    await post(deleteEvent(VENDOR));
    const replay = await post(deleteEvent(VENDOR));

    expect(replay.json()).toEqual({ received: true, outcome: 'ignored' });
    expect(harness.stripe.refunds).toHaveLength(1);
  });

  it('hides a storefront whose retirement failed but whose owner is deleted', async () => {
    const vendor = await createPublishedVendor();

    await post(deleteEvent(VENDOR));

    /*
     * The belt-and-braces case: the read side must not depend on the write
     * having landed, so put the profile back exactly as a failed retirement
     * would have left it.
     */
    await harness.database.db
      .update(vendorProfiles)
      .set({ isDeleted: false, isPublished: true })
      .where(eq(vendorProfiles.id, vendor.profileId));

    expect((await harness.app.inject({ url: `/vendors/${vendor.slug}` })).statusCode).toBe(404);
    expect((await harness.app.inject({ url: '/vendors?name=Sunlit' })).json().items).toEqual([]);
    expect(
      (
        await harness.app.inject({
          url: '/vendors/availability/nearby?date=2099-06-01&city=Austin&state=TX',
        })
      ).json().items,
    ).toEqual([]);

    await signIn(CUSTOMER);
    const requested = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId: vendor.profileId,
        eventDate: REQUEST_EVENT_DATE,
        customDetails: 'We are planning a wedding and would love to talk about coverage.',
      },
    });
    expect(requested.statusCode).toBe(404);
  });

  /*
   * The free-refund lever this path would otherwise be, and D39's backstop.
   *
   * A customer who cancels a booking twelve hours out gets D3's late tier and
   * the vendor keeps their share. If deleting the account ran the ban's unwind
   * unchanged, the same customer would get **everything** back, across every
   * future booking at once, with the vendors paid nothing — a better refund for
   * walking away than for asking, repeatable behind a fresh sign-up.
   *
   * D39 ruled that such an account cannot be closed at all, and #438 builds
   * that refusal. But a Clerk deletion is reactive — the identity is gone
   * before the webhook hears about it — so this path must still hold the line
   * for a closure that arrives anyway. It leaves the booking standing.
   */
  it('refuses to refund a booking the closed account itself paid for', async () => {
    const customerId = await signIn(CUSTOMER);
    const vendor = await createPublishedVendor();
    const bookingId = await createFutureBooking(customerId, vendor.profileId);

    const response = await post(deleteEvent(CUSTOMER));
    expect(response.json()).toEqual({ received: true, outcome: 'deleted' });

    // No money moved, and the row is untouched — still confirmed, still payable.
    expect(harness.stripe.refunds).toEqual([]);

    const booked = await harness.database.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    expect(booked[0]).toMatchObject({
      status: 'confirmed',
      refundAmountCents: null,
      vendorPayoutCents: 105_600,
    });
  });

  it('still refunds in full when it is the vendor who closed the account', async () => {
    const customerId = await signIn(CUSTOMER);
    const vendor = await createPublishedVendor();
    const bookingId = await createFutureBooking(customerId, vendor.profileId);

    await post(deleteEvent(VENDOR));

    expect(harness.stripe.refunds).toHaveLength(1);
    expect(harness.stripe.refunds[0]).toMatchObject({ amountCents: 120_000 });

    const booked = await harness.database.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    expect(booked[0]).toMatchObject({
      status: 'cancelled',
      refundAmountCents: 120_000,
      vendorPayoutCents: 0,
    });
  });

  it('retires nothing for a customer, and still soft-deletes the row', async () => {
    const customerId = await signIn(CUSTOMER);

    const response = await post(deleteEvent(CUSTOMER));

    expect(response.json()).toEqual({ received: true, outcome: 'deleted' });
    const rows = await harness.database.db.select().from(users).where(eq(users.id, customerId));
    expect(rows[0]?.deletedAt).toBeInstanceOf(Date);
  });
});
