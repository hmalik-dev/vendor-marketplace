import {
  DEFAULT_PLATFORM_FEE_RATE,
  addDays,
  calculateFees,
  replyDeadline,
  toDateString,
} from '@vendor-marketplace/shared';
import type {
  BookingRequestStatus,
  BookingStatus,
  NotificationType,
} from '@vendor-marketplace/shared';
import { and, inArray, like, notInArray, or, sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgColumn, PgQueryResultHKT, PgTable } from 'drizzle-orm/pg-core';

import { deterministicUuid, hashString, makeRandom, pick } from './deterministic.js';
import {
  DEMO_ADMIN,
  DEMO_CUSTOMERS,
  DEMO_CUSTOMER_REVIEW_COPY,
  DEMO_EVENT_TYPES,
  demoImageFor,
  DEMO_MESSAGE_THREAD,
  DEMO_SEED_PREFIX,
  DEMO_UUID_NAMESPACE,
  DEMO_VENDORS,
  DEMO_VENDOR_REVIEW_COPY,
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
import { recomputeVendorRatings, type AnyPgDatabase } from './seed-support.js';

/**
 * The demo marketplace — `pnpm db:seed:demo`.
 *
 * Fully populated and completely deterministic: every row's primary key is
 * derived from a stable string key rather than `gen_random_uuid()`, and every
 * timestamp is derived from the `now` argument rather than the wall clock. Two
 * runs against the same `now` therefore produce byte-identical data, which is
 * what lets a Playwright suite select on a known id and lets a reviewer diff
 * two seeded databases.
 *
 * It is additive against the reference seed and disjoint from the marketing
 * seed: different `clerk_user_id` prefix, different vendor slugs, different
 * email domain. Running all three leaves each one's rows intact.
 */

/** Non-routable by design — `example` is reserved and can never receive mail. */
const DEMO_EMAIL_DOMAIN = 'demo.orla.example';

/** Requests that never became bookings, by the status they came to rest in. */
const REQUEST_ONLY_PLAN: readonly (readonly [BookingRequestStatus, number])[] = [
  ['pending', 4],
  ['quoted', 3],
  ['accepted', 2],
  ['declined', 3],
  ['expired', 2],
  ['cancelled', 2],
];

/**
 * Bookings, by their own status. Each one sits behind an `accepted` request —
 * the only status the lifecycle lets a booking come from — so `accepted`
 * appears both here and above, once settled and once still awaiting payment.
 *
 * `completed` carries the largest share because it is the only status that
 * produces reviews, and the acceptance criteria ask for twenty or more.
 */
const BOOKING_PLAN: readonly (readonly [BookingStatus, number])[] = [
  ['confirmed', 6],
  ['completed', 14],
  ['cancelled', 2],
  ['disputed', 2],
];

/**
 * What the bell says when a booking reaches each status. Closes over nothing,
 * so it is built once rather than per plan entry.
 */
const BOOKING_NOTIFICATION_COPY: Record<
  BookingStatus,
  { type: NotificationType; title: string; body: string } | null
> = {
  confirmed: {
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    body: 'The date is locked in and paid for.',
  },
  completed: {
    type: 'booking_completed',
    title: 'Booking completed',
    body: 'The event is done. Leave a review.',
  },
  cancelled: {
    type: 'booking_cancelled',
    title: 'Booking cancelled',
    body: 'This booking was cancelled.',
  },
  // A dispute is worked in the admin console, not announced by the bell.
  disputed: null,
};

/** Blocked (not booked) days written per vendor, so no calendar is uniformly free. */
const BLOCKED_DAYS_PER_VENDOR = 5;

export interface DemoSeedResult {
  usersUpserted: number;
  vendorsUpserted: number;
  packagesUpserted: number;
  portfolioItemsUpserted: number;
  requestsUpserted: number;
  bookingsUpserted: number;
  conversationsUpserted: number;
  messagesUpserted: number;
  reviewsUpserted: number;
  notificationsUpserted: number;
  availabilityRowsUpserted: number;
}

/**
 * Deletes rows this seed owns that are not in the set it just wrote.
 *
 * `owner` is the column that says "this row is mine" — the vendor profile for
 * vendor-owned tables, the user for notifications — and `written` is every row
 * the current run emitted for that table. Anything owned but absent came from
 * an older version of the seed and is removed, which is what makes a re-run
 * converge on exactly the current dataset rather than accumulating.
 */
async function pruneStale<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>,
  table: PgTable & { id: PgColumn },
  owner: PgColumn,
  ownerIds: readonly string[],
  written: readonly { id: string }[],
): Promise<void> {
  if (ownerIds.length === 0) {
    return;
  }

  const keep = written.map((row) => row.id);
  const owned = inArray(owner, [...ownerIds]);

  await db.delete(table).where(keep.length === 0 ? owned : and(owned, notInArray(table.id, keep)));
}

/** The earlier of two instants — used to keep derived dates out of the future. */
function earliest(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

function id(kind: string, key: string): string {
  return deterministicUuid(`${DEMO_UUID_NAMESPACE}.${kind}`, key);
}

/**
 * One row of the booking graph, resolved before anything is written.
 *
 * Building the whole plan first is what keeps the seed honest about its own
 * shape: the counts the tests assert come from this array, not from a running
 * total that a later loop could quietly change.
 */
interface DemoBookingPlan {
  readonly key: string;
  readonly customerIndex: number;
  readonly vendorIndex: number;
  readonly packageIndex: number | null;
  readonly requestStatus: BookingRequestStatus;
  readonly bookingStatus: BookingStatus | null;
  /** Days from the anchor. Negative for events that have already happened. */
  readonly eventDayOffset: number;
  readonly messageCount: number;
  readonly rating: number;
}

/**
 * Which customers carry booking history, expanded from their `bookingShare`.
 *
 * A share of zero keeps that account out of the list entirely — the "new
 * member" profile has to be genuinely empty for the empty states to mean
 * anything.
 */
function bookingCustomerIndices(): number[] {
  const indices: number[] = [];

  DEMO_CUSTOMERS.forEach((customer, index) => {
    for (let repeat = 0; repeat < customer.bookingShare; repeat += 1) {
      indices.push(index);
    }
  });

  if (indices.length === 0) {
    throw new Error('seedDemoData: no demo customer carries a booking share');
  }

  return indices;
}

/**
 * Builds the whole booking graph before a row is written.
 *
 * Two properties the rest of the seed leans on:
 *
 * **Every event date is distinct**, which keeps the partial live-request unique
 * indexes satisfied without the plan having to reason about them: two requests
 * can only collide on `(customer, vendor, date, package)` while both are
 * `pending` or `quoted`, and no two entries share a date at all.
 *
 * **The two status groups are interleaved, and the spacing is three days.**
 * Concatenating them and stepping seven days put every booking at least 119
 * days from now, which reads as a populated marketplace on the search grid and
 * as an empty one on the vendor dashboard — `countBookingsBetween` and
 * `sumPayoutsBetween` both filter to the current month, so all thirteen vendors
 * showed zero bookings and zero earnings on their headline screen.
 */
export function buildDemoBookingPlan(): readonly DemoBookingPlan[] {
  const random = makeRandom(hashString('orla.demo.booking-plan'));
  const customerPool = bookingCustomerIndices();
  const plan: DemoBookingPlan[] = [];

  const requestOnly: {
    requestStatus: BookingRequestStatus;
    bookingStatus: BookingStatus | null;
  }[] = [];
  const withBooking: typeof requestOnly = [];

  for (const [status, count] of REQUEST_ONLY_PLAN) {
    for (let index = 0; index < count; index += 1) {
      requestOnly.push({ requestStatus: status, bookingStatus: null });
    }
  }

  for (const [status, count] of BOOKING_PLAN) {
    for (let index = 0; index < count; index += 1) {
      withBooking.push({ requestStatus: 'accepted', bookingStatus: status });
    }
  }

  // Round-robin, so bookings are spread across the whole date range rather than
  // banked behind every request-only row.
  const entries: typeof requestOnly = [];
  for (let index = 0; index < Math.max(requestOnly.length, withBooking.length); index += 1) {
    const request = requestOnly[index];
    const booked = withBooking[index];
    if (request) entries.push(request);
    if (booked) entries.push(booked);
  }

  entries.forEach((entry, index) => {
    const vendorIndex = index % DEMO_VENDORS.length;
    const vendor = DEMO_VENDORS[vendorIndex] as (typeof DEMO_VENDORS)[number];

    /*
     * A `quoted` request is always a custom enquiry, because a package request
     * cannot be quoted: `resolveAction` refuses it with "This request is
     * already priced by its package" the moment `final_price_cents` is set, and
     * a package request carries that from creation. Beyond those, every seventh
     * row is custom so the custom-request rendering path has rows of its own.
     */
    const isCustom = entry.requestStatus === 'quoted' || index % 7 === 6;
    const packageIndex = isCustom ? null : Math.floor(random() * vendor.packages.length);

    /*
     * Settled history is in the past and open work is in the future. A pending
     * request dated last year would sit in the vendor's queue looking
     * actionable while being impossible to accept.
     */
    const isPast =
      entry.bookingStatus !== null
        ? entry.bookingStatus !== 'confirmed'
        : entry.requestStatus === 'declined' ||
          entry.requestStatus === 'expired' ||
          entry.requestStatus === 'cancelled';

    const magnitude = 3 + index * 3;

    plan.push({
      key: `booking-${index}`,
      customerIndex: customerPool[index % customerPool.length] as number,
      vendorIndex,
      packageIndex,
      requestStatus: entry.requestStatus,
      bookingStatus: entry.bookingStatus,
      eventDayOffset: isPast ? -magnitude : magnitude,
      messageCount: 3 + Math.floor(random() * (DEMO_MESSAGE_THREAD.length - 2)),
      rating: 3 + Math.floor(random() * 3),
    });
  });

  return plan;
}

/**
 * Removes every row this seed owns, identified by the `clerk_user_id` prefix.
 *
 * Two deletes, not twelve. Every table this seed writes is cascade-reachable
 * from `users` — `vendor_profiles` cascades from `users`, and `availability`,
 * `portfolio_items`, `service_packages`, `vendor_categories`, `conversations`,
 * `booking_requests` and `reviews` all cascade from that, with `messages`
 * cascading from `conversations` and `notifications` from `users`.
 *
 * `bookings` is the one exception and the reason this is a sequence at all:
 * `customer_id`, `vendor_id` and `request_id` are `RESTRICT`, so deleting the
 * accounts first fails on the booking rows rather than taking them along.
 *
 * It never touches the reference seed or the marketing seed, whose rows carry a
 * different prefix.
 */
export async function clearDemoData<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>): Promise<void> {
  const owned = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.clerkUserId, `${DEMO_SEED_PREFIX}%`));

  if (owned.length === 0) {
    return;
  }

  const ownedUserIds = owned.map((row) => row.id);

  const ownedVendors = await db
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(inArray(vendorProfiles.userId, ownedUserIds));
  const ownedVendorIds = ownedVendors.map((row) => row.id);

  /*
   * Both sides of the booking, not just the customer side. A booking made
   * against a demo vendor from an account this seed does not own — a developer
   * booking a demo storefront in their own database — is not caught by the
   * customer filter, and `bookings.vendor_id` is RESTRICT, so the cascade from
   * `users` then fails on that row and the teardown aborts half-done.
   */
  await db
    .delete(bookings)
    .where(
      ownedVendorIds.length > 0
        ? or(inArray(bookings.customerId, ownedUserIds), inArray(bookings.vendorId, ownedVendorIds))
        : inArray(bookings.customerId, ownedUserIds),
    );

  await db.delete(users).where(inArray(users.id, ownedUserIds));
}

/**
 * Seeds the demo marketplace. Idempotent, and deterministic for a fixed `now`.
 *
 * @param now anchors every derived date. Defaults to the wall clock; the suite
 * pins it so two runs can be compared row for row.
 */
export async function seedDemoData<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>,
  now: Date = new Date(),
): Promise<DemoSeedResult> {
  const categoryRows = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories);
  const categoryIdBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));

  for (const vendor of DEMO_VENDORS) {
    if (!categoryIdBySlug.has(vendor.categorySlug)) {
      throw new Error(
        `seedDemoData: category "${vendor.categorySlug}" is missing. Run the reference seed (pnpm db:seed) first.`,
      );
    }
  }

  // --- People -------------------------------------------------------------
  const adminId = id('user', `admin:${DEMO_ADMIN.key}`);
  const customerIds = DEMO_CUSTOMERS.map((customer) => id('user', `customer:${customer.key}`));
  const vendorUserIds = DEMO_VENDORS.map((vendor) => id('user', `vendor:${vendor.key}`));

  const userValues = [
    {
      id: adminId,
      clerkUserId: `${DEMO_SEED_PREFIX}admin_${DEMO_ADMIN.key}`,
      email: `admin@${DEMO_EMAIL_DOMAIN}`,
      role: 'admin' as const,
      firstName: DEMO_ADMIN.firstName,
      lastName: DEMO_ADMIN.lastName,
      city: DEMO_ADMIN.city,
      state: DEMO_ADMIN.state,
      bio: null,
      createdAt: addDays(now, -720),
      updatedAt: now,
    },
    ...DEMO_CUSTOMERS.map((customer, index) => ({
      id: customerIds[index] as string,
      clerkUserId: `${DEMO_SEED_PREFIX}customer_${customer.key}`,
      email: `${customer.key}@${DEMO_EMAIL_DOMAIN}`,
      role: 'customer' as const,
      firstName: customer.firstName,
      lastName: customer.lastName,
      city: customer.city,
      state: customer.state,
      bio: customer.bio,
      createdAt: addDays(now, -400 + index * 30),
      updatedAt: now,
    })),
    ...DEMO_VENDORS.map((vendor, index) => ({
      id: vendorUserIds[index] as string,
      clerkUserId: `${DEMO_SEED_PREFIX}vendor_${vendor.key}`,
      email: `${vendor.key}@${DEMO_EMAIL_DOMAIN}`,
      role: 'vendor' as const,
      firstName: vendor.firstName,
      lastName: vendor.lastName,
      city: vendor.city,
      state: vendor.state,
      bio: null,
      createdAt: addDays(now, -600 + index * 10),
      updatedAt: now,
    })),
  ];

  await db
    .insert(users)
    .values(userValues)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        clerkUserId: sql`excluded.clerk_user_id`,
        email: sql`excluded.email`,
        role: sql`excluded.role`,
        firstName: sql`excluded.first_name`,
        lastName: sql`excluded.last_name`,
        city: sql`excluded.city`,
        state: sql`excluded.state`,
        bio: sql`excluded.bio`,
        createdAt: sql`excluded.created_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  // --- Vendor profiles ----------------------------------------------------
  const vendorProfileIds = DEMO_VENDORS.map((vendor) => id('vendor-profile', vendor.key));

  await db
    .insert(vendorProfiles)
    .values(
      DEMO_VENDORS.map((vendor, index) => ({
        id: vendorProfileIds[index] as string,
        userId: vendorUserIds[index] as string,
        businessName: vendor.businessName,
        slug: vendor.slug,
        bio: vendor.bio,
        tagline: vendor.tagline,
        yearsInBusiness: vendor.yearsInBusiness,
        // No headshots ship with the repo, so the Avatar renders initials.
        profileImageUrl: null,
        coverImageUrl: demoImageFor(vendor.categorySlug),
        city: vendor.city,
        state: vendor.state,
        responseTimeHours: vendor.responseTimeHours,
        stripeAccountId: `acct_demo_${vendor.key.replaceAll('-', '_')}`,
        stripeOnboarded: true,
        isPublished: true,
        isDeleted: false,
        createdAt: addDays(now, -600 + index * 10),
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: vendorProfiles.id,
      set: {
        businessName: sql`excluded.business_name`,
        slug: sql`excluded.slug`,
        bio: sql`excluded.bio`,
        tagline: sql`excluded.tagline`,
        yearsInBusiness: sql`excluded.years_in_business`,
        profileImageUrl: sql`excluded.profile_image_url`,
        coverImageUrl: sql`excluded.cover_image_url`,
        city: sql`excluded.city`,
        state: sql`excluded.state`,
        responseTimeHours: sql`excluded.response_time_hours`,
        stripeAccountId: sql`excluded.stripe_account_id`,
        stripeOnboarded: sql`excluded.stripe_onboarded`,
        isPublished: sql`excluded.is_published`,
        isDeleted: sql`excluded.is_deleted`,
        createdAt: sql`excluded.created_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  await db
    .insert(vendorCategories)
    .values(
      DEMO_VENDORS.map((vendor, index) => ({
        vendorId: vendorProfileIds[index] as string,
        categoryId: categoryIdBySlug.get(vendor.categorySlug) as string,
      })),
    )
    .onConflictDoNothing();

  // --- Packages and portfolios -------------------------------------------
  const packageIds = DEMO_VENDORS.map((vendor) =>
    vendor.packages.map((item) => id('package', `${vendor.key}:${item.key}`)),
  );

  const packageValues = DEMO_VENDORS.flatMap((vendor, vendorIndex) =>
    vendor.packages.map((item, packageIndex) => ({
      id: (packageIds[vendorIndex] as string[])[packageIndex] as string,
      vendorId: vendorProfileIds[vendorIndex] as string,
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      priceType: item.priceType,
      durationHours: item.durationHours,
      maxGuests: item.maxGuests,
      inclusions: [...item.inclusions],
      isActive: true,
      displayOrder: packageIndex,
      createdAt: addDays(now, -590 + vendorIndex * 10),
      updatedAt: now,
    })),
  );

  await db
    .insert(servicePackages)
    .values(packageValues)
    .onConflictDoUpdate({
      target: servicePackages.id,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        priceCents: sql`excluded.price_cents`,
        priceType: sql`excluded.price_type`,
        durationHours: sql`excluded.duration_hours`,
        maxGuests: sql`excluded.max_guests`,
        inclusions: sql`excluded.inclusions`,
        isActive: sql`excluded.is_active`,
        displayOrder: sql`excluded.display_order`,
        createdAt: sql`excluded.created_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  /*
   * Only vendors whose category has a licensed image get a portfolio.
   * `portfolio_items.image_url` is NOT NULL, so the alternative is inventing a
   * path to a file that does not exist — and the gallery renders it as a raw
   * `<img>`, so that shows a column of broken-image glyphs.
   */
  const portfolioValues = DEMO_VENDORS.flatMap((vendor, vendorIndex) => {
    const image = demoImageFor(vendor.categorySlug);

    if (image === null) {
      return [];
    }

    return Array.from({ length: vendor.portfolioCount }, (_unused, itemIndex) => ({
      id: id('portfolio', `${vendor.key}:${itemIndex}`),
      vendorId: vendorProfileIds[vendorIndex] as string,
      imageUrl: image,
      thumbnailUrl: image,
      caption: `${vendor.businessName} — selected work ${itemIndex + 1}`,
      displayOrder: itemIndex,
      createdAt: addDays(now, -580 + vendorIndex * 10),
    }));
  });

  await db
    .insert(portfolioItems)
    .values(portfolioValues)
    .onConflictDoUpdate({
      target: portfolioItems.id,
      set: {
        imageUrl: sql`excluded.image_url`,
        thumbnailUrl: sql`excluded.thumbnail_url`,
        caption: sql`excluded.caption`,
        displayOrder: sql`excluded.display_order`,
        createdAt: sql`excluded.created_at`,
      },
    });

  // --- The booking graph --------------------------------------------------
  const plan = buildDemoBookingPlan();
  // `bookedPlan` and `completedPlan` below are filtered, so their callbacks
  // no longer receive an index into `plan`. Look it up rather than scanning.
  const planIndexByKey = new Map(plan.map((entry, index) => [entry.key, index]));
  const copyRandom = makeRandom(hashString('orla.demo.copy'));

  const requestValues = plan.map((entry) => {
    const vendor = DEMO_VENDORS[entry.vendorIndex] as (typeof DEMO_VENDORS)[number];
    const chosen = entry.packageIndex === null ? null : vendor.packages[entry.packageIndex];
    const eventDate = addDays(now, entry.eventDayOffset);

    /*
     * Requests are raised well before the event and settled shortly after —
     * except the ones still awaiting an answer, which are anchored to `now`
     * instead.
     *
     * Deriving those from the event date too would date them 45 days before an
     * event up to nine months out, putting `expires_at` in the past. A pending
     * request past its expiry is not pending in practice: the lazy sweep in
     * `expireBookingRequests` flips it to `expired` on the next read, and the
     * seed's coverage of the `pending` state would evaporate the first time
     * anyone opened the vendor's queue.
     */
    const live = entry.requestStatus === 'pending' || entry.requestStatus === 'quoted';
    const raisedAt = live
      ? addDays(now, -2 - (Math.abs(entry.eventDayOffset) % 6))
      : addDays(eventDate, -45);

    /*
     * Never in the future. A request for an event four months out would
     * otherwise be *raised* two months from now, and its conversation,
     * messages and notifications inherit the timestamp — so the vendor's bell
     * and inbox, both ordered by recency, sit permanently topped by rows dated
     * next quarter.
     */
    const createdAt = earliest(raisedAt, addDays(now, -1));
    const settledAt = earliest(addDays(createdAt, 2), now);
    const quoted = chosen ? chosen.priceCents : 240000;

    return {
      id: id('request', entry.key),
      customerId: customerIds[entry.customerIndex] as string,
      vendorId: vendorProfileIds[entry.vendorIndex] as string,
      packageId: chosen
        ? ((packageIds[entry.vendorIndex] as string[])[entry.packageIndex as number] as string)
        : null,
      eventDate: toDateString(eventDate),
      eventType: pick(DEMO_EVENT_TYPES, copyRandom),
      eventLocation: `${vendor.city}, ${vendor.state}`,
      guestCount: 40 + (Math.abs(entry.eventDayOffset) % 160),
      customDetails: chosen
        ? null
        : 'Looking for something outside the listed packages — happy to talk it through.',
      status: entry.requestStatus,
      quotedPriceCents: entry.requestStatus === 'pending' ? null : quoted,
      quoteNote: entry.requestStatus === 'pending' ? null : 'Quote holds for 14 days from issue.',
      /*
       * Locked at creation for a package request, exactly as
       * `createBookingRequest` does — not deferred until a booking exists. The
       * vendor queue reads `finalPriceCents === null` as "quote needed" and the
       * customer hub as "no price agreed", so leaving it null on a packaged
       * request renders a priced request as unpriced. It is also the flag
       * `resolveAction` checks to refuse a quote on a package request.
       */
      finalPriceCents: chosen ? chosen.priceCents : entry.bookingStatus === null ? null : quoted,
      acceptedAt: entry.requestStatus === 'accepted' ? settledAt : null,
      /*
       * Stamped on every request, as production does, and never cleared on
       * settle. The countdown on a quote is driven off it, so a null here drops
       * the "expires in Nd" line from the customer's quote review entirely.
       * Capped at the event, through the same helper the API writes with: this
       * file's contract is that a demo row is shaped the way
       * `createBookingRequest` shapes one, and a second cap computed here
       * drifted from it the moment #401 gave the product a canonical answer.
       */
      expiresAt: replyDeadline(createdAt, toDateString(eventDate)),
      createdAt,
      updatedAt: settledAt,
    };
  });

  await db
    .insert(bookingRequests)
    .values(requestValues)
    .onConflictDoUpdate({
      target: bookingRequests.id,
      set: {
        packageId: sql`excluded.package_id`,
        eventDate: sql`excluded.event_date`,
        eventType: sql`excluded.event_type`,
        eventLocation: sql`excluded.event_location`,
        guestCount: sql`excluded.guest_count`,
        customDetails: sql`excluded.custom_details`,
        status: sql`excluded.status`,
        quotedPriceCents: sql`excluded.quoted_price_cents`,
        quoteNote: sql`excluded.quote_note`,
        finalPriceCents: sql`excluded.final_price_cents`,
        acceptedAt: sql`excluded.accepted_at`,
        expiresAt: sql`excluded.expires_at`,
        createdAt: sql`excluded.created_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  const bookedPlan = plan.filter((entry) => entry.bookingStatus !== null);

  const bookingValues = bookedPlan.map((entry) => {
    const source = requestValues[
      planIndexByKey.get(entry.key) as number
    ] as (typeof requestValues)[number];
    const fees = calculateFees(source.finalPriceCents as number, DEFAULT_PLATFORM_FEE_RATE);
    const eventDate = addDays(now, entry.eventDayOffset);
    /*
     * Payment precedes the event and can never be in the future — a booking
     * "paid" next quarter is a state the payment flow cannot produce, and
     * `sumPayoutsBetween` filters earnings on `paid_at`, so a future stamp also
     * takes the row out of the vendor's monthly total.
     */
    const paidAt = earliest(addDays(eventDate, -21), addDays(now, -1));

    return {
      id: id('booking', entry.key),
      requestId: source.id,
      customerId: source.customerId,
      vendorId: source.vendorId,
      eventDate: source.eventDate,
      eventLocation: source.eventLocation,
      totalAmountCents: fees.totalCents,
      platformFeeCents: fees.platformFeeCents,
      vendorPayoutCents: fees.vendorPayoutCents,
      status: entry.bookingStatus as BookingStatus,
      stripePaymentIntentId: `pi_demo_${entry.key.replaceAll('-', '_')}`,
      stripeTransferId:
        entry.bookingStatus === 'completed' ? `tr_demo_${entry.key.replaceAll('-', '_')}` : null,
      paidAt,
      completedAt: entry.bookingStatus === 'completed' ? addDays(eventDate, 1) : null,
      cancelledAt:
        entry.bookingStatus === 'cancelled' ? earliest(addDays(eventDate, -14), now) : null,
      cancellationReason:
        entry.bookingStatus === 'cancelled' ? 'Customer postponed the event indefinitely.' : null,
      createdAt: paidAt,
      updatedAt: earliest(addDays(eventDate, 1), now),
    };
  });

  await db
    .insert(bookings)
    .values(bookingValues)
    .onConflictDoUpdate({
      target: bookings.id,
      set: {
        eventDate: sql`excluded.event_date`,
        eventLocation: sql`excluded.event_location`,
        totalAmountCents: sql`excluded.total_amount_cents`,
        platformFeeCents: sql`excluded.platform_fee_cents`,
        vendorPayoutCents: sql`excluded.vendor_payout_cents`,
        status: sql`excluded.status`,
        stripePaymentIntentId: sql`excluded.stripe_payment_intent_id`,
        stripeTransferId: sql`excluded.stripe_transfer_id`,
        paidAt: sql`excluded.paid_at`,
        completedAt: sql`excluded.completed_at`,
        cancelledAt: sql`excluded.cancelled_at`,
        cancellationReason: sql`excluded.cancellation_reason`,
        createdAt: sql`excluded.created_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  // --- Conversations and messages ----------------------------------------
  const conversationValues = plan.map((entry, planIndex) => {
    const source = requestValues[planIndex] as (typeof requestValues)[number];
    const lastMessageAt = addDays(source.createdAt, entry.messageCount);

    return {
      id: id('conversation', entry.key),
      customerId: source.customerId,
      vendorId: source.vendorId,
      bookingRequestId: source.id,
      lastMessageAt,
      createdAt: source.createdAt,
    };
  });

  await db
    .insert(conversations)
    .values(conversationValues)
    .onConflictDoUpdate({
      target: conversations.id,
      set: {
        lastMessageAt: sql`excluded.last_message_at`,
        createdAt: sql`excluded.created_at`,
      },
    });

  const messageValues = plan.flatMap((entry, planIndex) => {
    const source = requestValues[planIndex] as (typeof requestValues)[number];
    const conversationId = (conversationValues[planIndex] as (typeof conversationValues)[number])
      .id;
    const vendorUserId = vendorUserIds[entry.vendorIndex] as string;

    return Array.from({ length: entry.messageCount }, (_unused, messageIndex) => {
      // The customer opens every thread, so an even index is the customer.
      const fromCustomer = messageIndex % 2 === 0;
      const sentAt = addDays(source.createdAt, messageIndex);

      return {
        id: id('message', `${entry.key}:${messageIndex}`),
        conversationId,
        senderId: fromCustomer ? source.customerId : vendorUserId,
        content: DEMO_MESSAGE_THREAD[messageIndex] as string,
        /*
         * Everything but the final message is read. That leaves exactly one
         * unread thread per conversation for whoever did not speak last, which
         * is what the notification bell and the unread filter render.
         */
        readAt: messageIndex === entry.messageCount - 1 ? null : addDays(sentAt, 1),
        createdAt: sentAt,
      };
    });
  });

  await db
    .insert(messages)
    .values(messageValues)
    .onConflictDoUpdate({
      target: messages.id,
      set: {
        content: sql`excluded.content`,
        readAt: sql`excluded.read_at`,
        createdAt: sql`excluded.created_at`,
      },
    });

  // --- Reviews ------------------------------------------------------------
  const completedPlan = plan.filter((entry) => entry.bookingStatus === 'completed');

  const reviewValues = completedPlan.flatMap((entry) => {
    const source = requestValues[
      planIndexByKey.get(entry.key) as number
    ] as (typeof requestValues)[number];
    const bookingId = id('booking', entry.key);
    const vendorProfileId = vendorProfileIds[entry.vendorIndex] as string;
    const vendorUserId = vendorUserIds[entry.vendorIndex] as string;
    const writtenAt = addDays(now, entry.eventDayOffset + 5);
    const vendorRating = Math.min(5, entry.rating + 1);

    return [
      {
        id: id('review', `${entry.key}:customer-to-vendor`),
        bookingId,
        reviewerId: source.customerId,
        vendorId: vendorProfileId,
        type: 'customer_to_vendor' as const,
        rating: entry.rating,
        title: null,
        content: pick(DEMO_CUSTOMER_REVIEW_COPY[entry.rating] as readonly string[], copyRandom),
        // Customer-to-vendor reviews are the public ones on a storefront.
        isPublic: true,
        createdAt: writtenAt,
      },
      {
        id: id('review', `${entry.key}:vendor-to-customer`),
        bookingId,
        reviewerId: vendorUserId,
        vendorId: vendorProfileId,
        type: 'vendor_to_customer' as const,
        rating: vendorRating,
        title: null,
        content: pick(DEMO_VENDOR_REVIEW_COPY[vendorRating] as readonly string[], copyRandom),
        // The vendor's read on a customer stays private, per `99-open-questions.md` #3.
        isPublic: false,
        createdAt: addDays(writtenAt, 1),
      },
    ];
  });

  await db
    .insert(reviews)
    .values(reviewValues)
    .onConflictDoUpdate({
      target: reviews.id,
      set: {
        rating: sql`excluded.rating`,
        title: sql`excluded.title`,
        content: sql`excluded.content`,
        isPublic: sql`excluded.is_public`,
        createdAt: sql`excluded.created_at`,
      },
    });

  // --- Notifications ------------------------------------------------------
  const notificationValues: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data: Record<string, unknown>;
    readAt: Date | null;
    createdAt: Date;
  }[] = [];

  const addNotification = (
    key: string,
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown>,
    createdAt: Date,
    read: boolean,
  ): void => {
    notificationValues.push({
      id: id('notification', key),
      userId,
      type,
      title,
      body,
      data,
      readAt: read ? addDays(createdAt, 1) : null,
      createdAt,
    });
  };

  // One per vendor, so the payouts-enabled state has a row behind it.
  DEMO_VENDORS.forEach((vendor, index) => {
    addNotification(
      `stripe:${vendor.key}`,
      vendorUserIds[index] as string,
      'stripe_onboarding_complete',
      'Payouts are enabled',
      'Your payout account is verified. Bookings you accept can now be paid for.',
      { vendorId: vendorProfileIds[index] as string },
      addDays(now, -590 + index * 10),
      true,
    );
  });

  /*
   * The moderation notification (#15). One row, on the first vendor, so the
   * demo data carries every type the product defines — `seed-demo.test.ts`
   * asserts exactly that, which is what makes a new type impossible to add
   * without also giving the demo a row for it.
   */
  addNotification(
    'tag-suggestion:approved',
    vendorUserIds[0] as string,
    'tag_suggestion_approved',
    'Your tag suggestion was approved',
    'It is live on your profile now, and customers can filter by it.',
    {},
    addDays(now, -120),
    true,
  );

  plan.forEach((entry, planIndex) => {
    const source = requestValues[planIndex] as (typeof requestValues)[number];
    const vendorUserId = vendorUserIds[entry.vendorIndex] as string;
    const vendor = DEMO_VENDORS[entry.vendorIndex] as (typeof DEMO_VENDORS)[number];
    const requestData = { bookingRequestId: source.id, vendorId: source.vendorId };
    const settledAt = source.updatedAt;

    addNotification(
      `request:${entry.key}`,
      vendorUserId,
      'new_request',
      'New booking request',
      `A customer asked about ${source.eventDate}. Open the request to quote or decline.`,
      requestData,
      source.createdAt,
      entry.requestStatus !== 'pending',
    );

    const customerFacing: Partial<
      Record<BookingRequestStatus, [NotificationType, string, string]>
    > = {
      quoted: ['request_quoted', 'You have a quote', `${vendor.businessName} sent you a quote.`],
      accepted: [
        'request_accepted',
        'Request accepted',
        `${vendor.businessName} accepted your request. Pay to confirm the date.`,
      ],
      declined: [
        'request_declined',
        'Request declined',
        `${vendor.businessName} is not available for that date.`,
      ],
      expired: [
        'request_expired',
        'Request expired',
        `Your request to ${vendor.businessName} expired without a reply.`,
      ],
    };

    const forCustomer = customerFacing[entry.requestStatus];
    if (forCustomer) {
      addNotification(
        `request-outcome:${entry.key}`,
        source.customerId,
        forCustomer[0],
        forCustomer[1],
        forCustomer[2],
        requestData,
        settledAt,
        entry.requestStatus !== 'quoted',
      );
    }

    if (entry.requestStatus === 'cancelled') {
      addNotification(
        `request-outcome:${entry.key}`,
        vendorUserId,
        'request_cancelled',
        'Request cancelled',
        'The customer withdrew this request.',
        requestData,
        settledAt,
        true,
      );
    }

    // The unread message that the final unread row in the thread implies.
    const lastFromCustomer = (entry.messageCount - 1) % 2 === 0;
    addNotification(
      `message:${entry.key}`,
      lastFromCustomer ? vendorUserId : source.customerId,
      'new_message',
      'New message',
      'You have an unread message in this thread.',
      { conversationId: (conversationValues[planIndex] as { id: string }).id },
      addDays(source.createdAt, entry.messageCount),
      false,
    );

    if (entry.bookingStatus === null) {
      return;
    }

    const bookingId = id('booking', entry.key);
    const bookingData = { bookingId };
    const eventDate = addDays(now, entry.eventDayOffset);

    const copy = BOOKING_NOTIFICATION_COPY[entry.bookingStatus];
    if (copy) {
      for (const [side, userId] of [
        ['customer', source.customerId],
        ['vendor', vendorUserId],
      ] as const) {
        addNotification(
          `booking:${entry.key}:${side}`,
          userId,
          copy.type,
          copy.title,
          copy.body,
          bookingData,
          addDays(eventDate, entry.bookingStatus === 'confirmed' ? -40 : 1),
          entry.bookingStatus !== 'confirmed',
        );
      }
    }

    if (entry.bookingStatus === 'completed') {
      addNotification(
        `payout:${entry.key}`,
        vendorUserId,
        'payout_sent',
        'Payout sent',
        'Your payout for this booking is on its way to your bank.',
        bookingData,
        addDays(eventDate, 3),
        true,
      );

      /*
       * `notificationHref` branches on `vendorSlug`: present sends the reader to
       * `/vendors/<slug>?tab=reviews`, absent to `/customer/profile?tab=reviews`.
       * So the public direction carries it and the private one must not — the
       * same split `reviews.service.ts` writes. Getting it wrong sends the
       * vendor to the customer's profile.
       */
      addNotification(
        `review:${entry.key}:vendor`,
        vendorUserId,
        'new_review',
        'New review',
        'A customer left you a review.',
        { bookingId, vendorSlug: vendor.slug },
        addDays(eventDate, 5),
        false,
      );

      addNotification(
        `review:${entry.key}:customer`,
        source.customerId,
        'new_review',
        'New review',
        'A vendor left you a review.',
        { bookingId },
        addDays(eventDate, 6),
        true,
      );
    }
  });

  await db
    .insert(notifications)
    .values(notificationValues)
    .onConflictDoUpdate({
      target: notifications.id,
      set: {
        type: sql`excluded.type`,
        title: sql`excluded.title`,
        body: sql`excluded.body`,
        data: sql`excluded.data`,
        readAt: sql`excluded.read_at`,
        createdAt: sql`excluded.created_at`,
      },
    });

  // --- Availability -------------------------------------------------------
  /*
   * Keyed by vendor and date so a booked event date and a derived blocked day
   * cannot both be written for one vendor — `availability_vendor_date_key` is
   * unique, and the conflict would abort the whole insert. A booked date wins.
   */
  const availabilityByKey = new Map<
    string,
    { vendorId: string; date: string; status: 'blocked' | 'booked' }
  >();

  DEMO_VENDORS.forEach((vendor, vendorIndex) => {
    const random = makeRandom(hashString(`orla.demo.availability:${vendor.key}`));
    const vendorId = vendorProfileIds[vendorIndex] as string;

    for (let index = 0; index < BLOCKED_DAYS_PER_VENDOR; index += 1) {
      const date = toDateString(addDays(now, 5 + Math.floor(random() * 150)));
      availabilityByKey.set(`${vendorId}:${date}`, { vendorId, date, status: 'blocked' });
    }
  });

  for (const entry of bookedPlan) {
    if (entry.bookingStatus === 'cancelled') {
      continue;
    }

    const vendorId = vendorProfileIds[entry.vendorIndex] as string;
    const date = toDateString(addDays(now, entry.eventDayOffset));
    availabilityByKey.set(`${vendorId}:${date}`, { vendorId, date, status: 'booked' });
  }

  const availabilityValues = [...availabilityByKey.values()].map((row) => ({
    id: id('availability', `${row.vendorId}:${row.date}`),
    vendorId: row.vendorId,
    date: row.date,
    status: row.status,
  }));

  await db
    .insert(availability)
    .values(availabilityValues)
    .onConflictDoUpdate({
      target: availability.id,
      set: { status: sql`excluded.status` },
    });

  /*
   * Converge: drop anything this seed owns but no longer emits.
   *
   * The upserts above only repair rows that are still in a `values()` list. A
   * row an earlier version wrote and this one does not — a portfolio item for a
   * category that lost its image, a booking request dropped when the plan
   * shrank — is never revisited, so it survives every re-run and the seed stops
   * being idempotent in the direction that matters. `.claude/rules/db-schema.md`
   * calls this out precisely because nothing fails loudly: the column is
   * nullable or the row merely stale, so no constraint trips and the surface
   * just renders the wrong thing indefinitely.
   *
   * Ordered by foreign key, deepest first: `bookings` holds `request_id`,
   * `customer_id` and `vendor_id` as RESTRICT, so a stale booking has to go
   * before the request under it.
   */
  /*
   * Scoped by the rows this seed *owns*, never by the vendor.
   *
   * Every row the demo seed writes into the booking graph has a demo customer
   * on it. A row that does not — a request, booking, conversation or message
   * created by any other account against a demo storefront, which is exactly
   * what `browser-verifier` produces every time it drives the request flow —
   * belongs to somebody else, and pruning by `vendor_id` would silently delete
   * it on the next ordinary `pnpm db:seed:demo`.
   *
   * The three vendor-owned asset tables are different and are keyed by vendor
   * on purpose: only a vendor can add their own packages, portfolio or blocked
   * dates, and that vendor is a demo account.
   */
  const demoCustomerIds = customerIds;
  const demoUserIds = userValues.map((row) => row.id);
  const demoConversationIds = conversationValues.map((row) => row.id);

  await pruneStale(db, bookings, bookings.customerId, demoCustomerIds, bookingValues);
  await pruneStale(db, reviews, reviews.reviewerId, demoUserIds, reviewValues);
  await pruneStale(db, bookingRequests, bookingRequests.customerId, demoCustomerIds, requestValues);
  await pruneStale(
    db,
    conversations,
    conversations.customerId,
    demoCustomerIds,
    conversationValues,
  );
  await pruneStale(db, messages, messages.conversationId, demoConversationIds, messageValues);
  await pruneStale(db, notifications, notifications.userId, demoUserIds, notificationValues);

  await pruneStale(db, portfolioItems, portfolioItems.vendorId, vendorProfileIds, portfolioValues);
  await pruneStale(db, servicePackages, servicePackages.vendorId, vendorProfileIds, packageValues);
  await pruneStale(db, availability, availability.vendorId, vendorProfileIds, availabilityValues);

  /*
   * Derived, never written: `avg_rating` and `review_count` are recomputed from
   * the rows that just landed. Writing them directly is how a seeded average
   * drifts from the reviews under it.
   */
  await recomputeVendorRatings(db, vendorProfileIds);

  return {
    usersUpserted: userValues.length,
    vendorsUpserted: DEMO_VENDORS.length,
    packagesUpserted: packageValues.length,
    portfolioItemsUpserted: portfolioValues.length,
    requestsUpserted: requestValues.length,
    bookingsUpserted: bookingValues.length,
    conversationsUpserted: conversationValues.length,
    messagesUpserted: messageValues.length,
    reviewsUpserted: reviewValues.length,
    notificationsUpserted: notificationValues.length,
    availabilityRowsUpserted: availabilityValues.length,
  };
}

/** A demo vendor profile id by its seed key, for stable Playwright navigation. */
export function demoVendorProfileId(key: string): string {
  if (!DEMO_VENDORS.some((vendor) => vendor.key === key)) {
    throw new Error(`demoVendorProfileId: no demo vendor with key "${key}"`);
  }

  return id('vendor-profile', key);
}
