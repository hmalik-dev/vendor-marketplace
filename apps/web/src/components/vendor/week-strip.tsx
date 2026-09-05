'use client';

import { BOOKING_WEEK_DAYS, type AvailabilityStatus } from '@vendor-marketplace/shared';
import { useViewerToday } from '@/lib/use-viewer-today';
import type { WireVendorDashboard } from '@/lib/wire-schemas';

const CELL_DAY = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });
const CELL_NAME = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

interface DayTone {
  /** The word inside the cell. Status is never colour alone. */
  label: string;
  cell: string;
  number: string;
  caption: string;
}

/**
 * One tone per calendar status, in the availability vocabulary rather than a
 * parallel one — the strip and the availability screen read the same rows, so
 * they have to name them the same way.
 *
 * Frame `27 Vendor dashboard — 1024` draws only `Open` and `Booked`, because
 * that is the state its example vendor is in. The other three are real states
 * the calendar can be in on any of these seven days, and rendering a held or
 * blocked date as `Open` would be the strip telling the vendor they are free on
 * a day they are not.
 */
const TONES: Record<AvailabilityStatus, DayTone> = {
  available: {
    label: 'Open',
    cell: 'bg-stone-150 border-stone-300',
    number: 'text-stone-700',
    caption: 'text-stone-600',
  },
  booked: {
    label: 'Booked',
    cell: 'bg-sage-50 border-sage-300',
    number: 'text-sage-600',
    caption: 'text-sage-600',
  },
  /* A request is holding the date — gold, because it is waiting on the vendor. */
  pending: {
    label: 'Held',
    cell: 'bg-gold-50 border-gold-300',
    number: 'text-gold-600',
    caption: 'text-gold-600',
  },
  blocked: {
    label: 'Blocked',
    cell: 'bg-stone-100 border-stone-400',
    number: 'text-stone-600',
    caption: 'text-stone-600',
  },
  /*
   * Unreachable forward: the calendar derives `completed` only for a `booked`
   * date that is behind every visitor on Earth, and the earliest day the window
   * carries is the day before the server's — still somebody's today. Present
   * because the status is in the union, and a map that silently lacked a key
   * would render an unstyled cell rather than fail.
   */
  completed: {
    label: 'Done',
    cell: 'bg-sage-100 border-sage-300',
    number: 'text-sage-600',
    caption: 'text-sage-600',
  },
};

export interface WeekStripProps {
  /**
   * Nine consecutive days: the day before the server's UTC day through the day
   * after its week. The strip draws seven of them, starting on the viewer's own
   * day — see `BOOKING_WEEK_WINDOW_DAYS`.
   */
  days: WireVendorDashboard['bookingWindow'];
  /** The server's UTC day, seeding the first paint before the viewer's is known. */
  serverToday: string;
}

/**
 * The booking week — seven days from today, not a month grid.
 *
 * `30-responsive.md` is explicit that the dashboard's right column shows "the
 * booking week, not the month grid", and frame `27 Vendor dashboard — 1024`
 * draws it: seven equal cells, the day number over the state.
 */
export function WeekStrip({ days, serverToday }: WeekStripProps): React.ReactElement {
  const today = useViewerToday(serverToday);
  /*
   * Seven days from the viewer's own day. #409: anchoring on the server's meant
   * a vendor at UTC-5 in the evening got a "This week" that began tomorrow and
   * did not contain the day they were living in.
   *
   * Found in the dates the server actually sent rather than derived a second
   * time, so the two cannot drift. The widest wall-clock spread in use is
   * UTC-12 to UTC+14, which puts the viewer's day at index 0, 1 or 2 — always
   * far enough from the end for seven to follow. `Math.max` is not for a day
   * outside the window but for the value `findIndex` returns when it finds
   * nothing, which would otherwise slice from the end and draw one cell.
   */
  const start = Math.max(
    0,
    days.findIndex((day) => day.date === today),
  );
  const week = days.slice(start, start + BOOKING_WEEK_DAYS);

  return (
    /* 13px, not `rounded-xl` (14px) — frame `27` overrides `.card`'s radius on
       both rail cards, and the scale has no 13px step. */
    <div className="rounded-[13px] bg-stone-0 p-3.75 shadow-sm">
      <h3 className="mb-2.75 text-label font-semibold tracking-label text-stone-600 uppercase">
        This week
      </h3>
      <ul className="grid grid-cols-7 gap-1.25">
        {week.map((day) => {
          const tone = TONES[day.status];
          const date = new Date(`${day.date}T00:00:00Z`);

          return (
            <li
              key={day.date}
              /*
                `rounded-md` (8px), not `rounded-lg` (10px): frame `27` draws
                the strip's cells at 8px, and the design contract is the
                acceptance criterion. Caught by `parity-checker` on #409.
              */
              className={`flex h-11 flex-col items-center justify-center rounded-md border ${tone.cell}`}
            >
              {/*
                The cell's whole meaning in one accessible name. The visible
                caption is 7.5px — frame `27`'s size — which is legible as a
                glyph beside the number but is not something to make a screen
                reader user parse date-by-date out of two separate nodes.
              */}
              <span className="sr-only">{`${CELL_NAME.format(date)} — ${tone.label}`}</span>
              {/*
                16px, where frame `27` draws 15. `01-foundations.md` states the
                serif floor as a rule of the type system — "Never below 16px" —
                and `display-type.test.ts` enforces it across the tree, so the
                frame's 15px is the one value here that cannot be built. One
                pixel, on the smallest serif in the bundle; the alternative is
                lowering a floor that holds everywhere else for one strip.
              */}
              <span aria-hidden="true" className={`font-display text-[16px] ${tone.number}`}>
                {CELL_DAY.format(date)}
              </span>
              <span
                aria-hidden="true"
                className={`mt-px text-[7.5px] leading-none font-semibold tracking-label uppercase ${tone.caption}`}
              >
                {tone.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
