'use client';

import { isPastDate, type AvailabilityStatus } from '@vendor-marketplace/shared';
import { buildMonth, monthsFrom, WEEKDAY_LABELS } from '@/lib/calendar';
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
            <h3 className="font-display text-[17px] text-stone-900">{month.label}</h3>

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
                    // The visual state is also stated in words, because colour
                    // alone cannot carry "free" versus "booked".
                    title={
                      past ? undefined : unavailable ? `${date} — not available` : `${date} — free`
                    }
                    className={cn(
                      'mx-auto flex size-7 items-center justify-center rounded-full text-[12.5px]',
                      past && 'text-stone-400',
                      !past && unavailable && 'text-stone-400 line-through',
                      !past && !unavailable && 'bg-sage-50 font-medium text-sage-600',
                    )}
                  >
                    {Number(date.slice(8, 10))}
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
