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
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { bookingContextFor } from '../payments/payments.service.js';
import { reconcileAuthUsers } from './auth-sync.reconcile.js';

/* Inside the booking horizon, so a rejection here is the vendor and not the date. */
const REQUEST_EVENT_DATE = toDateString(addDays(new Date(), 30));

const VENDOR = 'user_deleted_vendor';
const CUSTOMER = 'user_deleted_customer';
/** Stays in Neon Auth throughout, so an empty answer is never what a deletion looks like. */
const CONTROL = 'user_deleted_control';

/**
 * The deletion unwind (#433).
 *
 * A vendor whose Neon Auth identity was deleted used to keep a published,
 * searchable, bookable storefront: `softDeleteUserByAuthId` set `deleted_at`
 * and stopped, and no visibility predicate anywhere joined it. Every test here
 * drives the public surface rather than reading the column the fix writes — a
 * grep for `is_deleted` cannot tell a retired storefront from a live one.
 */
describe('the reconcile pass — a deleted Neon Auth identity retires a vendor', () => {
  let harness: TestHarness;
  let photographyId: string;

  /**
   * The identity is deleted at Neon Auth, then the pass runs — the only way a
   * deletion reaches the marketplace, since Neon Auth sends no delete event.
   */
  async function deleteIdentityAndReconcile(authUserId: string) {
    await signIn(CONTROL);
    harness.authUsers.delete(authUserId);

    return reconcileAuthUsers(
      bookingContextFor(harness.app, harness.app.log, 'http://localhost:3000'),
      harness.app.authDirectory!,
      {},
      new Date(),
    );
  }

  async function signIn(authUserId: string): Promise<string> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(authUserId),
    });
    expect(response.statusCode).toBe(200);

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, authUserId))
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

  /** Neon Auth knowing all three people; a test deletes one and the next gets it back. */
  function registerIdentities() {
    for (const [authUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
      [CONTROL, 'customer'],
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
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    registerIdentities();

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
    registerIdentities();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('retires the storefront in the same transaction as the user row', async () => {
    const vendor = await createPublishedVendor();

    const summary = await deleteIdentityAndReconcile(VENDOR);
    expect(summary).toMatchObject({ deleted: 1, updated: 0 });

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

    await deleteIdentityAndReconcile(VENDOR);

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

    await deleteIdentityAndReconcile(VENDOR);

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

    await deleteIdentityAndReconcile(VENDOR);

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

  it('does not re-refund when the pass runs again over the same deletion', async () => {
    const customerId = await signIn(CUSTOMER);
    const vendor = await createPublishedVendor();
    await createFutureBooking(customerId, vendor.profileId);

    await deleteIdentityAndReconcile(VENDOR);
    const replay = await deleteIdentityAndReconcile(VENDOR);

    expect(replay).toMatchObject({ deleted: 0, updated: 0 });
    expect(harness.stripe.refunds).toHaveLength(1);
  });

  it('hides a storefront whose retirement failed but whose owner is deleted', async () => {
    const vendor = await createPublishedVendor();

    await deleteIdentityAndReconcile(VENDOR);

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
   * that refusal. But a deletion at Neon Auth is reactive — the identity is gone
   * before the pass hears about it — so this path must still hold the line
   * for a closure that arrives anyway. It leaves the booking standing.
   */
  it('refuses to refund a booking the closed account itself paid for', async () => {
    const customerId = await signIn(CUSTOMER);
    const vendor = await createPublishedVendor();
    const bookingId = await createFutureBooking(customerId, vendor.profileId);

    const summary = await deleteIdentityAndReconcile(CUSTOMER);
    expect(summary).toMatchObject({ deleted: 1 });

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

    await deleteIdentityAndReconcile(VENDOR);

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

    const summary = await deleteIdentityAndReconcile(CUSTOMER);

    expect(summary).toMatchObject({ deleted: 1 });
    const rows = await harness.database.db.select().from(users).where(eq(users.id, customerId));
    expect(rows[0]?.deletedAt).toBeInstanceOf(Date);
  });
});
