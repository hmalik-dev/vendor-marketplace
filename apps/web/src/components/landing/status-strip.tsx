'use client';

import Link from 'next/link';
import { daysUntil, formatCardDate } from '@/lib/booking-entries';
import type { LandingStatus } from '@/lib/landing-status';
import { useViewerToday } from '@/lib/use-viewer-today';

/**
 * "in 49 days", "tomorrow", "today" — how far off the next booking is.
 *
 * Whole days, and the nearest one said in words: a strip that reads "in 0 days"
 * about this evening is arithmetic rather than English.
 *
 * A day count of zero is the floor this can be asked about — `isStillAhead`
 * below is what keeps a negative one from reaching it.
 */
function countdown(days: number): string {
  if (days === 0) {
    return 'today';
  }

  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

/**
 * Whether the booking is still ahead **on the reader's own day**.
 *
 * The server cannot know that day, so `landingStatus` filters on the widest
 * honest boundary — `isUniversallyPastDate`, which deliberately keeps
 * yesterday's row, because west of UTC yesterday is still today. That is the
 * right call there and the wrong answer to show: re-anchored on the viewer's
 * clock the same row can be one or two days behind them, and the strip said
 * *"Sat, Apr 25 · today"* about it.
 *
 * It also disagreed with the page it links to. `/bookings` splits upcoming from
 * history with `daysUntil(eventDate, today) >= 0` against the viewer's day
 * (`booking-entries.ts`), so the landing announced a "next up" booking that the
 * hub one click away filed under history. **The same predicate as the hub**, so
 * the two cannot say different things about one row.
 */
function isStillAhead(days: number): boolean {
  return days >= 0;
}

/**
 * The 60px strip between the header and the hero, for a signed-in customer.
 *
 * **Colour is a signal here, the same as everywhere else in the product**
 * (`40-states.md`): sage means settled, so it marks the booking that is
 * confirmed; gold means waiting on someone, so it marks the requests a vendor
 * still has not answered. Neither is decoration and neither is repeated.
 *
 * The caller renders nothing at all when both items are absent — see
 * `hasStatusStrip`. This component never draws an empty bar either, because a
 * 60px band of chrome saying nothing is worse than the hero starting 60px
 * higher, and it is the one that has the last word: the booking can drop out
 * *here* when the reader's own day has passed it, leaving a strip the server
 * thought had something in it.
 *
 * A Client Component for one reason: the reader's day, which the server cannot
 * know (#409), decides both the countdown and whether the booking is still
 * ahead at all. `serverToday` seeds the first paint so hydration matches, and
 * `useViewerToday` re-anchors after mount. Everything else here is static.
 */
export function StatusStrip({
  status,
  serverToday,
}: {
  status: LandingStatus;
  /** The server's UTC day, from `toDateString(new Date())`. */
  serverToday: string;
}): React.ReactElement | null {
  const today = useViewerToday(serverToday);
  const { next, requestsWaitingOnVendor } = status;

  const days = next === null ? null : daysUntil(next.eventDate, today);
  const booking = next !== null && days !== null && isStillAhead(days) ? next : null;

  if (booking === null && requestsWaitingOnVendor === 0) {
    return null;
  }

  return (
    <section
      aria-label="Your bookings at a glance"
      className="border-b border-stone-300 bg-stone-100"
    >
      {/*
        The page gutter ladder, matching `page.tsx` — the strip is full-bleed
        and its contents line up with the hero beneath it.
      */}
      <div className="mx-auto flex min-h-15 w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-2.5 lg:px-7 min-[90rem]:px-10">
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
          {booking === null ? null : (
            <li className="flex items-center gap-2.25">
              <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-sage-350" />
              <span className="text-base text-stone-800">
                Next up — <strong className="font-semibold">{booking.vendorName}</strong>,{' '}
                {formatCardDate(booking.eventDate)} · {countdown(days ?? 0)}
              </span>
            </li>
          )}

          {requestsWaitingOnVendor === 0 ? null : (
            <li className="flex items-center gap-2.25 max-sm:w-full">
              {/*
                The 20px rule the frame draws between the two items, which only
                exists when there are two of them to separate.
              */}
              {booking === null ? null : (
                <span aria-hidden="true" className="-ml-3 h-5 w-px bg-stone-300 max-sm:hidden" />
              )}
              {/*
                `gold-400` rather than the frame's `#C08A21`. They are one
                channel apart, the palette already owns "gold, the colour", and
                `40-states.md`'s law is the *meaning* — a fourth gold step half
                a percent from the third would be palette sprawl. The sage dot
                did need its own step; the difference there is 20%.
              */}
              <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-gold-400" />
              <span className="text-base text-stone-800">
                {requestsWaitingOnVendor === 1
                  ? '1 request waiting on a vendor'
                  : `${requestsWaitingOnVendor} requests waiting on a vendor`}
              </span>
            </li>
          )}
        </ul>

        <Link
          href="/bookings"
          className="text-action font-semibold text-clay-500 underline-offset-4 transition-colors duration-(--duration-fast) hover:underline"
        >
          All bookings →
        </Link>
      </div>
    </section>
  );
}
