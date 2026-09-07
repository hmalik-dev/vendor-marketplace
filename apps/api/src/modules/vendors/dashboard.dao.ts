import { and, asc, eq, gte, inArray, lt, notInArray, sql } from 'drizzle-orm';
import {
  availability,
  bookingRequests,
  bookings,
  users,
  vendorCategories,
} from '@vendor-marketplace/db/schema';
import {
  HELD_PAYOUT_STATUSES,
  type AvailabilityStatus,
  type BookingStatus,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { RELEASABLE_STATUSES, payoutOwedClauses } from '../payments/payouts.dao.js';

/**
 * A booking that was paid for and kept — the shape both dashboard figures
 * count, and the reason they agree with each other.
 *
 * `cancelled` is excluded because a cancellation now actually unwinds: under
 * D31 the refund reverses the vendor's transfer back out of their connected
 * account, so a cancelled booking is money they no longer have. Before #416 no
 * paid booking could reach `cancelled` at all — every refund 400'd at Stripe
 * and the row never moved — so these two queries were right by accident. They
 * are not any more.
 *
 * `admin.dao.ts`'s `PAID_AND_KEPT` says the same thing for the operator's
 * revenue figure, and `owedPayout` below filters for the same reason.
 * The vendor's own two numbers were the pair left unguarded.
 */
const NOT_CANCELLED = sql`${bookings.status} <> 'cancelled'`;

/** Bookings whose event falls inside `[from, to)`, cancellations excluded. */
export async function countBookingsBetween(
  db: AppDatabase,
  vendorId: string,
  from: string,
  to: string,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        gte(bookings.eventDate, from),
        lt(bookings.eventDate, to),
        NOT_CANCELLED,
      ),
    );

  return rows?.[0]?.total ?? 0;
}

/**
 * What the vendor actually keeps this month — their payout share, not the
 * gross the customer paid, which includes the platform fee.
 *
 * Counted on `paid_at` rather than the event date: money that has arrived is
 * this month's earnings even when the event is next year.
 *
 * Net of cancellations. A booking the customer cancelled had its transfer
 * reversed (D31), so leaving it in would tell the vendor they earned money
 * that has been taken back out of their balance — on the one screen they check
 * to see what they are owed.
 */
export async function sumPayoutsBetween(
  db: AppDatabase,
  vendorId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${bookings.vendorPayoutCents}), 0)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        gte(bookings.paidAt, from),
        lt(bookings.paidAt, to),
        NOT_CANCELLED,
      ),
    );

  return rows?.[0]?.total ?? 0;
}

export interface ResponseCounts {
  /** Requests the vendor was given a chance to answer. */
  offered: number;
  /** Those they actually answered — anything that left `pending` by their hand. */
  answered: number;
}

/**
 * The response rate's two halves.
 *
 * A request the **customer** withdrew is excluded from both: the vendor was
 * never given the chance, and counting it against them would punish them for
 * somebody else's change of mind. An expired one *is* counted as offered and
 * not answered, because that is exactly the failure the rate measures.
 */
export async function countResponses(
  db: AppDatabase,
  vendorId: string,
  since: Date,
): Promise<ResponseCounts> {
  const rows = await db
    .select({ status: bookingRequests.status, total: sql<number>`count(*)::int` })
    .from(bookingRequests)
    .where(and(eq(bookingRequests.vendorId, vendorId), gte(bookingRequests.createdAt, since)))
    .groupBy(bookingRequests.status);

  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.total]));
  const answered = (byStatus.quoted ?? 0) + (byStatus.accepted ?? 0) + (byStatus.declined ?? 0);
  const unanswered = (byStatus.pending ?? 0) + (byStatus.expired ?? 0);

  return { offered: answered + unanswered, answered };
}

export async function countPendingRequests(db: AppDatabase, vendorId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookingRequests)
    .where(and(eq(bookingRequests.vendorId, vendorId), eq(bookingRequests.status, 'pending')));

  return rows?.[0]?.total ?? 0;
}

export interface CalendarDayRow {
  date: string;
  status: AvailabilityStatus;
}

/**
 * The vendor's calendar rows inside `[from, to)`.
 *
 * The calendar is **sparse** — an absent row means available — so this returns
 * only the days somebody has said something about, and the caller fills the
 * gaps. Reading `availability` rather than re-deriving from `bookings` is what
 * keeps the dashboard strip and the availability screen from disagreeing: the
 * booking lifecycle writes `booked` and `pending` here, and the vendor writes
 * `blocked` here.
 */
export async function findCalendarBetween(
  db: AppDatabase,
  vendorId: string,
  from: string,
  to: string,
): Promise<CalendarDayRow[]> {
  return db
    .select({ date: availability.date, status: availability.status })
    .from(availability)
    .where(
      and(
        eq(availability.vendorId, vendorId),
        gte(availability.date, from),
        lt(availability.date, to),
      ),
    );
}

/**
 * The statuses a vendor can still be owed money under — **the release sweep's
 * own list, plus the hold it excludes**.
 *
 * Both halves are spread from their owners rather than re-spelled here.
 * `RELEASABLE_STATUSES` belongs to the sweep and `HELD_PAYOUT_STATUSES` to
 * `payoutStatusOf`, so a status added to either reaches this selection in the
 * same edit. That matters more for the held half than it looks: a hold status
 * the classifier knows and this query does not would drop those rows out of
 * the vendor's owed figure altogether — the money would stop being mentioned,
 * which is worse than being mislabelled.
 */
const OWED_PAYOUT_STATUSES = [...RELEASABLE_STATUSES, ...HELD_PAYOUT_STATUSES];

/**
 * `findDuePayoutBookingIds`'s predicate, scoped to one vendor and without its
 * date bound.
 *
 * The three clauses that decide whether money is owed come from
 * `payoutOwedClauses` in the module that owns them, so this is a composition of
 * the sweep's predicate rather than a fourth transcription of it. That is what
 * makes #424 acceptance 7 structural instead of a promise: the dashboard cannot
 * come to name a different set of rows than the transfer does.
 *
 * The date bound is the one clause deliberately dropped: a payout whose window
 * has not closed is still owed, and is precisely the one a vendor opens this
 * screen to see.
 */
function owedPayout(vendorId: string) {
  return and(
    eq(bookings.vendorId, vendorId),
    inArray(bookings.status, OWED_PAYOUT_STATUSES),
    ...payoutOwedClauses(),
  );
}

export interface OwedPayoutTotalRow {
  status: BookingStatus;
  cents: number;
  count: number;
  /** Earliest event date in this group — the input to `payoutReleaseAt`. */
  earliestEventDate: string;
}

/**
 * What the vendor is owed, summed per booking status.
 *
 * **Per status rather than pre-split into pending and held.** Deciding which of
 * those a row is in belongs to `payoutStatusOf` and nowhere else: a
 * `status = 'disputed'` test written into this SQL would be a second copy of
 * the inference #423 acceptance 16 exists to prevent, and the copy a future
 * status would be missed in.
 *
 * Aggregated in the database rather than by reading the rows — a vendor's owed
 * set has no upper bound and the dashboard wants four numbers off it.
 *
 * **`bookings_payout_due_idx` does not serve this**, despite matching every
 * clause but one: it is keyed on `event_date` with no `vendor_id`, because the
 * sweep scans due payouts across the whole platform. This query is served by
 * `bookings_vendor_idx` with the payout clauses applied as a heap filter, which
 * is the right shape here — the scan is bounded by one vendor's lifetime
 * bookings, not by the platform's. A vendor-leading partial index would be the
 * fix if that ever stops being small; it is not worth a migration today.
 *
 * `::int` on the sum matches `sumPayoutsBetween` above and carries the same
 * ceiling: int4 overflows at ~$21.4M, which one vendor reaches only with a few
 * hundred simultaneously unreleased bookings at the maximum package price. The
 * failure would be a 500 rather than a wrong figure, and every such row needs a
 * settled Stripe charge behind it, so it is not a state a caller can provoke.
 * Widening it is a change to both figures or neither.
 *
 * `min(event_date)::text` casts explicitly. `event_date` is a `DATE`, and
 * outside a Drizzle column the driver's own parser hands back a `Date` built in
 * the process's local zone — a value a day out for half the planet, on the
 * input to a money date. #409 is the precedent.
 */
export async function findOwedPayoutTotals(
  db: AppDatabase,
  vendorId: string,
): Promise<OwedPayoutTotalRow[]> {
  return db
    .select({
      status: bookings.status,
      cents: sql<number>`coalesce(sum(${bookings.vendorPayoutCents}), 0)::int`,
      count: sql<number>`count(*)::int`,
      earliestEventDate: sql<string>`min(${bookings.eventDate})::text`,
    })
    .from(bookings)
    .where(owedPayout(vendorId))
    .groupBy(bookings.status);
}

export interface NextPendingPayoutRow {
  eventDate: string;
  customerFirstName: string;
  vendorPayoutCents: number;
}

/**
 * The soonest payout this vendor is **pending** on — the earliest event whose
 * money has not been transferred and is not held.
 *
 * **Three things about the predicate changed with #423**, and each was a claim
 * that stopped being true when the release moved off the destination charge.
 *
 * `completed` is included. It used to be excluded because "a `completed`
 * booking has already paid out" — true of a destination charge, where Stripe
 * split the money as the card succeeded. It is now false: the vendor marking a
 * booking complete moves no money, so a completed booking still inside its
 * payout window is precisely a payout that is owed, and omitting it would show
 * a vendor nothing where they are due a transfer.
 *
 * The event-date floor is gone. Whether a payout has been sent is
 * `payout_released_at`, not whether the event is in the future — a booking whose
 * event was last week and whose window has not closed is the *most* imminent
 * payout there is, and a date floor hid exactly those.
 *
 * **`cancelled` stopped being excluded with D37**, a reversal of what this
 * comment said one ticket ago and worth stating as one. The exclusion read
 * "that money is not coming, and naming it would overstate what is owed".
 * `vendor_payout_cents` no longer means what was agreed; it means what is still
 * owed, and a cancellation inside D3's cutoff rewrites it down to the share the
 * vendor keeps for a date they held and lost (D31). The sweep pays that share
 * on the original schedule, so omitting it now *understates* what is owed and
 * hides a real transfer. A full refund writes `0` and is excluded by
 * `vendor_payout_cents > 0` — by the amount, which is the claim being made,
 * rather than by the status, which is not.
 *
 * **`disputed` is the one exclusion, and that is #424's change.** #423 included
 * it here so the card could say the money was held, carrying a `status` for the
 * surface to read. The card now reports held money as its own figure out of
 * `findOwedPayoutTotals`, so what this row has to be is the payout that is
 * actually next — a held booking with an earlier event has no release date and
 * cannot be it. `notInArray` over `HELD_PAYOUT_STATUSES` rather than a literal,
 * so this and `payoutStatusOf` cannot come to disagree about what a hold is.
 *
 * Everything else is `owedPayout`'s, so this row and the summed figure beside
 * it cannot come from different sets.
 */
export async function findNextPendingPayout(
  db: AppDatabase,
  vendorId: string,
): Promise<NextPendingPayoutRow | null> {
  const rows = await db
    .select({
      eventDate: bookings.eventDate,
      customerFirstName: users.firstName,
      vendorPayoutCents: bookings.vendorPayoutCents,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(and(owedPayout(vendorId), notInArray(bookings.status, [...HELD_PAYOUT_STATUSES])))
    .orderBy(asc(bookings.eventDate))
    .limit(1);

  return rows[0] ?? null;
}

export async function findCategoryIds(db: AppDatabase, vendorId: string): Promise<string[]> {
  const rows = await db
    .select({ categoryId: vendorCategories.categoryId })
    .from(vendorCategories)
    .where(eq(vendorCategories.vendorId, vendorId));

  return rows.map((row) => row.categoryId);
}
