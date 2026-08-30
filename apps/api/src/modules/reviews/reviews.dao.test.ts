import {
  bookingRequests,
  bookings,
  reviews,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import {
  isUniqueViolation,
  recomputeCustomerRating,
  recomputeVendorRating,
} from './reviews.dao.js';

describe('isUniqueViolation', () => {
  it('recognises a bare Postgres error carrying code 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('recognises the Drizzle-wrapped error, whose own .code is absent and whose .cause carries it', () => {
    // The shape Drizzle actually throws (via postgres-js and PGlite alike):
    // a `DrizzleQueryError` with no `.code` of its own, wrapping the driver's
    // error one level down on `.cause`.
    const driverError = new Error('duplicate key value violates unique constraint');
    Object.assign(driverError, { code: '23505' });
    const wrapped = new Error('Failed query: insert into "reviews" ...', { cause: driverError });

    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('rejects an unrelated error', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

/**
 * `recomputeVendorRating` and `recomputeCustomerRating` directly, against a
 * real PGlite engine — not through `POST /reviews`. This is where the
 * deletion half of the ticket's recompute rule is exercised: a review row
 * disappearing and both derived columns settling back to zero. Building the
 * admin `DELETE` route itself is #15's; the recompute it will call is #12's,
 * and this is that call proven correct on its own.
 */
describe('reviews.dao recompute', () => {
  let harness: TestHarness;

  /** One customer, one vendor and one completed booking between them. */
  async function seedCompletedBooking(
    suffix: string,
  ): Promise<{ customerId: string; vendorId: string; vendorUserId: string; bookingId: string }> {
    const [customer] = await harness.database.db
      .insert(users)
      .values({
        clerkUserId: `user_${suffix}_customer`,
        email: `${suffix}-customer@example.com`,
        role: 'customer',
        firstName: 'Dora',
        lastName: 'Duplicate',
      })
      .returning({ id: users.id });

    const [owner] = await harness.database.db
      .insert(users)
      .values({
        clerkUserId: `user_${suffix}_vendor`,
        email: `${suffix}-vendor@example.com`,
        role: 'vendor',
        firstName: 'Wren',
        lastName: 'Field',
      })
      .returning({ id: users.id });

    const [profile] = await harness.database.db
      .insert(vendorProfiles)
      .values({ userId: owner!.id, businessName: 'Wren & Field', slug: `wren-field-${suffix}` })
      .returning({ id: vendorProfiles.id });

    const [request] = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId: customer!.id,
        vendorId: profile!.id,
        eventDate: '2027-06-14',
        status: 'accepted',
        finalPriceCents: 145_000,
      })
      .returning({ id: bookingRequests.id });

    const [booking] = await harness.database.db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId: customer!.id,
        vendorId: profile!.id,
        eventDate: '2027-06-14',
        totalAmountCents: 145_000,
        platformFeeCents: 17_400,
        vendorPayoutCents: 127_600,
        status: 'completed',
      })
      .returning({ id: bookings.id });

    return {
      customerId: customer!.id,
      vendorId: profile!.id,
      vendorUserId: owner!.id,
      bookingId: booking!.id,
    };
  }

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterEach(async () => {
    await harness.database.db.delete(reviews);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('sets avg_rating and review_count to zero once the last review is gone', async () => {
    const { customerId, vendorId, bookingId } = await seedCompletedBooking('recompute-vendor');

    const [reviewRow] = await harness.database.db
      .insert(reviews)
      .values({
        bookingId,
        reviewerId: customerId,
        vendorId,
        type: 'customer_to_vendor',
        rating: 4,
        content: 'Great to work with, would recommend to anyone.',
      })
      .returning();

    await recomputeVendorRating(harness.database.db, vendorId);

    const [afterInsert] = await harness.database.db
      .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId));
    expect(Number(afterInsert!.avgRating)).toBe(4);
    expect(afterInsert!.reviewCount).toBe(1);

    await harness.database.db.delete(reviews).where(eq(reviews.id, reviewRow!.id));
    await recomputeVendorRating(harness.database.db, vendorId);

    const [afterDelete] = await harness.database.db
      .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId));
    expect(Number(afterDelete!.avgRating)).toBe(0);
    expect(afterDelete!.reviewCount).toBe(0);
  });

  it('sets avg_customer_rating and customer_review_count to zero once the last review is gone', async () => {
    const { customerId, vendorId, vendorUserId, bookingId } =
      await seedCompletedBooking('recompute-customer');

    const [reviewRow] = await harness.database.db
      .insert(reviews)
      .values({
        bookingId,
        reviewerId: vendorUserId,
        vendorId,
        type: 'vendor_to_customer',
        rating: 2,
        content: 'Difficult to reach in the lead-up to the event itself.',
      })
      .returning();

    await recomputeCustomerRating(harness.database.db, customerId);

    const [afterInsert] = await harness.database.db
      .select({
        avgCustomerRating: users.avgCustomerRating,
        customerReviewCount: users.customerReviewCount,
      })
      .from(users)
      .where(eq(users.id, customerId));
    expect(Number(afterInsert!.avgCustomerRating)).toBe(2);
    expect(afterInsert!.customerReviewCount).toBe(1);

    await harness.database.db.delete(reviews).where(eq(reviews.id, reviewRow!.id));
    await recomputeCustomerRating(harness.database.db, customerId);

    const [afterDelete] = await harness.database.db
      .select({
        avgCustomerRating: users.avgCustomerRating,
        customerReviewCount: users.customerReviewCount,
      })
      .from(users)
      .where(eq(users.id, customerId));
    expect(Number(afterDelete!.avgCustomerRating)).toBe(0);
    expect(afterDelete!.customerReviewCount).toBe(0);
  });
});
