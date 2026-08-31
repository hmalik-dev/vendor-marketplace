import { and, asc, count, desc, eq, gt, gte, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
  bookingRequests,
  bookings,
  categories,
  reviews,
  tagSuggestions,
  tags,
  users,
  vendorCategories,
  vendorProfiles,
  vendorTags,
  type TagRow,
  type TagSuggestionRow,
  type UserRow,
} from '@vendor-marketplace/db/schema';
import type {
  AdminPayoutFilter,
  AdminVendorStatus,
  BookingStatus,
  ReviewType,
  TagCategory,
  TagSuggestionStatus,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { containsInsensitive } from '../../lib/like-pattern.js';

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
     * A contains rather than a prefix: an operator working a support ticket has
     * a fragment of a name, not its beginning.
     *
     * `containsInsensitive`, never Drizzle's `ilike` — the term is user text and
     * `ilike` has no `ESCAPE`, so a bare `%` would match every vendor and a
     * business with a `%` in its name could not be found at all.
     */
    const match = or(
      containsInsensitive(vendorProfiles.businessName, filters.q),
      containsInsensitive(vendorProfiles.slug, filters.q),
      containsInsensitive(users.email, filters.q),
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

// --- Customers -------------------------------------------------------------

export interface AdminCustomerProjection {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  city: string | null;
  state: string | null;
  totalBookingsCount: number;
  isBanned: boolean;
  createdAt: Date;
}

/**
 * Customers are `users` with the customer role — there is no second table.
 * Soft-deleted accounts are excluded for the same reason deleted vendors are:
 * an operator moderating an account that no longer exists can only cause harm.
 */
function customerCondition(q: string | undefined) {
  const conditions = [eq(users.role, 'customer'), sql`${users.deletedAt} is null`];

  if (q) {
    const match = or(
      containsInsensitive(users.email, q),
      containsInsensitive(users.firstName, q),
      containsInsensitive(users.lastName, q),
    );

    if (match) {
      conditions.push(match);
    }
  }

  return and(...conditions);
}

export async function findAdminCustomers(
  db: AppDatabase,
  q: string | undefined,
  limit: number,
  offset: number,
): Promise<AdminCustomerProjection[]> {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      city: users.city,
      state: users.state,
      totalBookingsCount: users.totalBookingsCount,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(customerCondition(q))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countAdminCustomers(db: AppDatabase, q: string | undefined): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(customerCondition(q));

  return rows?.[0]?.total ?? 0;
}

// --- Bookings and payments -------------------------------------------------

/**
 * `bookings` joined to both sides' names.
 *
 * The customer is a `users` row and the vendor a `vendor_profiles` row, so this
 * is two joins rather than one aliased self-join. Both are inner: a booking
 * whose vendor or customer row is gone is not a row an operator can act on, and
 * both foreign keys cascade, so it cannot occur.
 */
const bookingCustomer = users;

function bookingSelection() {
  return {
    id: bookings.id,
    status: bookings.status,
    eventDate: bookings.eventDate,
    totalAmountCents: bookings.totalAmountCents,
    platformFeeCents: bookings.platformFeeCents,
    vendorPayoutCents: bookings.vendorPayoutCents,
    stripePaymentIntentId: bookings.stripePaymentIntentId,
    paidAt: bookings.paidAt,
    customerFirstName: bookingCustomer.firstName,
    customerLastName: bookingCustomer.lastName,
    vendorName: vendorProfiles.businessName,
    vendorSlug: vendorProfiles.slug,
    createdAt: bookings.createdAt,
  };
}

export interface AdminBookingProjection {
  id: string;
  status: string;
  eventDate: string;
  totalAmountCents: number;
  platformFeeCents: number;
  vendorPayoutCents: number;
  stripePaymentIntentId: string | null;
  paidAt: Date | null;
  customerFirstName: string;
  customerLastName: string;
  vendorName: string;
  vendorSlug: string;
  createdAt: Date;
}

export async function findAdminBookings(
  db: AppDatabase,
  status: BookingStatus | undefined,
  limit: number,
  offset: number,
): Promise<AdminBookingProjection[]> {
  return db
    .select(bookingSelection())
    .from(bookings)
    .innerJoin(bookingCustomer, eq(bookingCustomer.id, bookings.customerId))
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(status ? eq(bookings.status, status) : undefined)
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countAdminBookings(
  db: AppDatabase,
  status: BookingStatus | undefined,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookings)
    .where(status ? eq(bookings.status, status) : undefined);

  return rows?.[0]?.total ?? 0;
}

/**
 * The Payments view is the same rows read for the money rather than the event,
 * so it filters to bookings that were actually paid and orders by when the
 * money moved. **There is no `payments` table** — see `adminPaymentRowSchema`.
 */
export async function findAdminPayments(
  db: AppDatabase,
  limit: number,
  offset: number,
): Promise<AdminBookingProjection[]> {
  return db
    .select(bookingSelection())
    .from(bookings)
    .innerJoin(bookingCustomer, eq(bookingCustomer.id, bookings.customerId))
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(sql`${bookings.paidAt} is not null`)
    .orderBy(desc(bookings.paidAt))
    .limit(limit)
    .offset(offset);
}

export async function countAdminPayments(db: AppDatabase): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookings)
    .where(sql`${bookings.paidAt} is not null`);

  return rows?.[0]?.total ?? 0;
}

// --- Reviews ---------------------------------------------------------------

export interface AdminReviewProjection {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  type: ReviewType;
  authorFirstName: string;
  authorLastName: string;
  vendorName: string;
  vendorSlug: string;
  createdAt: Date;
}

export async function findAdminReviews(
  db: AppDatabase,
  type: ReviewType | undefined,
  limit: number,
  offset: number,
): Promise<AdminReviewProjection[]> {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      content: reviews.content,
      type: reviews.type,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      vendorName: vendorProfiles.businessName,
      vendorSlug: vendorProfiles.slug,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.reviewerId))
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, reviews.vendorId))
    .where(type ? eq(reviews.type, type) : undefined)
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countAdminReviews(
  db: AppDatabase,
  type: ReviewType | undefined,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviews)
    .where(type ? eq(reviews.type, type) : undefined);

  return rows?.[0]?.total ?? 0;
}

// --- Tag moderation --------------------------------------------------------

export interface AdminTagSuggestionProjection {
  id: string;
  vendorId: string;
  suggestedName: string;
  category: TagCategory;
  status: TagSuggestionStatus;
  resolvedTagId: string | null;
  adminNote: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  vendorFirstName: string;
  vendorLastName: string;
  vendorBusinessName: string | null;
  resolvedTagName: string | null;
}

/**
 * `tag_suggestions.vendor_id` is a **`users`** id, not a profile id — the column
 * name predates the split and the foreign key says so. The business name is
 * therefore a left join through `vendor_profiles`, and null for a suggestion
 * from an account that has not built a storefront yet.
 */
const resolvedTagName = sql<string | null>`(
  select ${tags.name} from ${tags} where ${tags.id} = ${tagSuggestions.resolvedTagId}
)`;

const suggestionVendorProfile = sql<string | null>`(
  select ${vendorProfiles.businessName}
  from ${vendorProfiles}
  where ${vendorProfiles.userId} = ${tagSuggestions.vendorId}
  limit 1
)`;

function tagSuggestionSelection() {
  return {
    id: tagSuggestions.id,
    vendorId: tagSuggestions.vendorId,
    suggestedName: tagSuggestions.suggestedName,
    category: tagSuggestions.category,
    status: tagSuggestions.status,
    resolvedTagId: tagSuggestions.resolvedTagId,
    adminNote: tagSuggestions.adminNote,
    createdAt: tagSuggestions.createdAt,
    resolvedAt: tagSuggestions.resolvedAt,
    vendorFirstName: users.firstName,
    vendorLastName: users.lastName,
    vendorBusinessName: suggestionVendorProfile,
    resolvedTagName,
  };
}

export async function findAdminTagSuggestions(
  db: AppDatabase,
  status: TagSuggestionStatus | undefined,
  limit: number,
  offset: number,
): Promise<AdminTagSuggestionProjection[]> {
  return (
    db
      .select(tagSuggestionSelection())
      .from(tagSuggestions)
      .innerJoin(users, eq(users.id, tagSuggestions.vendorId))
      .where(status ? eq(tagSuggestions.status, status) : undefined)
      /*
       * Oldest first, and only here. Every other admin list is newest-first
       * because it is a log; this one is a **queue**, and a queue that surfaces
       * the newest item leaves the oldest suggestion waiting forever.
       */
      .orderBy(asc(tagSuggestions.createdAt))
      .limit(limit)
      .offset(offset)
  );
}

/** The same projection for one row, so a resolve response and the queue cannot disagree. */
export async function findAdminTagSuggestionById(
  db: AppDatabase,
  suggestionId: string,
): Promise<AdminTagSuggestionProjection | null> {
  const rows = await db
    .select(tagSuggestionSelection())
    .from(tagSuggestions)
    .innerJoin(users, eq(users.id, tagSuggestions.vendorId))
    .where(eq(tagSuggestions.id, suggestionId))
    .limit(1);

  return rows?.[0] ?? null;
}

export async function countAdminTagSuggestions(
  db: AppDatabase,
  status: TagSuggestionStatus | undefined,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tagSuggestions)
    .where(status ? eq(tagSuggestions.status, status) : undefined);

  return rows?.[0]?.total ?? 0;
}

export async function findTagSuggestionById(
  db: AppDatabase,
  suggestionId: string,
): Promise<TagSuggestionRow | null> {
  if (!suggestionId) {
    return null;
  }

  const rows = await db
    .select()
    .from(tagSuggestions)
    .where(eq(tagSuggestions.id, suggestionId))
    .limit(1);

  return rows?.[0] ?? null;
}

export async function findTagById(db: AppDatabase, tagId: string): Promise<TagRow | null> {
  if (!tagId) {
    return null;
  }

  const rows = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);

  return rows?.[0] ?? null;
}

export interface AdminTagProjection extends TagRow {
  vendorCount: number;
}

/**
 * Every tag, active or not, with the count that makes deactivation legible.
 *
 * The count is a correlated subquery rather than a join for the reason in
 * `bookingsCountExpression`: joining `vendor_tags` would return one row per
 * assignment and the table would list each tag as many times as it is used.
 */
export async function findAdminTags(db: AppDatabase): Promise<AdminTagProjection[]> {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      category: tags.category,
      displayOrder: tags.displayOrder,
      isActive: tags.isActive,
      createdAt: tags.createdAt,
      vendorCount: sql<number>`(
        select count(*)::int from ${vendorTags} where ${vendorTags.tagId} = ${tags.id}
      )`,
    })
    .from(tags)
    .orderBy(asc(tags.category), asc(tags.displayOrder), asc(tags.name));
}

/** The vendor profile a suggesting `users` row owns, if any — what a tag gets assigned to. */
export async function findVendorProfileIdByUserId(
  db: AppDatabase,
  userId: string,
): Promise<string | null> {
  const profile = await findVendorProfileByUserId(db, userId);

  return profile?.id ?? null;
}

export interface ResolveSuggestionWrite {
  suggestionId: string;
  status: TagSuggestionStatus;
  resolvedTagId: string | null;
  adminNote: string | null;
  resolvedAt: Date;
}

/**
 * Marks a suggestion resolved, but **only while it is still pending**.
 *
 * That predicate is the concurrency rule the ticket asks for — two operators
 * acting on one suggestion means the first wins and the second is told so,
 * rather than the second silently overwriting the first's decision. Returns
 * `null` when the row was already resolved.
 */
export async function resolveTagSuggestionRow(
  tx: AppDatabase,
  write: ResolveSuggestionWrite,
): Promise<TagSuggestionRow | null> {
  const updated = await tx
    .update(tagSuggestions)
    .set({
      status: write.status,
      resolvedTagId: write.resolvedTagId,
      adminNote: write.adminNote,
      resolvedAt: write.resolvedAt,
    })
    .where(and(eq(tagSuggestions.id, write.suggestionId), eq(tagSuggestions.status, 'pending')))
    .returning();

  return updated?.[0] ?? null;
}

export async function insertTag(
  tx: AppDatabase,
  values: { name: string; slug: string; category: TagCategory },
): Promise<TagRow> {
  const nextOrder = await tx
    .select({ next: sql<number>`coalesce(max(${tags.displayOrder}), 0) + 1` })
    .from(tags)
    .where(eq(tags.category, values.category));

  const inserted = await tx
    .insert(tags)
    .values({ ...values, displayOrder: nextOrder?.[0]?.next ?? 1, isActive: true })
    .returning();
  const row = inserted?.[0];

  if (!row) {
    throw new Error('Tag insert returned no row');
  }

  return row;
}

/** Idempotent: an operator approving a tag the vendor already holds is not an error. */
export async function assignTagToVendor(
  tx: AppDatabase,
  vendorProfileId: string,
  tagId: string,
): Promise<void> {
  await tx.insert(vendorTags).values({ vendorId: vendorProfileId, tagId }).onConflictDoNothing();
}

export async function findTagBySlug(db: AppDatabase, slug: string): Promise<TagRow | null> {
  const rows = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);

  return rows?.[0] ?? null;
}

/**
 * Case-insensitive name lookup within a category, **regardless of `is_active`**.
 *
 * Deliberately not `findActiveTagByCategoryAndName`: approving a suggestion whose
 * name matches a *deactivated* tag must resurface that tag rather than insert a
 * second row, which the `(category, name)` unique index would reject anyway —
 * as a 500 rather than the note the operator is owed.
 */
export async function findTagByCategoryAndName(
  db: AppDatabase,
  category: TagCategory,
  normalizedName: string,
): Promise<TagRow | null> {
  const rows = await db
    .select()
    .from(tags)
    .where(and(eq(tags.category, category), sql`lower(${tags.name}) = ${normalizedName}`))
    .limit(1);

  return rows?.[0] ?? null;
}

export async function updateTagRow(
  db: AppDatabase,
  tagId: string,
  values: { name?: string; slug?: string; isActive?: boolean; displayOrder?: number },
): Promise<TagRow | null> {
  const updated = await db.update(tags).set(values).where(eq(tags.id, tagId)).returning();

  return updated?.[0] ?? null;
}

export async function countVendorsHoldingTag(db: AppDatabase, tagId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(vendorTags)
    .where(eq(vendorTags.tagId, tagId));

  return rows?.[0]?.total ?? 0;
}

// --- Overview metrics ------------------------------------------------------

/** One bucket of a daily series, as Postgres returns it — sparse, days with no rows absent. */
export interface DailyBucket {
  date: string;
  value: number;
}

/**
 * Buckets a timestamp column by UTC day.
 *
 * **`at time zone 'UTC'` rather than a bare `::date`**, which would bucket by
 * whatever `TimeZone` the connection happens to carry — so the same chart would
 * draw differently against a local Postgres and a hosted one, which is the kind
 * of drift nobody notices until a number is disputed.
 */
function dayBucket(column: PgColumn): SQL<string> {
  return sql<string>`to_char((${column} at time zone 'UTC')::date, 'YYYY-MM-DD')`;
}

async function dailySeries(
  db: AppDatabase,
  table: PgTable,
  column: PgColumn,
  value: SQL<number>,
  since: Date,
  extra?: SQL<unknown>,
): Promise<DailyBucket[]> {
  const bucket = dayBucket(column);

  return db
    .select({ date: bucket, value })
    .from(table)
    .where(and(sql`${column} is not null`, gte(column, since), extra))
    .groupBy(bucket)
    .orderBy(asc(bucket));
}

/**
 * Money that actually moved, net of refunds.
 *
 * A cancelled booking was refunded in full by `cancelBooking` and by a ban, so
 * counting it would report revenue the platform gave back. This is gross
 * booking value rather than the platform's own take — the Overview card names
 * which one it is, because "revenue" alone is the ambiguity that makes an
 * operations number untrustworthy.
 */
const PAID_AND_KEPT = sql`${bookings.paidAt} is not null and ${bookings.status} <> 'cancelled'`;

export interface AdminMetricTotals {
  totalRevenueCents: number;
  bookingsCount: number;
  activeVendorsCount: number;
  usersCount: number;
  pendingTagSuggestionsCount: number;
  reviewsCount: number;
}

export async function findAdminMetricTotals(db: AppDatabase): Promise<AdminMetricTotals> {
  const [revenue, bookingRows, activeVendors, userRows, pending, reviewRows] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${bookings.totalAmountCents}), 0)::int` })
      .from(bookings)
      .where(PAID_AND_KEPT),
    db.select({ total: sql<number>`count(*)::int` }).from(bookings),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(vendorProfiles)
      .innerJoin(users, eq(users.id, vendorProfiles.userId))
      .where(
        and(
          eq(vendorProfiles.isDeleted, false),
          eq(vendorProfiles.isPublished, true),
          eq(users.isBanned, false),
        ),
      ),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`${users.deletedAt} is null`),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(tagSuggestions)
      .where(eq(tagSuggestions.status, 'pending')),
    db.select({ total: sql<number>`count(*)::int` }).from(reviews),
  ]);

  return {
    totalRevenueCents: revenue?.[0]?.total ?? 0,
    bookingsCount: bookingRows?.[0]?.total ?? 0,
    activeVendorsCount: activeVendors?.[0]?.total ?? 0,
    usersCount: userRows?.[0]?.total ?? 0,
    pendingTagSuggestionsCount: pending?.[0]?.total ?? 0,
    reviewsCount: reviewRows?.[0]?.total ?? 0,
  };
}

export interface AdminMetricSeries {
  revenueByDay: DailyBucket[];
  bookingsByDay: DailyBucket[];
  signupsByDay: DailyBucket[];
  completedByDay: DailyBucket[];
}

export async function findAdminMetricSeries(
  db: AppDatabase,
  since: Date,
): Promise<AdminMetricSeries> {
  const [revenueByDay, bookingsByDay, signupsByDay, completedByDay] = await Promise.all([
    dailySeries(
      db,
      bookings,
      bookings.paidAt,
      sql<number>`coalesce(sum(${bookings.totalAmountCents}), 0)::int`,
      since,
      PAID_AND_KEPT,
    ),
    dailySeries(db, bookings, bookings.createdAt, sql<number>`count(*)::int`, since),
    dailySeries(
      db,
      users,
      users.createdAt,
      sql<number>`count(*)::int`,
      since,
      sql`${users.deletedAt} is null`,
    ),
    dailySeries(db, bookings, bookings.completedAt, sql<number>`count(*)::int`, since),
  ]);

  return { revenueByDay, bookingsByDay, signupsByDay, completedByDay };
}
