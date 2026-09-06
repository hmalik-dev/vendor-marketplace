import { isUniversallyPastDate, type BookingRequestDetail } from '@vendor-marketplace/shared';

/** Anything carrying the calendar date a booking is for. */
interface Dated {
  readonly eventDate: string;
}

export interface BookingSplit<T extends Dated> {
  /** Soonest first — the next thing the vendor has to turn up to. */
  readonly upcoming: readonly T[];
  /** Most recent first: the further back it is, the less it is wanted. */
  readonly past: readonly T[];
}

/**
 * Split accepted work into what is still ahead and what is behind.
 *
 * **The boundary is `isUniversallyPastDate`, not the server's own day** (#409).
 * This runs on the server, which cannot know the vendor's day: west of UTC they
 * are a day behind it, so the plain UTC day filed this evening's booking under
 * `Past events` — beside a `Mark complete` control that, being client-rendered
 * and anchored on the vendor's own clock, correctly refused to let them close a
 * job they had not done yet. One page saying both things about one booking.
 *
 * Widening it leaves a milder residue in the other direction: east of UTC a job
 * delivered a few hours ago stays under `Upcoming` until the day is over
 * everywhere. That is the right way round to be wrong — the booking is listed
 * where the vendor is looking, still actionable, and not described as history
 * before it is.
 *
 * Extracted from the page so the boundary has somewhere to be tested. Inline it
 * was a filter pair no test could reach without rendering the whole route.
 */
export function splitByEventDate<T extends Dated>(
  entries: readonly T[],
  now: Date = new Date(),
): BookingSplit<T> {
  const upcoming = entries
    .filter((entry) => !isUniversallyPastDate(entry.eventDate, now))
    .toSorted((left, right) => left.eventDate.localeCompare(right.eventDate));
  const past = entries
    .filter((entry) => isUniversallyPastDate(entry.eventDate, now))
    .toSorted((left, right) => right.eventDate.localeCompare(left.eventDate));

  return { upcoming, past };
}

/** The two fields that say whether a request lost a booking. */
type Settled = Pick<BookingRequestDetail, 'status' | 'settlement'>;

/**
 * The bookings a vendor lost (#415).
 *
 * `/vendor/bookings` filters `status === 'accepted'` for both its lists, which
 * is right for the "coming up" count — a settled request is not a date the
 * vendor still holds — and meant a cancelled booking appeared nowhere on the
 * vendor side at all. They got a notification and a freed calendar cell, and
 * that was the whole record of a date they had committed to and lost.
 *
 * A **cancelled request that produced a booking**, which is the distinction
 * that keeps this list honest: a customer withdrawing before acceptance never
 * cost the vendor a date, and listing it here as something lost would be the
 * mirror of the defect this fixes.
 */
export function lostBookings<T extends Settled>(requests: readonly T[]): readonly T[] {
  return requests.filter(
    (request) => request.status === 'cancelled' && request.settlement !== null,
  );
}
