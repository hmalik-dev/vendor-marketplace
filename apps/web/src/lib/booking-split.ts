import { isUniversallyPastDate } from '@vendor-marketplace/shared';

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
