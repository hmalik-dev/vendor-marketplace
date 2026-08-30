import { DEFAULT_PLATFORM_FEE_RATE, calculateFees, toDateString } from '@vendor-marketplace/shared';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  MARKETING_COVER_BASE,
  MARKETING_CUSTOMERS,
  MARKETING_VENDORS,
  REVIEW_COPY,
} from './marketing-seed-data.js';
import {
  availability,
  bookingRequests,
  bookings,
  categories,
  portfolioItems,
  reviews,
  servicePackages,
  users,
  vendorCategories,
  vendorProfiles,
} from './schema/index.js';

/**
 * Every identity this seed creates carries this prefix in `clerk_user_id`.
 *
 * It is the only handle on "rows this seed owns". Re-running deletes the
 * booking graph belonging to these users and rebuilds it, which is what makes
 * the seed idempotent without a truncate — a truncate would take real
 * development data with it.
 */
export const MARKETING_SEED_PREFIX = 'seed_mkt_';

/** The category every demo vendor is filed under. */
const MARKETING_CATEGORY_SLUG = 'photography';

/**
 * Reviews are dated backwards from this many days ago, so a freshly seeded
 * database never contains a completed booking in the future.
 */
const NEWEST_REVIEW_DAYS_AGO = 9;
const REVIEW_SPACING_DAYS = 6;

/** Future dates each vendor is unavailable, so the calendar is not empty. */
const BLOCKED_DATES_PER_VENDOR = 7;
const BLOCKED_DATE_HORIZON_DAYS = 120;

export interface MarketingSeedResult {
  vendorsUpserted: number;
  customersUpserted: number;
  packagesUpserted: number;
  bookingsCreated: number;
  reviewsCreated: number;
  availabilityRowsCreated: number;
}

type AnyPgDatabase<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> = PgDatabase<TQueryResult, TFullSchema, TSchema>;

/**
 * A small deterministic PRNG (mulberry32). The seed must produce identical
 * data on every run and on every machine, so `Math.random` is not an option:
 * two runs that disagree would make a screenshot impossible to reproduce.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string, so each vendor's stream differs. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Builds `count` integer ratings whose mean matches `target` to two decimal
 * places — the precision `vendor_profiles.avg_rating` stores.
 *
 * The total is chosen first and the individual values are derived from it,
 * because the reverse (generate, then hope the mean lands) cannot guarantee
 * the number on the card. Values start at five and are walked down one point
 * at a time across the array, which produces a believable J-shaped
 * distribution rather than a block of identical scores.
 */
export function buildRatings(target: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }

  // Search a small window for the total whose mean rounds to the target, so
  // the displayed average is exactly the one the design frames specify.
  const ideal = target * count;
  let total = Math.round(ideal);
  for (let offset = 0; offset <= 3; offset += 1) {
    const candidates =
      offset === 0 ? [Math.round(ideal)] : [Math.round(ideal) - offset, Math.round(ideal) + offset];
    const match = candidates.find(
      (value) => value >= count && value <= count * 5 && Math.abs(value / count - target) < 0.005,
    );
    if (match !== undefined) {
      total = match;
      break;
    }
  }
  total = Math.min(Math.max(total, count), count * 5);

  const ratings = Array.from({ length: count }, () => 5);
  let deficit = count * 5 - total;
  // Walk the array repeatedly, taking one point per visit. The first pass
  // creates fours, the second threes, and so on — so a vendor at 4.9 has a
  // handful of fours, while one at 4.5 has fours and a few threes.
  for (let pass = 0; pass < 4 && deficit > 0; pass += 1) {
    for (let index = 0; index < count && deficit > 0; index += 1) {
      // Stride through the array rather than filling from the front, so the
      // low scores are scattered through the timeline instead of clustered.
      const target = (index * 7 + pass * 3) % count;
      if (ratings[target]! > 1) {
        ratings[target]! -= 1;
        deficit -= 1;
      }
    }
  }

  return ratings;
}

/** Deterministic `YYYY-MM-DD` a given number of days before `today`. */
function daysBefore(today: Date, days: number): string {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() - days);
  return toDateString(date);
}

/** Deterministic `YYYY-MM-DD` a given number of days after `today`. */
function daysAfter(today: Date, days: number): string {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

/**
 * Removes the booking graph this seed owns, newest table first so no foreign
 * key is left dangling. `bookings.request_id` is `ON DELETE RESTRICT`, which
 * is why bookings go before booking requests rather than after.
 *
 * Scoped to seeded reviewers and seeded customers — a real booking made by a
 * real developer account is never touched.
 */
async function clearSeededBookingGraph<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>, seededUserIds: string[]): Promise<void> {
  if (seededUserIds.length === 0) {
    return;
  }

  await db.delete(reviews).where(inArray(reviews.reviewerId, seededUserIds));
  await db.delete(bookings).where(inArray(bookings.customerId, seededUserIds));
  await db.delete(bookingRequests).where(inArray(bookingRequests.customerId, seededUserIds));
}

/**
 * Populates the demo marketplace: sixteen fictional photographers, their
 * packages, and a real booking-and-review history behind every rating.
 *
 * Idempotent. Vendors and customers are upserted on their natural keys, and
 * the booking graph is rebuilt from scratch each run, so repeated runs
 * converge on the same database rather than multiplying rows.
 *
 * `now` is injected so tests can pin the calendar; production callers leave it
 * to default. Event dates are `YYYY-MM-DD` strings throughout and never round
 * trip through a local-time `Date`.
 */
export async function seedMarketingData<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>,
  now: Date = new Date(),
): Promise<MarketingSeedResult> {
  const categoryRows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, MARKETING_CATEGORY_SLUG));
  const categoryId = categoryRows[0]?.id;

  if (!categoryId) {
    throw new Error(
      `seedMarketingData: category "${MARKETING_CATEGORY_SLUG}" is missing. Run the reference seed (pnpm db:seed) first.`,
    );
  }

  // --- Customers ---------------------------------------------------------
  const customerRows = await db
    .insert(users)
    .values(
      MARKETING_CUSTOMERS.map((customer, index) => ({
        clerkUserId: `${MARKETING_SEED_PREFIX}customer_${index}`,
        email: `${customer.first.toLowerCase()}.${customer.last.toLowerCase()}@orla-demo.example`,
        role: 'customer' as const,
        firstName: customer.first,
        lastName: customer.last,
        city: 'Austin',
        state: 'TX',
      })),
    )
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        firstName: sql`excluded.first_name`,
        lastName: sql`excluded.last_name`,
        email: sql`excluded.email`,
      },
    })
    .returning({ id: users.id, clerkUserId: users.clerkUserId });

  // `returning` order is not guaranteed, so index by the key we control.
  const customerIds = [...customerRows]
    .sort((a, b) => a.clerkUserId.localeCompare(b.clerkUserId))
    .map((row) => row.id);

  await clearSeededBookingGraph(db, customerIds);

  // --- Vendors -----------------------------------------------------------
  const vendorIdBySlug = new Map<string, string>();
  let packagesUpserted = 0;

  for (const vendor of MARKETING_VENDORS) {
    const [vendorUser] = await db
      .insert(users)
      .values({
        clerkUserId: `${MARKETING_SEED_PREFIX}vendor_${vendor.slug}`,
        email: `${vendor.slug}@orla-demo.example`,
        role: 'vendor' as const,
        firstName: vendor.firstName,
        lastName: vendor.lastName,
        city: vendor.city,
        state: vendor.state,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          email: sql`excluded.email`,
        },
      })
      .returning({ id: users.id });

    if (!vendorUser) {
      throw new Error(`seedMarketingData: could not upsert the user for "${vendor.slug}"`);
    }

    /*
     * Conflict on `slug`, not on `user_id`. A vendor of this name may already
     * exist from earlier hand-seeding under a different account, and matching
     * on the slug is what lets this seed adopt that row — cover image and all
     * — instead of colliding with it on the unique slug index.
     */
    const [profile] = await db
      .insert(vendorProfiles)
      .values({
        userId: vendorUser.id,
        businessName: vendor.businessName,
        slug: vendor.slug,
        bio: vendor.bio,
        tagline: vendor.tagline ?? null,
        yearsInBusiness: vendor.yearsInBusiness ?? null,
        coverImageUrl: `${MARKETING_COVER_BASE}/${vendor.slug}.jpg`,
        city: vendor.city,
        state: vendor.state,
        responseTimeHours: vendor.responseTimeHours,
        isPublished: true,
        isDeleted: false,
      })
      .onConflictDoUpdate({
        target: vendorProfiles.slug,
        set: {
          /*
           * Ownership transfers to the seeded account. Without this the row
           * stays attached to whichever user created it first, and the seed
           * could no longer clean up after itself: deleting its own users
           * would leave an orphaned profile behind, still carrying bookings.
           */
          userId: sql`excluded.user_id`,
          businessName: sql`excluded.business_name`,
          bio: sql`excluded.bio`,
          tagline: sql`excluded.tagline`,
          yearsInBusiness: sql`excluded.years_in_business`,
          coverImageUrl: sql`excluded.cover_image_url`,
          city: sql`excluded.city`,
          state: sql`excluded.state`,
          responseTimeHours: sql`excluded.response_time_hours`,
          isPublished: sql`excluded.is_published`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: vendorProfiles.id });

    if (!profile) {
      throw new Error(`seedMarketingData: could not upsert the profile for "${vendor.slug}"`);
    }

    vendorIdBySlug.set(vendor.slug, profile.id);

    await db
      .insert(vendorCategories)
      .values({ vendorId: profile.id, categoryId })
      .onConflictDoNothing();

    /*
     * The cover is the first portfolio photo, not a separate upload — the rule
     * `40-states.md` sets and #51 enforces. Seeding a cover with an empty
     * portfolio would leave every seeded vendor contradicting it, so the same
     * image is inserted as portfolio item zero.
     */
    const coverKey = `${MARKETING_COVER_BASE}/${vendor.slug}.jpg`;
    const [existingCover] = await db
      .select({ id: portfolioItems.id })
      .from(portfolioItems)
      .where(and(eq(portfolioItems.vendorId, profile.id), eq(portfolioItems.imageUrl, coverKey)))
      .limit(1);

    if (!existingCover) {
      await db
        .insert(portfolioItems)
        .values({ vendorId: profile.id, imageUrl: coverKey, displayOrder: 0 });
    }

    /*
     * Packages have no natural key, so they are replaced wholesale rather than
     * upserted. Safe here because every vendor in this file is fictional and
     * nothing has ever quoted against these rows.
     */
    await db.delete(servicePackages).where(eq(servicePackages.vendorId, profile.id));
    const inserted = await db
      .insert(servicePackages)
      .values(
        vendor.packages.map((pkg, index) => ({
          vendorId: profile.id,
          name: pkg.name,
          description: pkg.description,
          priceCents: pkg.priceCents,
          // `decimal` columns round-trip as strings in Drizzle.
          durationHours: pkg.durationHours.toFixed(1),
          priceType: 'starting_at' as const,
          inclusions: [...pkg.inclusions],
          isActive: true,
          displayOrder: index,
        })),
      )
      .returning({ id: servicePackages.id });
    packagesUpserted += inserted.length;
  }

  // --- Booking history and reviews ---------------------------------------
  const { bookingsCreated, reviewsCreated } = await seedReviewHistory(
    db,
    vendorIdBySlug,
    customerIds,
    now,
  );

  // --- Availability ------------------------------------------------------
  const availabilityRowsCreated = await seedAvailability(db, vendorIdBySlug, now);

  return {
    vendorsUpserted: MARKETING_VENDORS.length,
    customersUpserted: customerIds.length,
    packagesUpserted,
    bookingsCreated,
    reviewsCreated,
    availabilityRowsCreated,
  };
}

/**
 * Creates one accepted request, one completed booking and one review per
 * target review, then recomputes each vendor's rating from the rows just
 * written.
 *
 * The recompute is the point. Writing `avg_rating` directly would be quicker,
 * but the column is defined as derived from reviews, and a profile page that
 * claims 127 reviews over an empty list is exactly the thing that ruins a
 * screenshot.
 */
async function seedReviewHistory<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>,
  vendorIdBySlug: Map<string, string>,
  customerIds: string[],
  now: Date,
): Promise<{ bookingsCreated: number; reviewsCreated: number }> {
  let bookingsCreated = 0;
  let reviewsCreated = 0;

  for (const vendor of MARKETING_VENDORS) {
    const vendorId = vendorIdBySlug.get(vendor.slug);
    if (!vendorId || vendor.reviewCount === 0) {
      continue;
    }

    const ratings = buildRatings(vendor.rating, vendor.reviewCount);
    const random = makeRandom(hashString(vendor.slug));
    const entryPrice = vendor.packages[0]?.priceCents ?? 100_000;

    const requestValues = ratings.map((_, index) => {
      const eventDate = daysBefore(now, NEWEST_REVIEW_DAYS_AGO + index * REVIEW_SPACING_DAYS);
      // Bookings land on a spread of the vendor's tiers, so the completed
      // history is not every customer buying the cheapest package.
      const tier = vendor.packages[Math.floor(random() * vendor.packages.length)];
      const priceCents = tier?.priceCents ?? entryPrice;
      return {
        customerId: customerIds[(index + hashString(vendor.slug)) % customerIds.length]!,
        vendorId,
        eventDate,
        eventType: 'Wedding',
        eventLocation: `${vendor.city}, ${vendor.state}`,
        guestCount: 60 + Math.floor(random() * 140),
        status: 'accepted' as const,
        finalPriceCents: priceCents,
      };
    });

    const requestRows = await db
      .insert(bookingRequests)
      .values(requestValues)
      .returning({ id: bookingRequests.id });

    const bookingValues = requestRows.map((request, index) => {
      const source = requestValues[index]!;
      const fees = calculateFees(source.finalPriceCents, DEFAULT_PLATFORM_FEE_RATE);
      return {
        requestId: request.id,
        customerId: source.customerId,
        vendorId,
        eventDate: source.eventDate,
        eventLocation: source.eventLocation,
        totalAmountCents: fees.totalCents,
        platformFeeCents: fees.platformFeeCents,
        vendorPayoutCents: fees.vendorPayoutCents,
        status: 'completed' as const,
      };
    });

    const bookingRows = await db
      .insert(bookings)
      .values(bookingValues)
      .returning({ id: bookings.id });
    bookingsCreated += bookingRows.length;

    const reviewValues = bookingRows.map((booking, index) => {
      const rating = ratings[index]!;
      const pool = REVIEW_COPY[rating] ?? REVIEW_COPY[5]!;
      return {
        bookingId: booking.id,
        reviewerId: bookingValues[index]!.customerId,
        vendorId,
        type: 'customer_to_vendor' as const,
        rating,
        content: pool[index % pool.length]!,
        isPublic: true,
      };
    });

    const reviewRows = await db.insert(reviews).values(reviewValues).returning({ id: reviews.id });
    reviewsCreated += reviewRows.length;
  }

  await recomputeVendorRatings(db, [...vendorIdBySlug.values()]);

  return { bookingsCreated, reviewsCreated };
}

/**
 * Recomputes `avg_rating` and `review_count` from the `reviews` table.
 *
 * Only public customer-to-vendor reviews count, matching what the profile
 * page lists — a vendor's private review of a customer must never move the
 * vendor's own score. A vendor with no reviews is reset to zero rather than
 * skipped, so removing reviews cannot leave a stale average behind.
 */
export async function recomputeVendorRatings<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>, vendorIds: string[]): Promise<void> {
  if (vendorIds.length === 0) {
    return;
  }

  await db
    .update(vendorProfiles)
    .set({
      avgRating: sql`COALESCE((
        SELECT ROUND(AVG(r.rating)::numeric, 2)
        FROM reviews r
        WHERE r.vendor_id = ${vendorProfiles.id}
          AND r.type = 'customer_to_vendor'
          AND r.is_public = true
      ), 0)`,
      reviewCount: sql`(
        SELECT COUNT(*)
        FROM reviews r
        WHERE r.vendor_id = ${vendorProfiles.id}
          AND r.type = 'customer_to_vendor'
          AND r.is_public = true
      )`,
      updatedAt: sql`now()`,
    })
    .where(inArray(vendorProfiles.id, vendorIds));
}

/**
 * Blocks a handful of future dates per vendor.
 *
 * Without these every calendar is uniformly free, which makes the availability
 * screens and the search date filter impossible to demonstrate. The dates are
 * derived from the vendor slug, so they differ per vendor but never move
 * between runs.
 */
async function seedAvailability<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>,
  vendorIdBySlug: Map<string, string>,
  now: Date,
): Promise<number> {
  const rows: { vendorId: string; date: string; status: 'booked' | 'blocked' }[] = [];

  for (const vendor of MARKETING_VENDORS) {
    const vendorId = vendorIdBySlug.get(vendor.slug);
    if (!vendorId) {
      continue;
    }

    const random = makeRandom(hashString(`${vendor.slug}:availability`));
    const taken = new Set<number>();
    while (taken.size < BLOCKED_DATES_PER_VENDOR) {
      taken.add(1 + Math.floor(random() * BLOCKED_DATE_HORIZON_DAYS));
    }

    for (const offset of [...taken].sort((a, b) => a - b)) {
      rows.push({
        vendorId,
        date: daysAfter(now, offset),
        // Roughly two thirds booked, the rest blocked by the vendor — the two
        // render differently on the calendar and both need to appear.
        status: offset % 3 === 0 ? 'blocked' : 'booked',
      });
    }
  }

  if (rows.length === 0) {
    return 0;
  }

  // Clear only the horizon this seed owns, so a developer's own blocked dates
  // outside it survive.
  await db
    .delete(availability)
    .where(
      and(
        inArray(availability.vendorId, [...vendorIdBySlug.values()]),
        sql`${availability.date} >= ${toDateString(now)}`,
        sql`${availability.date} <= ${daysAfter(now, BLOCKED_DATE_HORIZON_DAYS)}`,
      ),
    );

  const inserted = await db
    .insert(availability)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: availability.id });

  return inserted.length;
}

/**
 * Removes everything this seed owns. Exposed for tests and for a developer who
 * wants their database back; the `clerk_user_id` prefix is what scopes it.
 */
export async function clearMarketingData<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>): Promise<void> {
  const seeded = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.clerkUserId, `${MARKETING_SEED_PREFIX}%`));
  const seededIds = seeded.map((row) => row.id);

  await clearSeededBookingGraph(db, seededIds);

  /*
   * Also clear anything hanging off the seeded vendors themselves. The graph
   * above is scoped by customer, which covers everything this seed writes; a
   * booking made against a seeded vendor by a real developer account would not
   * be, and `bookings.vendor_id` is ON DELETE RESTRICT — so without this the
   * cleanup would fail rather than silently orphan the row.
   */
  if (seededIds.length > 0) {
    const seededVendorIds = (
      await db
        .select({ id: vendorProfiles.id })
        .from(vendorProfiles)
        .where(inArray(vendorProfiles.userId, seededIds))
    ).map((row) => row.id);

    if (seededVendorIds.length > 0) {
      await db.delete(reviews).where(inArray(reviews.vendorId, seededVendorIds));
      await db.delete(bookings).where(inArray(bookings.vendorId, seededVendorIds));
      await db.delete(bookingRequests).where(inArray(bookingRequests.vendorId, seededVendorIds));
    }
  }

  if (seededIds.length > 0) {
    // Profiles, packages, categories and availability all cascade from the
    // vendor's user row.
    await db.delete(users).where(inArray(users.id, seededIds));
  }
}
