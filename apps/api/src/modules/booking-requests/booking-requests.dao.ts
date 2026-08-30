import { and, desc, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm';
import {
  availability,
  bookingRequests,
  bookings,
  conversations,
  servicePackages,
  users,
  vendorProfiles,
  type AvailabilityRow,
  type BookingRequestRow,
  type NewBookingRequestRow,
  type ServicePackageRow,
  type VendorProfileRow,
} from '@vendor-marketplace/db/schema';
import {
  LIVE_BOOKING_REQUEST_STATUSES,
  type BookingRequestStatus,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/** Newest first — both hubs read a request queue, and the queue is a stack. */
const newestFirst = [desc(bookingRequests.createdAt)];

/**
 * A vendor row plus the one category the request read model draws.
 *
 * `bookingRequestDetailSchema`'s comment has always said every surface listing
 * requests renders "Photography · Wedding" beside the business name, but the
 * vendor block carried no category, so the bookings hub hardcoded it to null and
 * its category filter had nothing to filter on (#302/#187).
 */
export type VendorSummaryRow = VendorProfileRow & { categoryName: string | null };

/**
 * The vendor's primary category, as a correlated subquery.
 *
 * A join would be the obvious shape and the wrong one: a vendor may hold several
 * categories, so joining multiplies the vendor row and every caller that expects
 * one row per vendor silently starts seeing duplicates. This returns exactly one
 * value per row, or null.
 *
 * "Primary" is the lowest `display_order` among the vendor's **active**
 * categories — the same order the profile and the picker draw them in, so the
 * hub names the category the vendor is listed under rather than an arbitrary one.
 *
 * **Written out rather than interpolated, deliberately.** Drizzle renders a
 * `${table.column}` inside a raw `sql` template as a *bare* name — the first
 * draft of this emitted `JOIN "categories" ON "id" = "category_id"` and
 * `WHERE "vendor_id" = "id"`, so the correlation compared
 * `vendor_categories.vendor_id` to `categories.id`. That is not an error in
 * Postgres, it is merely always false, so every row came back null and only the
 * assertion on a real category name caught it. Aliases here are explicit for the
 * same reason: nothing in this string depends on drizzle guessing a scope.
 */
const primaryCategoryName = sql<string | null>`(
  SELECT c.name
    FROM vendor_categories vc
    JOIN categories c ON c.id = vc.category_id
   WHERE vc.vendor_id = vendor_profiles.id
     AND c.is_active = true
   ORDER BY c.display_order
   LIMIT 1
)`;

/** Every vendor column plus the primary category, for the request read model. */
const vendorSummaryColumns = {
  ...getTableColumns(vendorProfiles),
  categoryName: primaryCategoryName,
};

export async function findRequestById(
  db: AppDatabase,
  requestId: string,
): Promise<BookingRequestRow | null> {
  if (!requestId) {
    return null;
  }

  const rows = await db
    .select()
    .from(bookingRequests)
    .where(eq(bookingRequests.id, requestId))
    .limit(1);

  return rows?.[0] ?? null;
}

export interface RequestListFilter {
  customerId?: string;
  vendorId?: string;
  status?: BookingRequestStatus;
}

export async function findRequests(
  db: AppDatabase,
  filter: RequestListFilter,
): Promise<BookingRequestRow[]> {
  const conditions = [
    filter.customerId ? eq(bookingRequests.customerId, filter.customerId) : undefined,
    filter.vendorId ? eq(bookingRequests.vendorId, filter.vendorId) : undefined,
    filter.status ? eq(bookingRequests.status, filter.status) : undefined,
  ].filter((condition) => condition !== undefined);

  if (conditions.length === 0) {
    return [];
  }

  return db
    .select()
    .from(bookingRequests)
    .where(and(...conditions))
    .orderBy(...newestFirst);
}

/**
 * The natural key the `booking_requests_live_*` indexes are built on. Shaped
 * so a `NewBookingRequestRow` satisfies it, which is what lets the insert and
 * the lookup share one object instead of deriving the key twice.
 */
export interface LiveRequestKey {
  customerId: string;
  vendorId: string;
  eventDate: string;
  /** Absent and null both mean a custom request the vendor must quote. */
  packageId?: string | null;
}

/**
 * The live request a repeat submission would duplicate, if there is one.
 *
 * Mirrors the indexes exactly — same columns, same `pending` predicate, and
 * the same reading of a null `package_id` as a value rather than an unknown.
 */
export async function findLiveRequest(
  db: AppDatabase,
  key: LiveRequestKey,
): Promise<BookingRequestRow | null> {
  const rows = await db
    .select()
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.customerId, key.customerId),
        eq(bookingRequests.vendorId, key.vendorId),
        eq(bookingRequests.eventDate, key.eventDate),
        key.packageId === null || key.packageId === undefined
          ? isNull(bookingRequests.packageId)
          : eq(bookingRequests.packageId, key.packageId),
        inArray(bookingRequests.status, [...LIVE_BOOKING_REQUEST_STATUSES]),
      ),
    )
    .limit(1);

  return rows?.[0] ?? null;
}

/** The live-request predicate, shared by the two indexes and this module. */
const stillLive = sql`${bookingRequests.status} in ('pending', 'quoted')`;

/**
 * Which of the two partial unique indexes governs a request.
 *
 * `ON CONFLICT` admits one arbiter, and there are two indexes — but never two
 * that apply, because they are partitioned on whether `package_id` is null.
 * The option is `where`, not the `targetWhere` that belongs to `DO UPDATE`;
 * pass the wrong one and drizzle emits `on conflict (...) do nothing` with no
 * predicate, which matches neither partial index and fails with 42P10.
 */
function liveRequestArbiter(packageId: string | null | undefined) {
  return packageId === null || packageId === undefined
    ? {
        target: [bookingRequests.customerId, bookingRequests.vendorId, bookingRequests.eventDate],
        where: sql`${stillLive} and ${bookingRequests.packageId} is null`,
      }
    : {
        target: [
          bookingRequests.customerId,
          bookingRequests.vendorId,
          bookingRequests.eventDate,
          bookingRequests.packageId,
        ],
        where: sql`${stillLive} and ${bookingRequests.packageId} is not null`,
      };
}

/**
 * Inserts, or returns `null` when a live request already holds the natural
 * key. The database is the arbiter, so two simultaneous submissions cannot
 * both win however their reads interleave — a read-then-insert in the service
 * could only narrow that window, never close it.
 *
 * The conflict names its index, like `ensureConversation` below, so a future
 * constraint on this table raises rather than being read as a repeat
 * submission.
 */
export async function insertRequest(
  db: AppDatabase,
  values: NewBookingRequestRow,
): Promise<BookingRequestRow | null> {
  const inserted = await db
    .insert(bookingRequests)
    .values(values)
    .onConflictDoNothing(liveRequestArbiter(values.packageId))
    .returning();

  return inserted?.[0] ?? null;
}

/**
 * Applies a transition, but only from the status the caller read.
 *
 * The `status` predicate is the concurrency guard: two vendors' tabs, or a
 * decline racing the lazy expiry sweep, both read `pending` and both try to
 * write. The second update matches no row and returns `null`, which the
 * service reports as an invalid transition rather than silently overwriting a
 * decision that was already made.
 */
export async function applyTransition(
  db: AppDatabase,
  requestId: string,
  from: BookingRequestStatus,
  patch: Partial<NewBookingRequestRow>,
): Promise<BookingRequestRow | null> {
  const updated = await db
    .update(bookingRequests)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(bookingRequests.id, requestId), eq(bookingRequests.status, from)))
    .returning();

  return updated?.[0] ?? null;
}

/** The vendor profile a request points at, whatever its publication state. */
export async function findVendorById(
  db: AppDatabase,
  vendorId: string,
): Promise<VendorSummaryRow | null> {
  if (!vendorId) {
    return null;
  }

  const rows = await db
    .select(vendorSummaryColumns)
    .from(vendorProfiles)
    .where(eq(vendorProfiles.id, vendorId))
    .limit(1);

  return rows?.[0] ?? null;
}

export async function findVendorsByIds(
  db: AppDatabase,
  vendorIds: readonly string[],
): Promise<VendorSummaryRow[]> {
  if (vendorIds.length === 0) {
    return [];
  }

  return db
    .select(vendorSummaryColumns)
    .from(vendorProfiles)
    .where(inArray(vendorProfiles.id, [...vendorIds]));
}

/** The vendor profile owned by this user, for scoping a vendor's own queue. */
export async function findVendorByUserId(
  db: AppDatabase,
  userId: string,
): Promise<VendorProfileRow | null> {
  if (!userId) {
    return null;
  }

  const rows = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, userId))
    .limit(1);

  return rows?.[0] ?? null;
}

export async function findActivePackage(
  db: AppDatabase,
  vendorId: string,
  packageId: string,
): Promise<ServicePackageRow | null> {
  if (!vendorId || !packageId) {
    return null;
  }

  const rows = await db
    .select()
    .from(servicePackages)
    .where(
      and(
        eq(servicePackages.id, packageId),
        eq(servicePackages.vendorId, vendorId),
        eq(servicePackages.isActive, true),
      ),
    )
    .limit(1);

  return rows?.[0] ?? null;
}

export async function findPackagesByIds(
  db: AppDatabase,
  packageIds: readonly string[],
): Promise<ServicePackageRow[]> {
  if (packageIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(servicePackages)
    .where(inArray(servicePackages.id, [...packageIds]));
}

/**
 * The calendar row for one date, or `null` when there is none — and the
 * calendar's convention is that no row means free.
 */
export async function findAvailabilityOn(
  db: AppDatabase,
  vendorId: string,
  date: string,
): Promise<AvailabilityRow | null> {
  if (!vendorId || !date) {
    return null;
  }

  const rows = await db
    .select()
    .from(availability)
    .where(and(eq(availability.vendorId, vendorId), eq(availability.date, date)))
    .limit(1);

  return rows?.[0] ?? null;
}

/** Every request status this vendor holds on one date, live or settled. */
export async function statusesOnDate(
  db: AppDatabase,
  vendorId: string,
  date: string,
): Promise<BookingRequestStatus[]> {
  const rows = await db
    .select({ status: bookingRequests.status })
    .from(bookingRequests)
    .where(and(eq(bookingRequests.vendorId, vendorId), eq(bookingRequests.eventDate, date)));

  return rows.map((row) => row.status);
}

/**
 * Marks the date `booked`, or clears the row the request lifecycle wrote.
 *
 * `booked` is the only status the lifecycle stores: `available` and `blocked`
 * are the vendor's own, and a live request stores nothing at all (see
 * `syncHeldDate`). An accept does overwrite a `blocked` row, because it is an
 * explicit commitment the vendor has just made and it outranks a stale block
 * of their own.
 *
 * Clearing is narrow in two directions. It leaves `blocked` alone, so a vendor
 * who held a day for themselves keeps it after declining the request that
 * asked for it. And it refuses to delete a date backed by a real `bookings`
 * row: #10 turns payment into one of those, and a later request on the same
 * date being declined must not quietly free a date somebody has paid for.
 */
export async function setHeldDate(
  db: AppDatabase,
  vendorId: string,
  date: string,
  status: 'booked' | null,
): Promise<void> {
  if (status === null) {
    await db.delete(availability).where(
      and(
        eq(availability.vendorId, vendorId),
        eq(availability.date, date),
        inArray(availability.status, ['booked', 'pending']),
        sql`not exists (
          select 1 from ${bookings}
          where ${bookings.vendorId} = ${vendorId}
            and ${bookings.eventDate} = ${date}
        )`,
      ),
    );
    return;
  }

  await db
    .insert(availability)
    .values({ vendorId, date, status })
    .onConflictDoUpdate({
      target: [availability.vendorId, availability.date],
      set: { status },
    });
}

/**
 * The conversation this request is negotiated in, created with it.
 *
 * One thread per request, because the context rail's actions — send a revised
 * quote, accept as-is, decline — act on exactly one. Idempotent on the request
 * id, so a retry after a half-finished attempt reuses the thread rather than
 * opening a second one beside it.
 */
export async function ensureConversation(
  db: AppDatabase,
  values: { customerId: string; vendorId: string; bookingRequestId: string },
): Promise<void> {
  await db
    .insert(conversations)
    .values(values)
    .onConflictDoNothing({ target: conversations.bookingRequestId });
}

/** The `users.id` behind a vendor profile — notifications address people. */
export async function findVendorUserId(db: AppDatabase, vendorId: string): Promise<string | null> {
  const rows = await db
    .select({ userId: vendorProfiles.userId })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.id, vendorId))
    .limit(1);

  return rows?.[0]?.userId ?? null;
}

export interface BookingWithContextRow {
  booking: typeof bookings.$inferSelect;
  eventType: string | null;
}

/**
 * Bookings with the occasion the hub renders beside them. `event_type` lives on
 * the request, not the booking, so the join is what makes
 * "Photography · Wedding" possible without a second round trip per row.
 */
export async function findBookings(
  db: AppDatabase,
  filter: { customerId?: string; vendorId?: string },
): Promise<BookingWithContextRow[]> {
  const conditions = [
    filter.customerId ? eq(bookings.customerId, filter.customerId) : undefined,
    filter.vendorId ? eq(bookings.vendorId, filter.vendorId) : undefined,
  ].filter((condition) => condition !== undefined);

  if (conditions.length === 0) {
    return [];
  }

  return db
    .select({ booking: bookings, eventType: bookingRequests.eventType })
    .from(bookings)
    .innerJoin(bookingRequests, eq(bookings.requestId, bookingRequests.id))
    .where(and(...conditions))
    .orderBy(desc(bookings.eventDate));
}

/**
 * The sender's identity, for the vendor's request queue.
 *
 * Selects the contact columns as well as the name, because the caller cannot
 * know whether to disclose them until it has the request's status beside the
 * row. Narrowing happens in `toDetail`, which is the single place that reads
 * `disclosesCustomerContact` — projecting conditionally here would put the
 * privacy rule in two places.
 */
export async function findCustomerNames(
  db: AppDatabase,
  customerIds: readonly string[],
): Promise<CustomerIdentityRow[]> {
  if (customerIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(inArray(users.id, [...customerIds]));
}

export interface CustomerIdentityRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

/** Whether a user row exists — guards a notification insert against a stale id. */
export async function userExists(db: AppDatabase, userId: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);

  return rows.length > 0;
}
