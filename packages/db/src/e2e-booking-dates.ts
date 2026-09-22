import { addDays, toDateString } from '@vendor-marketplace/shared';
import { and, eq, gte, lte, ne } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { availability, bookingRequests, bookings, vendorProfiles } from './schema/index.js';

/**
 * Test-only date control for the paid booking journey (`apps/web/e2e/paid-booking.spec.ts`).
 *
 * Reachable only through `pnpm --filter @vendor-marketplace/db e2e:dates`,
 * which refuses a production target exactly as `seed:e2e` does. There is
 * deliberately no API route for either operation: moving a paid booking's
 * event into the past is a write no deployed surface may be able to make.
 */

type AnyPgDatabase = PgDatabase<PgQueryResultHKT, Record<string, unknown>, TablesRelationalConfig>;

/**
 * Where the fresh-date window opens.
 *
 * Past `seed:e2e`'s own request, which lands 45 days out and may step up to 60
 * further to dodge a clash, so a journey never races the seeded row for a day.
 * It is also far beyond the 48-hour full-refund cutoff (D3), which the refund
 * scenario asserts.
 */
const FRESH_WINDOW_START_DAYS = 120;

/** How many days the window spans; inside the 24-month booking horizon. */
const FRESH_WINDOW_SPAN_DAYS = 240;

/**
 * Yesterday in UTC — the latest date both completion guards accept.
 *
 * `completeBooking` refuses a date still in the future anywhere on Earth and
 * `CompleteBooking` hides its button until the browser's own day has reached
 * it; yesterday in UTC is behind every timezone's today. It is also the
 * *earliest* safe choice for money: the payout sweep releases 72 hours after
 * the event day starts (D35), so a date two or more days older would hand the
 * booking to a real transfer mid-test.
 */
const PAST_EVENT_OFFSET_DAYS = -1;

export interface FreshEventDateOptions {
  vendorSlug: string;
  now: Date;
  /** Chooses among the free dates; random in the CLI so reruns spread out. */
  pick: (dates: readonly string[]) => string;
}

/**
 * A date the vendor holds nothing on and no request names.
 *
 * `seed:e2e` tops up rather than resets, so every run's bookings stay in the
 * lane database. A fixed or computed date would be booked by the first run and
 * refused (409) on the second.
 */
export async function freshEventDate(
  db: AnyPgDatabase,
  options: FreshEventDateOptions,
): Promise<string> {
  const [vendor] = await db
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(and(eq(vendorProfiles.slug, options.vendorSlug), eq(vendorProfiles.isDeleted, false)))
    .limit(1);

  if (!vendor) {
    throw new Error(`No live vendor profile has the slug ${options.vendorSlug}`);
  }

  const first = toDateString(addDays(options.now, FRESH_WINDOW_START_DAYS));
  const last = toDateString(addDays(options.now, FRESH_WINDOW_START_DAYS + FRESH_WINDOW_SPAN_DAYS));

  const [held, requested] = await Promise.all([
    db
      .select({ date: availability.date })
      .from(availability)
      .where(
        and(
          eq(availability.vendorId, vendor.id),
          ne(availability.status, 'available'),
          gte(availability.date, first),
          lte(availability.date, last),
        ),
      ),
    db
      .select({ date: bookingRequests.eventDate })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.vendorId, vendor.id),
          gte(bookingRequests.eventDate, first),
          lte(bookingRequests.eventDate, last),
        ),
      ),
  ]);

  const taken = new Set([...held, ...requested].map((row) => row.date));
  const free: string[] = [];

  for (let offset = 0; offset <= FRESH_WINDOW_SPAN_DAYS; offset += 1) {
    const candidate = toDateString(addDays(options.now, FRESH_WINDOW_START_DAYS + offset));

    if (!taken.has(candidate)) {
      free.push(candidate);
    }
  }

  if (free.length === 0) {
    throw new Error(
      `${options.vendorSlug} has no free date between ${first} and ${last} — ` +
        'recreate the lane database (lane:down, lane:up)',
    );
  }

  return options.pick(free);
}

/**
 * Moves an earlier run's completed booking off the day this one is about to take.
 *
 * `booking_requests_accepted_date_key` (VEN-482) holds one *accepted* request per
 * vendor per day for good — a completed booking frees its own confirmed-date
 * index, but its request stays accepted. Every run shifts onto the same
 * yesterday, so on a database an earlier run already used the second shift died
 * on that index, contradicting `e2e/README.md`'s "a second run is the ordinary
 * case". The earlier run's request and booking go back to the nearest day with
 * no accepted request, which is only ever older than yesterday.
 */
async function displaceEarlierRuns(
  tx: AnyPgDatabase,
  target: { vendorId: string; eventDate: string; requestId: string },
): Promise<void> {
  const occupied = await tx
    .select({ id: bookingRequests.id })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.vendorId, target.vendorId),
        eq(bookingRequests.eventDate, target.eventDate),
        eq(bookingRequests.status, 'accepted'),
        ne(bookingRequests.id, target.requestId),
      ),
    );

  if (occupied.length === 0) {
    return;
  }

  const acceptedDates = new Set(
    (
      await tx
        .select({ eventDate: bookingRequests.eventDate })
        .from(bookingRequests)
        .where(
          and(
            eq(bookingRequests.vendorId, target.vendorId),
            eq(bookingRequests.status, 'accepted'),
          ),
        )
    ).map((row) => row.eventDate),
  );
  let cursor = target.eventDate;
  // Two days back is the oldest day still inside the payout-release window (see
  // `PAST_EVENT_OFFSET_DAYS`); anything older would be handed to a real transfer.
  const floor = toDateString(addDays(new Date(`${target.eventDate}T00:00:00.000Z`), -1));

  for (const { id } of occupied) {
    do {
      cursor = toDateString(addDays(new Date(`${cursor}T00:00:00.000Z`), -1));
    } while (acceptedDates.has(cursor) && cursor > floor);

    if (acceptedDates.has(cursor)) {
      throw new Error(
        `no free day for an earlier run's booking on ${target.vendorId} — recreate the lane database (lane:down, lane:up)`,
      );
    }

    acceptedDates.add(cursor);
    await tx.update(bookingRequests).set({ eventDate: cursor }).where(eq(bookingRequests.id, id));
    await tx.update(bookings).set({ eventDate: cursor }).where(eq(bookings.requestId, id));
  }
}

export interface ShiftBookingOptions {
  bookingId: string;
  now: Date;
}

/**
 * Moves a booking's event to yesterday, so the vendor can mark it complete.
 *
 * All three copies of the date move together — the booking, the request it came
 * from, and the vendor's held day — because the screens read each of them: the
 * vendor's bookings page splits past from upcoming on the request's date, and a
 * held future day left behind would block that date for every later run.
 */
export async function shiftBookingIntoPast(
  db: AnyPgDatabase,
  options: ShiftBookingOptions,
): Promise<{ eventDate: string }> {
  const eventDate = toDateString(addDays(options.now, PAST_EVENT_OFFSET_DAYS));

  return db.transaction(async (tx) => {
    const [booking] = await tx
      .select({
        requestId: bookings.requestId,
        vendorId: bookings.vendorId,
        eventDate: bookings.eventDate,
      })
      .from(bookings)
      .where(eq(bookings.id, options.bookingId))
      .limit(1);

    if (!booking) {
      throw new Error(`No booking ${options.bookingId}`);
    }

    await displaceEarlierRuns(tx, {
      vendorId: booking.vendorId,
      eventDate,
      requestId: booking.requestId,
    });
    await tx.update(bookings).set({ eventDate }).where(eq(bookings.id, options.bookingId));
    await tx
      .update(bookingRequests)
      .set({ eventDate })
      .where(eq(bookingRequests.id, booking.requestId));
    await tx
      .delete(availability)
      .where(
        and(eq(availability.vendorId, booking.vendorId), eq(availability.date, booking.eventDate)),
      );
    await tx
      .insert(availability)
      .values({ vendorId: booking.vendorId, date: eventDate, status: 'booked' })
      .onConflictDoUpdate({
        target: [availability.vendorId, availability.date],
        set: { status: 'booked' },
      });

    return { eventDate };
  });
}
