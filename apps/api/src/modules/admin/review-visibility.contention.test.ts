import {
  bookingRequests,
  bookings,
  categories,
  reviews,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

/**
 * Two operators reaching the same review at once — the debt PGlite cannot pay.
 *
 * `setReviewVisibilityAndRecalculate` decides whether a review is *already* in
 * the requested state and then recomputes the vendor's rating from the rows that
 * remain public. Both halves are read-then-write, so without the `FOR UPDATE`
 * that guards the row the second operator reads `is_public = true`, agrees the
 * hide is needed, and recomputes from a snapshot taken before the first
 * operator's commit — persisting an average that counts a review it has just
 * been told to exclude. Nothing ever corrects it: the next recompute only runs
 * when somebody moderates again.
 *
 * **PGlite is one connection**, so its `db.transaction` callbacks run to
 * completion one after another and a `Promise.all` there passes with the lock
 * deleted (#399). This suite runs on a real Postgres for the same reason
 * `accept.contention.test.ts` does.
 */
describe('hiding one review from two operators at once', () => {
  const ADMIN_ONE = 'user_admin_one';
  const ADMIN_TWO = 'user_admin_two';
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let vendorId: string;
  let reviewId: string;

  async function seedReview(rating: number): Promise<string> {
    const db = harness!.database.db;
    const [customer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, CUSTOMER))
      .limit(1);
    const eventDate = `209${rating}-06-01`;

    const [request] = await db
      .insert(bookingRequests)
      .values({
        customerId: customer!.id,
        vendorId,
        eventDate,
        status: 'accepted',
        finalPriceCents: 120_000,
      })
      .returning({ id: bookingRequests.id });

    const [booking] = await db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId: customer!.id,
        vendorId,
        eventDate,
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'completed',
      })
      .returning({ id: bookings.id });

    const [review] = await db
      .insert(reviews)
      .values({
        bookingId: booking!.id,
        reviewerId: customer!.id,
        vendorId,
        type: 'customer_to_vendor',
        rating,
        content: `A review at ${rating} stars, long enough to look like prose.`,
      })
      .returning({ id: reviews.id });

    return review!.id;
  }

  beforeAll(async () => {
    // Four connections, so both requests can genuinely be in flight at once.
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const [clerkUserId, role] of [
      [ADMIN_ONE, 'customer'],
      [ADMIN_TWO, 'customer'],
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

    for (const clerkUserId of [VENDOR, CUSTOMER]) {
      await signInAs(harness, clerkUserId);
    }
    for (const clerkUserId of [ADMIN_ONE, ADMIN_TWO]) {
      await signInAs(harness, clerkUserId, true);
    }

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Fernbank Studio',
        categoryIds: [photography!.id],
        city: 'Austin',
        state: 'TX',
        bio: 'Fernbank Studio photographs weddings across central Texas.',
        responseTimeHours: 24,
      },
    });
    expect(profile.statusCode).toBe(201);
    vendorId = profile.json().id;

    // 5 and 1: the average moves from 3 to 5 when the 1 is hidden, so a
    // recompute that counted the hidden row leaves a number this test can name.
    await seedReview(5);
    reviewId = await seedReview(1);
  });

  afterAll(async () => {
    await harness?.close();
    await database?.close();
  });

  it('lets exactly one of two concurrent hides through, and recomputes once', async () => {
    const hide = (actor: string) =>
      harness!.app.inject({
        method: 'PUT',
        url: `/admin/reviews/${reviewId}/visibility`,
        headers: bearer(actor),
        payload: { isPublic: false },
      });

    const [first, second] = await Promise.all([hide(ADMIN_ONE), hide(ADMIN_TWO)]);
    const codes = [first.statusCode, second.statusCode].sort();

    /*
     * 200 and 409, in whichever order the two connections happened to win. Two
     * 200s would mean both callers were told they had hidden it, and the second
     * of them would have recomputed the rating from a snapshot that still
     * counted the review.
     */
    expect(codes).toEqual([200, 409]);

    const [row] = await harness!.database.db
      .select({ avgRating: vendorProfiles.avgRating, reviewCount: vendorProfiles.reviewCount })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId))
      .limit(1);

    // The 1-star row is gone from the aggregate, and the 5-star row is not.
    expect(row).toEqual({ avgRating: '5.00', reviewCount: 1 });

    const [stored] = await harness!.database.db
      .select({ isPublic: reviews.isPublic })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);
    expect(stored!.isPublic).toBe(false);
  });
});
