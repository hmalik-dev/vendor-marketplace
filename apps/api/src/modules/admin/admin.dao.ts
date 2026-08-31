import { and, asc, count, desc, eq, gt, ilike, inArray, or, sql } from 'drizzle-orm';
import {
  bookingRequests,
  bookings,
  categories,
  users,
  vendorCategories,
  vendorProfiles,
  type UserRow,
} from '@vendor-marketplace/db/schema';
import type { AdminPayoutFilter, AdminVendorStatus } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * Every read and write the admin portal makes. Policy lives in the service; this
 * file only knows how to ask Postgres.
 */

/** The projection the Vendors table renders, before the status is derived. */
export interface AdminVendorProjection {
  id: string;
  userId: string;
  businessName: string;
  slug: string;
  categoryName: string | null;
  city: string | null;
  state: string | null;
  avgRating: string;
  reviewCount: number;
  bookingsCount: number;
  isPublished: boolean;
  stripeOnboarded: boolean;
  isBanned: boolean;
  createdAt: Date;
}

export interface AdminVendorFilters {
  q?: string | undefined;
  category?: string | undefined;
  city?: string | undefined;
  payouts?: AdminPayoutFilter | undefined;
  status?: AdminVendorStatus | undefined;
}

/**
 * The four statuses are **derived**, not stored, so filtering by one has to be
 * expressed as the same conditions the derivation uses — see
 * `ADMIN_VENDOR_STATUSES` for the table and the reasoning. Writing it once here
 * and once in the service is how the two would drift, so the service derives the
 * label from this file's row and this file filters with these predicates; both
 * read the same three columns and nothing else.
 */
function statusCondition(status: AdminVendorStatus) {
  if (status === 'flagged') {
    return eq(users.isBanned, true);
  }

  if (status === 'live') {
    return and(eq(users.isBanned, false), eq(vendorProfiles.isPublished, true));
  }

  if (status === 'paused') {
    return and(
      eq(users.isBanned, false),
      eq(vendorProfiles.isPublished, false),
      eq(vendorProfiles.stripeOnboarded, true),
    );
  }

  return and(
    eq(users.isBanned, false),
    eq(vendorProfiles.isPublished, false),
    eq(vendorProfiles.stripeOnboarded, false),
  );
}

function vendorFilterCondition(filters: AdminVendorFilters) {
  const conditions = [eq(vendorProfiles.isDeleted, false)];

  if (filters.q) {
    /*
     * `ilike` with the term escaped by Drizzle's parameter binding. The operator
     * is deliberately a contains rather than a prefix: an operator searching a
     * support ticket has a fragment of a name, not its beginning.
     */
    const term = `%${filters.q}%`;
    const match = or(
      ilike(vendorProfiles.businessName, term),
      ilike(vendorProfiles.slug, term),
      ilike(users.email, term),
    );

    if (match) {
      conditions.push(match);
    }
  }

  if (filters.category) {
    /*
     * `vendor_categories` is many-to-many, so this is an EXISTS rather than a
     * join: joining it would duplicate a vendor once per category and turn both
     * the count and the page window into lies.
     */
    conditions.push(sql`exists (
      select 1 from ${vendorCategories}
      join ${categories} on ${categories.id} = ${vendorCategories.categoryId}
      where ${vendorCategories.vendorId} = ${vendorProfiles.id}
        and ${categories.slug} = ${filters.category}
    )`);
  }

  if (filters.city) {
    conditions.push(eq(vendorProfiles.city, filters.city));
  }

  if (filters.payouts) {
    conditions.push(eq(vendorProfiles.stripeOnboarded, filters.payouts === 'connected'));
  }

  if (filters.status) {
    const condition = statusCondition(filters.status);

    if (condition) {
      conditions.push(condition);
    }
  }

  return and(...conditions);
}

/**
 * The bookings count beside each vendor.
 *
 * A correlated subquery rather than a `GROUP BY` join, because the row is
 * already three tables wide and a fourth join would multiply the rating and
 * review columns before the aggregate collapsed them — the classic way a table
 * like this starts reporting a vendor's review count times their booking count.
 */
const bookingsCountExpression = sql<number>`(
  select count(*)::int from ${bookings} where ${bookings.vendorId} = ${vendorProfiles.id}
)`;

/**
 * The single category the frame's `Category` column shows.
 *
 * A vendor may hold several, and the frame draws one. Taking the lowest
 * `display_order` makes the choice deterministic and matches the order the
 * category picker itself offers — so the table agrees with what the vendor sees
 * on their own profile rather than picking whichever row the planner returned
 * first.
 */
const primaryCategoryExpression = sql<string | null>`(
  select ${categories.name}
  from ${vendorCategories}
  join ${categories} on ${categories.id} = ${vendorCategories.categoryId}
  where ${vendorCategories.vendorId} = ${vendorProfiles.id}
  order by ${categories.displayOrder} asc
  limit 1
)`;

export async function findAdminVendors(
  db: AppDatabase,
  filters: AdminVendorFilters,
  limit: number,
  offset: number,
): Promise<AdminVendorProjection[]> {
  return db
    .select({
      id: vendorProfiles.id,
      userId: vendorProfiles.userId,
      businessName: vendorProfiles.businessName,
      slug: vendorProfiles.slug,
      categoryName: primaryCategoryExpression,
      city: vendorProfiles.city,
      state: vendorProfiles.state,
      avgRating: vendorProfiles.avgRating,
      reviewCount: vendorProfiles.reviewCount,
      bookingsCount: bookingsCountExpression,
      isPublished: vendorProfiles.isPublished,
      stripeOnboarded: vendorProfiles.stripeOnboarded,
      isBanned: users.isBanned,
      createdAt: vendorProfiles.createdAt,
    })
    .from(vendorProfiles)
    .innerJoin(users, eq(users.id, vendorProfiles.userId))
    .where(vendorFilterCondition(filters))
    .orderBy(desc(vendorProfiles.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countAdminVendors(
  db: AppDatabase,
  filters: AdminVendorFilters,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(vendorProfiles)
    .innerJoin(users, eq(users.id, vendorProfiles.userId))
    .where(vendorFilterCondition(filters));

  return rows?.[0]?.total ?? 0;
}

/**
 * How many vendors are in the `review` state, under the *same* filters as the
 * table — so "412 total · 38 awaiting review" always describes the rows below
 * it rather than the whole platform.
 */
export async function countVendorsAwaitingReview(
  db: AppDatabase,
  filters: AdminVendorFilters,
): Promise<number> {
  return countAdminVendors(db, { ...filters, status: 'review' });
}

/** The distinct cities and categories the filter bar offers — real values only. */
export async function findVendorFilterFacets(db: AppDatabase): Promise<{
  cities: string[];
  categories: { slug: string; name: string }[];
}> {
  const [cityRows, categoryRows] = await Promise.all([
    db
      .selectDistinct({ city: vendorProfiles.city })
      .from(vendorProfiles)
      .where(and(eq(vendorProfiles.isDeleted, false), sql`${vendorProfiles.city} is not null`))
      .orderBy(asc(vendorProfiles.city)),
    db
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.displayOrder)),
  ]);

  return {
    cities: cityRows.map((row) => row.city).filter((city): city is string => city !== null),
    categories: categoryRows,
  };
}

export async function findUserById(db: AppDatabase, userId: string): Promise<UserRow | null> {
  if (!userId) {
    return null;
  }

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return rows?.[0] ?? null;
}

/** The vendor profile an account owns, if it has one. */
export async function findVendorProfileByUserId(
  db: AppDatabase,
  userId: string,
): Promise<{ id: string; isPublished: boolean } | null> {
  if (!userId) {
    return null;
  }

  const rows = await db
    .select({ id: vendorProfiles.id, isPublished: vendorProfiles.isPublished })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, userId))
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Confirmed bookings in the future that a ban has to unwind, on **either** side
 * of the account: banning a vendor strands their customers, and banning a
 * customer strands their vendors. The ticket's own edge case names both.
 */
export interface BanAffectedBooking {
  id: string;
  customerId: string;
  vendorId: string;
  totalAmountCents: number;
  stripePaymentIntentId: string | null;
}

export async function findConfirmedBookingsToUnwind(
  db: AppDatabase,
  userId: string,
  vendorProfileId: string | null,
  today: string,
): Promise<BanAffectedBooking[]> {
  const sides = vendorProfileId
    ? or(eq(bookings.customerId, userId), eq(bookings.vendorId, vendorProfileId))
    : eq(bookings.customerId, userId);

  if (!sides) {
    return [];
  }

  return db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      vendorId: bookings.vendorId,
      totalAmountCents: bookings.totalAmountCents,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
    })
    .from(bookings)
    .where(and(eq(bookings.status, 'confirmed'), gt(bookings.eventDate, today), sides));
}

/**
 * Requests that have not become bookings yet. They carry no money, so they are
 * declined rather than refunded — but leaving them pending would keep a banned
 * account in someone's queue as if it could still answer.
 */
export async function declineOpenRequests(
  db: AppDatabase,
  userId: string,
  vendorProfileId: string | null,
  now: Date,
): Promise<number> {
  const sides = vendorProfileId
    ? or(eq(bookingRequests.customerId, userId), eq(bookingRequests.vendorId, vendorProfileId))
    : eq(bookingRequests.customerId, userId);

  if (!sides) {
    return 0;
  }

  const declined = await db
    .update(bookingRequests)
    .set({ status: 'declined', updatedAt: now })
    .where(and(inArray(bookingRequests.status, ['pending', 'quoted', 'accepted']), sides))
    .returning({ id: bookingRequests.id });

  return declined.length;
}

/**
 * Sets the ban flag and, for a vendor, takes the storefront down — one
 * transaction, because a banned account whose profile is still published is the
 * state the ban exists to prevent.
 *
 * **Unban does not republish.** The vendor publishes again themselves, which is
 * the ticket's rule: reinstating an account is not the same as reinstating a
 * listing, and the operator does not decide when a vendor is ready to trade.
 */
export async function setBanned(
  db: AppDatabase,
  userId: string,
  vendorProfileId: string | null,
  isBanned: boolean,
  now: Date,
): Promise<{ profileUnpublished: boolean }> {
  return db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ isBanned, bannedAt: isBanned ? now : null, updatedAt: now })
      .where(eq(users.id, userId));

    if (isBanned && vendorProfileId) {
      const unpublished = await tx
        .update(vendorProfiles)
        .set({ isPublished: false, updatedAt: now })
        .where(and(eq(vendorProfiles.id, vendorProfileId), eq(vendorProfiles.isPublished, true)))
        .returning({ id: vendorProfiles.id });

      return { profileUnpublished: unpublished.length > 0 };
    }

    return { profileUnpublished: false };
  });
}

/** The user row behind a vendor profile — the ban target, and the notification recipient. */
export async function findVendorOwnerId(
  db: AppDatabase,
  vendorProfileId: string,
): Promise<string | null> {
  if (!vendorProfileId) {
    return null;
  }

  const rows = await db
    .select({ userId: vendorProfiles.userId })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.id, vendorProfileId))
    .limit(1);

  return rows?.[0]?.userId ?? null;
}

/** Total accounts, for the Overview cards. */
export async function countUsers(db: AppDatabase): Promise<number> {
  const rows = await db.select({ total: count() }).from(users);

  return rows?.[0]?.total ?? 0;
}
