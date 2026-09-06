'use client';

import { isPastDate, type AvailabilityStatus } from '@vendor-marketplace/shared';
import { buildMonth, describeCell, monthsFrom, WEEKDAY_LABELS } from '@/lib/calendar';
import { useViewerToday } from '@/lib/use-viewer-today';
import { cn } from '@/lib/utils';

/** Current and next month, side by side — frame `03`. */
const MONTHS_SHOWN = 2;

export interface AvailabilityPaneProps {
  /**
   * The vendor's calendar as `date -> status`, **not the rows themselves**.
   *
   * This is a client component, so whatever it is handed is serialized into the
   * page's flight payload and shipped to the browser — and an `Availability`
   * row carries the vendor's private `note` ("Sarah & Tom, deposit paid"), which
   * would then sit in the HTML source of a public profile for any visitor or
   * crawler to read. The pane only ever asks a date for its status, so a status
   * is all it takes. `BookingRail` on the same page takes the same shape.
   */
  calendar: Readonly<Record<string, AvailabilityStatus>>;
  /** Seeds the first paint; `useViewerToday` decides which days read as past. */
  serverToday: string;
  businessName: string;
}

/**
 * The read-only half of the calendar. Deliberately not the vendor's
 * `AvailabilityCalendar`: that one writes through `useApi`, raises toasts and
 * understands locked statuses, none of which a visitor can do or needs.
 *
 * **A date with no row is free.** That is the same convention the editor uses,
 * so the two views cannot disagree — the vendor only ever records exceptions.
 */
export function AvailabilityPane({
  calendar,
  serverToday,
  businessName,
}: AvailabilityPaneProps): React.ReactElement {
  const today = useViewerToday(serverToday);
  const months = monthsFrom(today, MONTHS_SHOWN).map(({ year, month }) => buildMonth(year, month));

  return (
    <div className="max-w-[680px]">
      <div className="grid gap-6 sm:grid-cols-2">
        {months.map((month) => (
          <section key={month.label} aria-label={month.label}>
            {/*
              `h2`: the profile's only `h1` is the vendor's name in
              `ProfileHeader`, and `ProfileTabs` mounts one pane at a time — so
              on every tab but About the document went h1 -> h3.
            */}
            <h2 className="font-display text-[17px] text-stone-900">{month.label}</h2>

            <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAY_LABELS.map((label, index) => (
                <span
                  // Weekday initials repeat (S, T), so the index is the key.
                  key={`${label}-${index}`}
                  aria-hidden="true"
                  className="pb-1 text-label font-semibold text-stone-600"
                >
                  {label}
                </span>
              ))}

              {month.weeks.flat().map((date, index) => {
                if (date === null) {
                  return <span key={`pad-${index}`} />;
                }

                const past = isPastDate(date, today);
                const status = calendar[date];
                const unavailable = status === 'blocked' || status === 'booked';

                return (
                  <span
                    key={date}
                    className={cn(
                      'mx-auto flex size-7 items-center justify-center rounded-full text-[12.5px]',
                      // `stone-500` is the foundations table's disabled/
                      // out-of-month tone. `stone-400` is a *border* token and
                      // was never a text colour; it read at roughly 1.7:1.
                      past && 'text-stone-500',
                      // A day that is not available carries meaning, so it
                      // takes `stone-600` — the minimum for a real label —
                      // rather than the disabled tone.
                      !past && unavailable && 'text-stone-600 line-through',
                      !past && !unavailable && 'bg-sage-50 font-medium text-sage-600',
                    )}
                  >
                    {Number(date.slice(8, 10))}
                    {/*
                      The state in words, inside the cell.

                      It used to be a `title=`, which is a tooltip: it is not
                      part of the accessible name of a `<span>`, most screen
                      readers never speak it, and no keyboard can reach it. So
                      free-versus-booked was carried by sage-versus-strikethrough
                      alone, which `01-foundations.md` forbids outright — and
                      strikethrough is not exposed either.

                      The date comes with it because a bare "free" in a grid of
                      sixty cells says nothing about *which* day is free.
                    */}
                    <span className="sr-only">
                      {describeCell(
                        date,
                        past ? 'in the past' : unavailable ? 'not available' : 'free',
                      )}
                    </span>
                  </span>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-4 text-[12.5px] text-stone-600">
        Dates in sage are open. {businessName} confirms the date when they accept a request.
      </p>
    </div>
  );
}
