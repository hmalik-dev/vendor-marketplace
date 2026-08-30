import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  BOOKING_REQUEST_STATUSES,
  BOOKING_STATUSES,
  CATEGORY_SLUGS,
  EVENT_TYPES,
  NOTIFICATION_TYPES,
  addDays,
} from '@vendor-marketplace/shared';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DEMO_CATEGORY_IMAGES,
  DEMO_CUSTOMERS,
  DEMO_SEED_PREFIX,
  DEMO_VENDORS,
  demoImageFor,
} from './demo-seed-data.js';
import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  messages,
  notifications,
  portfolioItems,
  reviews,
  servicePackages,
  users,
  vendorCategories,
  vendorProfiles,
} from './schema/index.js';
import { seedReferenceData } from './seed.js';
import {
  buildDemoBookingPlan,
  clearDemoData,
  demoVendorProfileId,
  seedDemoData,
  type DemoSeedResult,
} from './seed-demo.js';
import { createTestDatabase, type TestDatabase } from './testing/test-db.js';

let testDb: TestDatabase;

/** Pinned so every derived date — and therefore every assertion — is stable. */
const NOW = new Date('2026-06-15T00:00:00.000Z');

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
  await seedReferenceData(testDb.db);
}, 120_000);

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await clearDemoData(testDb.db);
});

/** Ids of the demo vendor profiles, read back rather than assumed. */
async function demoVendorIds(): Promise<string[]> {
  const rows = await testDb.db
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(
      inArray(
        vendorProfiles.slug,
        DEMO_VENDORS.map((vendor) => vendor.slug),
      ),
    );

  return rows.map((row) => row.id);
}

describe('buildDemoBookingPlan', () => {
  const plan = buildDemoBookingPlan();

  it('covers every booking request status', () => {
    const covered = new Set(plan.map((entry) => entry.requestStatus));

    for (const status of BOOKING_REQUEST_STATUSES) {
      expect(covered).toContain(status);
    }
  });

  it('covers every booking status', () => {
    const covered = new Set(
      plan.filter((entry) => entry.bookingStatus !== null).map((entry) => entry.bookingStatus),
    );

    for (const status of BOOKING_STATUSES) {
      expect(covered).toContain(status);
    }
  });

  it('plans at least the 29 requests the ticket asks for', () => {
    expect(plan.length).toBeGreaterThanOrEqual(29);
  });

  it('gives every request a distinct event date, so no live-request index can collide', () => {
    const offsets = plan.map((entry) => entry.eventDayOffset);

    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it('only ever puts a booking behind an accepted request', () => {
    for (const entry of plan.filter((item) => item.bookingStatus !== null)) {
      expect(entry.requestStatus).toBe('accepted');
    }
  });

  it('dates open work in the future and settled work in the past', () => {
    for (const entry of plan) {
      const open =
        entry.bookingStatus === 'confirmed' ||
        (entry.bookingStatus === null &&
          ['pending', 'quoted', 'accepted'].includes(entry.requestStatus));

      expect(entry.eventDayOffset > 0).toBe(open);
    }
  });

  it('is identical across calls', () => {
    expect(buildDemoBookingPlan()).toEqual(plan);
  });

  it('leaves the new-member customer out of the booking graph', () => {
    const newMemberIndex = DEMO_CUSTOMERS.findIndex((customer) => customer.bookingShare === 0);
    expect(newMemberIndex).toBeGreaterThanOrEqual(0);

    expect(plan.some((entry) => entry.customerIndex === newMemberIndex)).toBe(false);
  });
});

describe('seedDemoData', () => {
  it('populates every category with at least one published vendor', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ slug: categories.slug, vendorId: vendorCategories.vendorId })
      .from(categories)
      .innerJoin(vendorCategories, eq(vendorCategories.categoryId, categories.id))
      .innerJoin(
        vendorProfiles,
        and(eq(vendorProfiles.id, vendorCategories.vendorId), eq(vendorProfiles.isPublished, true)),
      );

    const populated = new Set(rows.map((row) => row.slug));

    for (const slug of CATEGORY_SLUGS) {
      expect(populated).toContain(slug);
    }
  });

  it('writes every booking request status the schema allows', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookingRequests.vendorId))
      .where(
        inArray(
          vendorProfiles.slug,
          DEMO_VENDORS.map((vendor) => vendor.slug),
        ),
      );

    expect(rows.length).toBeGreaterThanOrEqual(29);
    expect(new Set(rows.map((row) => row.status))).toEqual(new Set(BOOKING_REQUEST_STATUSES));
  });

  it('writes every booking status the schema allows', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ status: bookings.status })
      .from(bookings)
      .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
      .where(
        inArray(
          vendorProfiles.slug,
          DEMO_VENDORS.map((vendor) => vendor.slug),
        ),
      );

    expect(new Set(rows.map((row) => row.status))).toEqual(new Set(BOOKING_STATUSES));
  });

  it('writes at least 20 reviews, in both directions, with the resolved visibility', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ type: reviews.type, isPublic: reviews.isPublic, rating: reviews.rating })
      .from(reviews)
      .where(inArray(reviews.vendorId, await demoVendorIds()));

    expect(rows.length).toBeGreaterThanOrEqual(20);

    const customerToVendor = rows.filter((row) => row.type === 'customer_to_vendor');
    const vendorToCustomer = rows.filter((row) => row.type === 'vendor_to_customer');

    expect(customerToVendor.length).toBeGreaterThan(0);
    expect(vendorToCustomer.length).toBeGreaterThan(0);

    // The asymmetry resolved in `99-open-questions.md` #3.
    expect(customerToVendor.every((row) => row.isPublic)).toBe(true);
    expect(vendorToCustomer.every((row) => !row.isPublic)).toBe(true);

    for (const row of rows) {
      expect(row.rating).toBeGreaterThanOrEqual(1);
      expect(row.rating).toBeLessThanOrEqual(5);
    }
  });

  it('gives every request a positive guest count', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ guestCount: bookingRequests.guestCount })
      .from(bookingRequests)
      .where(inArray(bookingRequests.vendorId, await demoVendorIds()));

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.guestCount).toBeGreaterThan(0);
    }
  });

  it('leaves every pending request with an expiry still ahead of it', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ expiresAt: bookingRequests.expiresAt, createdAt: bookingRequests.createdAt })
      .from(bookingRequests)
      .where(
        and(
          inArray(bookingRequests.vendorId, await demoVendorIds()),
          eq(bookingRequests.status, 'pending'),
        ),
      );

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      // A pending request already past its expiry is not pending in practice:
      // the lazy sweep in `expireBookingRequests` flips it on the next read.
      expect(row.expiresAt).not.toBeNull();
      expect(row.expiresAt!.getTime()).toBeGreaterThan(NOW.getTime());
      expect(row.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }

    const dated = await testDb.db
      .select({ expiresAt: bookingRequests.expiresAt, eventDate: bookingRequests.eventDate })
      .from(bookingRequests)
      .where(
        and(
          inArray(bookingRequests.vendorId, await demoVendorIds()),
          eq(bookingRequests.status, 'pending'),
        ),
      );

    for (const row of dated) {
      // A request cannot outlive the event it is for.
      expect(row.expiresAt!.toISOString().slice(0, 10) <= row.eventDate).toBe(true);
    }
  });

  it('writes event types from the closed vocabulary, not display labels', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ eventType: bookingRequests.eventType })
      .from(bookingRequests)
      .where(inArray(bookingRequests.vendorId, await demoVendorIds()));

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      // `booking_requests.event_type` is validated by `eventTypeSchema`
      // (`z.enum(EVENT_TYPES)`) at the API edge, so the column holds the slug.
      // Seeding a label puts rows in the database the product would reject.
      expect(EVENT_TYPES).toContain(row.eventType);
    }
  });

  it('attaches a review only to a completed booking', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ status: bookings.status })
      .from(reviews)
      .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
      .where(inArray(reviews.vendorId, await demoVendorIds()));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === 'completed')).toBe(true);
  });

  it('gives every booking request a conversation with between 3 and 10 messages', async () => {
    await seedDemoData(testDb.db, NOW);

    const vendorIds = await demoVendorIds();

    const threads = await testDb.db
      .select({
        conversationId: conversations.id,
        messageCount: sql<number>`count(${messages.id})::int`,
      })
      .from(conversations)
      .innerJoin(messages, eq(messages.conversationId, conversations.id))
      .where(inArray(conversations.vendorId, vendorIds))
      .groupBy(conversations.id);

    const requestCount = buildDemoBookingPlan().length;
    expect(threads.length).toBe(requestCount);

    for (const thread of threads) {
      expect(thread.messageCount).toBeGreaterThanOrEqual(3);
      expect(thread.messageCount).toBeLessThanOrEqual(10);
    }
  });

  it('recomputes avg_rating and review_count from the reviews rather than writing them', async () => {
    await seedDemoData(testDb.db, NOW);

    const vendorIds = await demoVendorIds();

    const profiles = await testDb.db
      .select({
        id: vendorProfiles.id,
        avgRating: vendorProfiles.avgRating,
        reviewCount: vendorProfiles.reviewCount,
      })
      .from(vendorProfiles)
      .where(inArray(vendorProfiles.id, vendorIds));

    const publicReviews = await testDb.db
      .select({ vendorId: reviews.vendorId, rating: reviews.rating })
      .from(reviews)
      .where(
        and(
          inArray(reviews.vendorId, vendorIds),
          eq(reviews.type, 'customer_to_vendor'),
          eq(reviews.isPublic, true),
        ),
      );

    expect(profiles).toHaveLength(DEMO_VENDORS.length);
    expect(publicReviews.length).toBeGreaterThan(0);

    for (const profile of profiles) {
      const ratings = publicReviews
        .filter((review) => review.vendorId === profile.id)
        .map((review) => review.rating);

      const expectedAverage =
        ratings.length === 0
          ? 0
          : ratings.reduce((total, rating) => total + rating, 0) / ratings.length;

      expect(profile.reviewCount).toBe(ratings.length);
      expect(Number(profile.avgRating)).toBeCloseTo(expectedAverage, 2);
    }

    // A seed that reviewed nobody would satisfy the loop above vacuously.
    expect(profiles.some((profile) => profile.reviewCount > 0)).toBe(true);
  });

  it('never books a vendor and blocks them on the same date', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ vendorId: availability.vendorId, date: availability.date })
      .from(availability)
      .where(inArray(availability.vendorId, await demoVendorIds()));

    const keys = rows.map((row) => `${row.vendorId}:${row.date}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('writes every notification type the product defines', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ type: notifications.type })
      .from(notifications)
      .innerJoin(users, eq(users.id, notifications.userId))
      .where(like(users.clerkUserId, `${DEMO_SEED_PREFIX}%`));

    expect(new Set(rows.map((row) => row.type))).toEqual(new Set(NOTIFICATION_TYPES));
  });

  it('seeds one admin, the demo customers and the demo vendors', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ role: users.role })
      .from(users)
      .where(like(users.clerkUserId, `${DEMO_SEED_PREFIX}%`));

    const byRole = rows.reduce<Record<string, number>>((counts, row) => {
      counts[row.role] = (counts[row.role] ?? 0) + 1;
      return counts;
    }, {});

    expect(byRole).toEqual({
      admin: 1,
      customer: DEMO_CUSTOMERS.length,
      vendor: DEMO_VENDORS.length,
    });
  });

  it('gives every vendor between 2 and 4 packages', async () => {
    await seedDemoData(testDb.db, NOW);

    const vendorIds = await demoVendorIds();

    const packageRows = await testDb.db
      .select({ vendorId: servicePackages.vendorId })
      .from(servicePackages)
      .where(inArray(servicePackages.vendorId, vendorIds));

    expect(vendorIds).toHaveLength(DEMO_VENDORS.length);

    for (const vendorId of vendorIds) {
      const packageCount = packageRows.filter((row) => row.vendorId === vendorId).length;

      expect(packageCount).toBeGreaterThanOrEqual(2);
      expect(packageCount).toBeLessThanOrEqual(6);
    }
  });

  it('gives a portfolio to exactly the vendors whose category has an image', async () => {
    await seedDemoData(testDb.db, NOW);

    const rows = await testDb.db
      .select({ slug: vendorProfiles.slug, imageUrl: portfolioItems.imageUrl })
      .from(portfolioItems)
      .innerJoin(vendorProfiles, eq(vendorProfiles.id, portfolioItems.vendorId))
      .where(inArray(portfolioItems.vendorId, await demoVendorIds()));

    const illustrated = DEMO_VENDORS.filter((vendor) => demoImageFor(vendor.categorySlug) !== null);
    const bare = DEMO_VENDORS.filter((vendor) => demoImageFor(vendor.categorySlug) === null);

    expect(illustrated.length).toBeGreaterThan(0);
    // The placeholder half of the dataset has to exist, or it proves nothing.
    expect(bare.length).toBeGreaterThan(0);

    for (const vendor of illustrated) {
      const count = rows.filter((row) => row.slug === vendor.slug).length;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(6);
    }

    for (const vendor of bare) {
      expect(rows.some((row) => row.slug === vendor.slug)).toBe(false);
    }
  });

  it('removes rows an earlier version of the seed wrote but this one no longer emits', async () => {
    await seedDemoData(testDb.db, NOW);

    const vendorIds = await demoVendorIds();
    const vendorId = vendorIds[0] as string;

    /*
     * The "corrected writer leaves a legacy" trap in `.claude/rules/db-schema.md`.
     * An upsert only repairs rows it still emits: when the seed stops writing a
     * row, the row it wrote last time is never revisited and survives for ever.
     * That is not hypothetical here — the seed once wrote portfolio items for
     * every vendor, and now writes none for the categories with no licensed
     * image, so every database seeded before that change kept a broken gallery.
     */
    await testDb.db.insert(portfolioItems).values({
      vendorId,
      imageUrl: '/demo/vendors/gone/portfolio-1.jpg',
      thumbnailUrl: '/demo/vendors/gone/portfolio-1-thumb.jpg',
      caption: 'Written by an older version of the seed',
      displayOrder: 99,
    });

    const stale = await testDb.db
      .select({ id: portfolioItems.id })
      .from(portfolioItems)
      .where(
        and(
          eq(portfolioItems.vendorId, vendorId),
          eq(portfolioItems.imageUrl, '/demo/vendors/gone/portfolio-1.jpg'),
        ),
      );
    expect(stale).toHaveLength(1);

    await seedDemoData(testDb.db, NOW);

    const survivors = await testDb.db
      .select({ id: portfolioItems.id })
      .from(portfolioItems)
      .where(
        and(
          eq(portfolioItems.vendorId, vendorId),
          eq(portfolioItems.imageUrl, '/demo/vendors/gone/portfolio-1.jpg'),
        ),
      );

    expect(survivors).toHaveLength(0);
  });

  it('never prunes a row belonging to an account it does not own', async () => {
    await seedDemoData(testDb.db, NOW);

    const vendorId = (await demoVendorIds())[0] as string;

    /*
     * The convergence prune has to distinguish "a row I wrote last time and no
     * longer write" from "a row somebody else made against my vendor". Scoping
     * it by `vendor_id` cannot tell them apart, and would delete a real request
     * on the next ordinary seed run — which is what browser verification
     * produces every time it drives the request flow against a demo storefront.
     */
    const [outsider] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'outsider_prune_guard',
        email: 'prune-guard@example.test',
        role: 'customer',
        firstName: 'Outside',
        lastName: 'Customer',
      })
      .returning({ id: users.id });

    const [request] = await testDb.db
      .insert(bookingRequests)
      .values({
        customerId: outsider!.id,
        vendorId,
        eventDate: '2027-03-02',
        status: 'pending',
      })
      .returning({ id: bookingRequests.id });

    await seedDemoData(testDb.db, NOW);

    const survivors = await testDb.db
      .select({ id: bookingRequests.id })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, request!.id));

    expect(survivors).toHaveLength(1);

    await testDb.db.delete(bookingRequests).where(eq(bookingRequests.id, request!.id));
    await testDb.db.delete(users).where(eq(users.id, outsider!.id));
  });

  it('never seeds an image path outside the assets that actually exist', async () => {
    await seedDemoData(testDb.db, NOW);

    const allowed = new Set(Object.values(DEMO_CATEGORY_IMAGES));
    const vendorIds = await demoVendorIds();

    const profiles = await testDb.db
      .select({
        profileImageUrl: vendorProfiles.profileImageUrl,
        coverImageUrl: vendorProfiles.coverImageUrl,
      })
      .from(vendorProfiles)
      .where(inArray(vendorProfiles.id, vendorIds));

    const portfolio = await testDb.db
      .select({ imageUrl: portfolioItems.imageUrl, thumbnailUrl: portfolioItems.thumbnailUrl })
      .from(portfolioItems)
      .where(inArray(portfolioItems.vendorId, vendorIds));

    /*
     * The guard against the defect this replaced: the seed used to point at
     * `/demo/vendors/<slug>/cover.jpg`, which no file backs. A null image gets
     * the designed placeholder; a dead path gets a broken-image glyph.
     */
    for (const row of profiles) {
      expect(row.profileImageUrl).toBeNull();
      if (row.coverImageUrl !== null) {
        expect(allowed).toContain(row.coverImageUrl);
      }
    }

    expect(portfolio.length).toBeGreaterThan(0);

    for (const row of portfolio) {
      expect(allowed).toContain(row.imageUrl);
      expect(allowed).toContain(row.thumbnailUrl);
    }
  });

  it('derives a stable vendor profile id that the seeded row actually carries', async () => {
    await seedDemoData(testDb.db, NOW);

    const first = DEMO_VENDORS[0] as (typeof DEMO_VENDORS)[number];

    const rows = await testDb.db
      .select({ id: vendorProfiles.id })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.slug, first.slug));

    expect(rows[0]?.id).toBe(demoVendorProfileId(first.key));
  });

  it('rejects a vendor key it does not know, rather than returning a dead id', () => {
    expect(() => demoVendorProfileId('not-a-demo-vendor')).toThrow(/no demo vendor/i);
  });
});

describe('idempotency and determinism', () => {
  /** Row counts across every table the seed writes. */
  async function rowCounts(): Promise<Record<string, number>> {
    const vendorIds = await demoVendorIds();
    const owned = await testDb.db
      .select({ id: users.id })
      .from(users)
      .where(like(users.clerkUserId, `${DEMO_SEED_PREFIX}%`));
    const ownedIds = owned.map((row) => row.id);

    const count = async (rows: Promise<unknown[]>): Promise<number> => (await rows).length;

    return {
      users: ownedIds.length,
      vendorProfiles: vendorIds.length,
      packages: await count(
        testDb.db
          .select({ id: servicePackages.id })
          .from(servicePackages)
          .where(inArray(servicePackages.vendorId, vendorIds)),
      ),
      portfolioItems: await count(
        testDb.db
          .select({ id: portfolioItems.id })
          .from(portfolioItems)
          .where(inArray(portfolioItems.vendorId, vendorIds)),
      ),
      requests: await count(
        testDb.db
          .select({ id: bookingRequests.id })
          .from(bookingRequests)
          .where(inArray(bookingRequests.vendorId, vendorIds)),
      ),
      bookings: await count(
        testDb.db
          .select({ id: bookings.id })
          .from(bookings)
          .where(inArray(bookings.vendorId, vendorIds)),
      ),
      conversations: await count(
        testDb.db
          .select({ id: conversations.id })
          .from(conversations)
          .where(inArray(conversations.vendorId, vendorIds)),
      ),
      reviews: await count(
        testDb.db
          .select({ id: reviews.id })
          .from(reviews)
          .where(inArray(reviews.vendorId, vendorIds)),
      ),
      notifications: await count(
        testDb.db
          .select({ id: notifications.id })
          .from(notifications)
          .where(inArray(notifications.userId, ownedIds)),
      ),
      availability: await count(
        testDb.db
          .select({ id: availability.id })
          .from(availability)
          .where(inArray(availability.vendorId, vendorIds)),
      ),
    };
  }

  /**
   * A fingerprint of the seeded content, not merely its size.
   *
   * Counts alone would pass an upsert that rewrote every row with different
   * content, which is exactly the drift the determinism criterion is about.
   * Built in JavaScript rather than SQL so the vendor filter stays a real
   * parameterised `IN` list.
   */
  async function fingerprint(): Promise<string> {
    const vendorIds = await demoVendorIds();

    const requestRows = await testDb.db
      .select({
        id: bookingRequests.id,
        status: bookingRequests.status,
        eventDate: bookingRequests.eventDate,
        quoted: bookingRequests.quotedPriceCents,
        final: bookingRequests.finalPriceCents,
      })
      .from(bookingRequests)
      .where(inArray(bookingRequests.vendorId, vendorIds));

    const bookingRows = await testDb.db
      .select({
        id: bookings.id,
        status: bookings.status,
        total: bookings.totalAmountCents,
        fee: bookings.platformFeeCents,
        payout: bookings.vendorPayoutCents,
      })
      .from(bookings)
      .where(inArray(bookings.vendorId, vendorIds));

    const reviewRows = await testDb.db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        type: reviews.type,
        isPublic: reviews.isPublic,
        content: reviews.content,
      })
      .from(reviews)
      .where(inArray(reviews.vendorId, vendorIds));

    const messageRows = await testDb.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        content: messages.content,
      })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(inArray(conversations.vendorId, vendorIds));

    const availabilityRows = await testDb.db
      .select({ id: availability.id, date: availability.date, status: availability.status })
      .from(availability)
      .where(inArray(availability.vendorId, vendorIds));

    const lines = [
      ...requestRows.map(
        (row) => `r:${row.id}:${row.status}:${row.eventDate}:${row.quoted}:${row.final}`,
      ),
      ...bookingRows.map(
        (row) => `b:${row.id}:${row.status}:${row.total}:${row.fee}:${row.payout}`,
      ),
      ...reviewRows.map(
        (row) => `v:${row.id}:${row.rating}:${row.type}:${row.isPublic}:${row.content}`,
      ),
      ...messageRows.map(
        (row) => `m:${row.id}:${row.conversationId}:${row.senderId}:${row.content}`,
      ),
      ...availabilityRows.map((row) => `a:${row.id}:${row.date}:${row.status}`),
    ].sort();

    expect(lines.length).toBeGreaterThan(0);

    return createHash('sha256').update(lines.join('|')).digest('hex');
  }

  it('is idempotent — a second run changes no row count', async () => {
    const first: DemoSeedResult = await seedDemoData(testDb.db, NOW);
    const countsAfterFirst = await rowCounts();

    const second: DemoSeedResult = await seedDemoData(testDb.db, NOW);
    const countsAfterSecond = await rowCounts();

    expect(countsAfterSecond).toEqual(countsAfterFirst);
    expect(second).toEqual(first);
  });

  it('converges when the clock has moved, not just when it is pinned', async () => {
    await seedDemoData(testDb.db, NOW);
    const first = await rowCounts();

    /*
     * The case the pinned-`now` idempotency test cannot reach. `now` defaults
     * to the wall clock in real use, and the availability id embeds the date
     * string — so a run on a later day derives a different set of ids, and
     * without the convergence prune the vendor's calendar accumulates blocked
     * days for ever. `vendor-search.dao.ts` excludes a vendor whose date is
     * blocked, so an accumulating calendar quietly removes them from every
     * date-filtered search.
     */
    await seedDemoData(testDb.db, addDays(NOW, 30));
    const second = await rowCounts();

    expect(second.availability).toBe(first.availability);
    expect(second.requests).toBe(first.requests);
    expect(second.bookings).toBe(first.bookings);
    expect(second.notifications).toBe(first.notifications);
    expect(second.users).toBe(first.users);
  });

  it('is deterministic — two fresh runs produce identical data', async () => {
    await seedDemoData(testDb.db, NOW);
    const firstDigest = await fingerprint();

    await clearDemoData(testDb.db);
    await seedDemoData(testDb.db, NOW);
    const secondDigest = await fingerprint();

    expect(secondDigest).toBe(firstDigest);
  });

  it('reports the counts it actually wrote', async () => {
    const result = await seedDemoData(testDb.db, NOW);
    const counts = await rowCounts();

    expect(result.usersUpserted).toBe(counts.users);
    expect(result.vendorsUpserted).toBe(counts.vendorProfiles);
    expect(result.packagesUpserted).toBe(counts.packages);
    expect(result.requestsUpserted).toBe(counts.requests);
    expect(result.bookingsUpserted).toBe(counts.bookings);
    expect(result.reviewsUpserted).toBe(counts.reviews);
    expect(result.notificationsUpserted).toBe(counts.notifications);
    expect(result.availabilityRowsUpserted).toBe(counts.availability);
  });

  it('needs no Clerk or Stripe credentials', async () => {
    const saved = {
      clerk: process.env.CLERK_SECRET_KEY,
      stripe: process.env.STRIPE_SECRET_KEY,
    };
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;

    try {
      const result = await seedDemoData(testDb.db, NOW);
      expect(result.vendorsUpserted).toBe(DEMO_VENDORS.length);
    } finally {
      if (saved.clerk !== undefined) process.env.CLERK_SECRET_KEY = saved.clerk;
      if (saved.stripe !== undefined) process.env.STRIPE_SECRET_KEY = saved.stripe;
    }
  });
});

describe('clearDemoData', () => {
  it('removes every row the seed owns', async () => {
    await seedDemoData(testDb.db, NOW);
    await clearDemoData(testDb.db);

    const remainingUsers = await testDb.db
      .select({ id: users.id })
      .from(users)
      .where(like(users.clerkUserId, `${DEMO_SEED_PREFIX}%`));
    const remainingVendors = await demoVendorIds();

    expect(remainingUsers).toHaveLength(0);
    expect(remainingVendors).toHaveLength(0);
  });

  it('leaves the reference categories in place', async () => {
    await seedDemoData(testDb.db, NOW);
    await clearDemoData(testDb.db);

    const rows = await testDb.db.select({ slug: categories.slug }).from(categories);

    expect(rows.length).toBeGreaterThanOrEqual(CATEGORY_SLUGS.length);
  });

  it('clears a demo vendor whose booking came from a customer it does not own', async () => {
    await seedDemoData(testDb.db, NOW);

    const vendorIds = await demoVendorIds();
    const vendorId = vendorIds[0] as string;

    /*
     * The scenario the two-delete teardown has to survive: someone books a demo
     * vendor from their own account in a development database. `bookings` holds
     * `customer_id`, `vendor_id` AND `request_id` as RESTRICT, so a teardown
     * that only deletes bookings belonging to demo *customers* leaves this row
     * behind, and the cascade from `users` then fails on it.
     */
    const [outsider] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'outsider_not_a_demo_row',
        email: 'outsider@example.test',
        role: 'customer',
        firstName: 'Outside',
        lastName: 'Customer',
      })
      .returning({ id: users.id });

    const [request] = await testDb.db
      .insert(bookingRequests)
      .values({
        customerId: outsider!.id,
        vendorId,
        eventDate: '2027-01-15',
        status: 'accepted',
        finalPriceCents: 100_000,
      })
      .returning({ id: bookingRequests.id });

    await testDb.db.insert(bookings).values({
      requestId: request!.id,
      customerId: outsider!.id,
      vendorId,
      eventDate: '2027-01-15',
      totalAmountCents: 100_000,
      platformFeeCents: 10_000,
      vendorPayoutCents: 90_000,
      status: 'confirmed',
    });

    await expect(clearDemoData(testDb.db)).resolves.toBeUndefined();

    expect(await demoVendorIds()).toHaveLength(0);
    const orphans = await testDb.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.vendorId, vendorId));
    expect(orphans).toHaveLength(0);

    // The outsider is not ours to delete.
    const survivors = await testDb.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, outsider!.id));
    expect(survivors).toHaveLength(1);

    await testDb.db.delete(users).where(eq(users.id, outsider!.id));
  });

  it('is safe to run when nothing was ever seeded', async () => {
    await expect(clearDemoData(testDb.db)).resolves.toBeUndefined();
  });
});

describe('the seed script', () => {
  const SCRIPT = fileURLToPath(new URL('./scripts/seed-demo.ts', import.meta.url));

  /**
   * A source assertion, because the guard cannot be exercised from the suite:
   * `assertSafeTarget` reads `DATABASE_URL` and the repository's `.neon`, and a
   * test that set them would be testing its own fixture. What matters is that
   * the entry point calls it at all — an unguarded fabricating seed is the one
   * defect here that is not recoverable by a follow-up commit.
   */
  it('refuses an unsafe target before writing anything', () => {
    const source = readFileSync(SCRIPT, 'utf8');

    expect(source).toContain("import { assertSafeTarget } from './safe-target.js'");
    expect(source).toMatch(/assertSafeTarget\('demo marketplace data'\)/);
  });
});
