import { isPastDate, type Availability } from '@vendor-marketplace/shared';
import { buildMonth, monthsFrom, WEEKDAY_LABELS } from '@/lib/calendar';
import { cn } from '@/lib/utils';

/** Current and next month, side by side — frame `03`. */
const MONTHS_SHOWN = 2;

export interface AvailabilityPaneProps {
  entries: readonly Availability[];
  /** Today as `YYYY-MM-DD`, resolved on the server so the month is stable. */
  today: string;
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
  entries,
  today,
  businessName,
}: AvailabilityPaneProps): React.ReactElement {
  const byDate = new Map(entries.map((entry) => [entry.date, entry.status]));
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
                const status = byDate.get(date);
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
