'use client';

import {
  AVAILABILITY_MONTHS_AHEAD,
  isFutureDate,
  type AvailabilityStatus,
} from '@vendor-marketplace/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { buildMonth, datesBetween, monthsFrom, WEEKDAY_LABELS } from '@/lib/calendar';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { wireAvailabilityListSchema, type WireAvailability } from '@/lib/wire-schemas';
import { Button } from '@/components/ui/button';

export interface AvailabilityCalendarProps {
  initialEntries: readonly WireAvailability[];
  /** Today, as a `YYYY-MM-DD` UTC date resolved on the server. */
  today: string;
}

/** How many months sit side by side; the rest are reached with the arrows. */
const MONTHS_PER_PAGE = 3;

const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  available: 'bg-sage-50 text-sage-700 hover:bg-sage-100',
  blocked: 'bg-stone-200 text-stone-600 hover:bg-stone-300',
  booked: 'bg-destructive/10 text-destructive cursor-not-allowed',
};

const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Available',
  blocked: 'Blocked',
  booked: 'Booked',
};

/**
 * The vendor's twelve-month calendar. The stored calendar is sparse — a date
 * with no row is available — so this component fills the gaps rather than
 * expecting a row per day.
 */
export function AvailabilityCalendar({
  initialEntries,
  today,
}: AvailabilityCalendarProps): React.ReactElement {
  const request = useApi();
  const [entries, setEntries] = useState<readonly WireAvailability[]>(initialEntries);
  const [pageStart, setPageStart] = useState(0);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const statusByDate = useMemo(() => {
    const map = new Map<string, AvailabilityStatus>();
    for (const entry of entries) {
      map.set(entry.date, entry.status);
    }
    return map;
  }, [entries]);

  const allMonths = useMemo(() => monthsFrom(today, AVAILABILITY_MONTHS_AHEAD + 1), [today]);
  const visibleMonths = useMemo(
    () =>
      allMonths
        .slice(pageStart, pageStart + MONTHS_PER_PAGE)
        .map((month) => buildMonth(month.year, month.month)),
    [allMonths, pageStart],
  );

  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const blockedCount = entries.filter((entry) => entry.status === 'blocked').length;

  const statusOf = (date: string): AvailabilityStatus => statusByDate.get(date) ?? 'available';

  /**
   * A plain click starts a new selection; shift-click extends from the anchor,
   * which is the keyboard- and trackpad-friendly form of a click-and-drag range
   * and needs no pointer tracking to be reliable.
   */
  const selectDate = (date: string, extend: boolean): void => {
    if (extend && anchor !== null) {
      setSelection(datesBetween(anchor, date).filter((day) => statusOf(day) !== 'booked'));
      return;
    }

    setAnchor(date);
    setSelection((previous) => (previous.length === 1 && previous[0] === date ? [] : [date]));
  };

  const apply = async (
    dates: readonly string[],
    status: 'available' | 'blocked',
  ): Promise<void> => {
    const editable = dates.filter((date) => isFutureDate(date) && statusOf(date) !== 'booked');

    if (editable.length === 0) {
      toast.error('Pick one or more future dates that are not already booked.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await request('/vendor/availability', {
        method: 'PUT',
        body: { entries: editable.map((date) => ({ date, status })) },
        schema: wireAvailabilityListSchema,
      });

      setEntries(saved);
      setSelection([]);
      setAnchor(null);
      toast.success(
        status === 'blocked'
          ? `${editable.length} ${editable.length === 1 ? 'date' : 'dates'} blocked.`
          : `${editable.length} ${editable.length === 1 ? 'date is' : 'dates are'} available again.`,
      );
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'Could not update your calendar.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const clearAllBlocked = (): void => {
    const blocked = entries
      .filter((entry) => entry.status === 'blocked' && isFutureDate(entry.date))
      .map((entry) => entry.date);

    if (blocked.length === 0) {
      toast.error('There are no blocked dates to clear.');
      return;
    }

    void apply(blocked, 'available');
  };

  const canPageBack = pageStart > 0;
  const canPageForward = pageStart + MONTHS_PER_PAGE < allMonths.length;

  return (
    <div className="grid min-h-0 gap-6 xl:h-full xl:grid-cols-[1fr_var(--rail-filter)]">
      <section className="flex min-h-0 flex-col rounded-lg border border-stone-300 bg-card p-2 shadow-sm sm:p-5 xl:overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 lg:size-8"
            aria-label="Show earlier months"
            disabled={!canPageBack}
            onClick={() => setPageStart((previous) => Math.max(0, previous - MONTHS_PER_PAGE))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <p className="font-display text-base font-semibold text-stone-800">
            {visibleMonths[0]?.label}
            {visibleMonths.length > 1 ? ` – ${visibleMonths.at(-1)?.label}` : ''}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 lg:size-8"
            aria-label="Show later months"
            disabled={!canPageForward}
            onClick={() =>
              setPageStart((previous) =>
                Math.min(allMonths.length - MONTHS_PER_PAGE, previous + MONTHS_PER_PAGE),
              )
            }
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        {/*
          Three months side by side at the 1440 reference viewport, two from
          1024, one below (design/design-plan/19-availability.md). The pane scrolls on its own, so
          a month that wraps at 1280 costs the page no height.
        */}
        <div className="mt-4 grid min-h-0 gap-6 lg:grid-cols-2 min-[90rem]:grid-cols-3 xl:overflow-y-auto">
          {visibleMonths.map((month) => (
            <div key={`${month.year}-${month.month}`}>
              <h2 className="font-display text-sm font-semibold text-stone-800">{month.label}</h2>

              <table className="mt-2 w-full table-fixed border-separate border-spacing-px sm:border-spacing-0.5">
                <thead>
                  <tr>
                    {WEEKDAY_LABELS.map((weekday, index) => (
                      <th
                        // Weekday initials repeat (S, T), so the index is the id.
                        key={`${weekday}-${index}`}
                        scope="col"
                        className="pb-1 text-center text-xs font-medium text-stone-600"
                      >
                        <span aria-hidden="true">{weekday}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {month.weeks.map((week) => (
                    <tr key={week.find((date) => date !== null) ?? `${month.month}-pad`}>
                      {week.map((date, index) => {
                        if (date === null) {
                          return <td key={`pad-${index}`} />;
                        }

                        const status = statusOf(date);
                        const isPast = !isFutureDate(date);
                        const isToday = date === today;
                        const isSelected = selectedSet.has(date);
                        const isLocked = isPast || status === 'booked';

                        return (
                          <td key={date} className="p-0">
                            <button
                              type="button"
                              disabled={isLocked || isSaving}
                              aria-pressed={isSelected}
                              aria-label={`${date} — ${STATUS_LABELS[status]}${isPast ? ', in the past' : ''}`}
                              onClick={(event) => selectDate(date, event.shiftKey)}
                              className={cn(
                                'flex aspect-square w-full items-center justify-center rounded-md text-xs tabular-nums transition-colors duration-(--duration-fast)',
                                isPast
                                  ? // stone-500 is the one token allowed to fail
                                    // AA, and a past date is exactly the inert
                                    // content it is reserved for.
                                    'cursor-not-allowed bg-stone-50 text-stone-500'
                                  : STATUS_STYLES[status],
                                isToday && 'ring-2 ring-clay-400',
                                isSelected && 'ring-2 ring-clay-400 ring-offset-1',
                              )}
                            >
                              {Number(date.slice(-2))}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* The rail holds the legend and the actions, so neither scrolls away
          while the vendor works through a year of dates. */}
      <aside className="min-h-0 rounded-lg border border-stone-300 bg-card p-4 shadow-sm sm:p-5 xl:sticky xl:top-0 xl:self-start">
        <h2 className="font-display text-base font-semibold text-stone-800">Legend</h2>
        <ul className="mt-3 space-y-2">
          {(['available', 'blocked', 'booked'] as const).map((status) => (
            <li key={status} className="flex items-center gap-2 text-sm text-stone-700">
              <span
                aria-hidden="true"
                className={cn('size-4 shrink-0 rounded', STATUS_STYLES[status].split(' ')[0])}
              />
              {STATUS_LABELS[status]}
              {status === 'booked' ? ' — set by your bookings' : ''}
            </li>
          ))}
        </ul>

        <h2 className="mt-6 font-display text-base font-semibold text-stone-800">Selection</h2>
        <p className="mt-1 text-sm text-stone-600">
          {selection.length === 0
            ? 'Click a date to select it. Shift-click another to take the whole range.'
            : `${selection.length} ${selection.length === 1 ? 'date' : 'dates'} selected, ${selection[0]} to ${selection.at(-1)}.`}
        </p>

        <div className="mt-3 space-y-2">
          <Button
            type="button"
            variant="primary"
            className="h-11 w-full lg:h-8"
            disabled={isSaving || selection.length === 0}
            onClick={() => void apply(selection, 'blocked')}
          >
            Block selected dates
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full lg:h-8"
            disabled={isSaving || selection.length === 0}
            onClick={() => void apply(selection, 'available')}
          >
            Mark selected available
          </Button>
        </div>

        <div className="mt-6 border-t border-stone-300 pt-4">
          <p className="text-sm text-stone-600">
            {blockedCount === 0
              ? 'Nothing is blocked — customers can request any future date.'
              : `${blockedCount} ${blockedCount === 1 ? 'date is' : 'dates are'} blocked.`}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-2 h-11 w-full lg:h-8"
            disabled={isSaving || blockedCount === 0}
            onClick={clearAllBlocked}
          >
            Clear every blocked date
          </Button>
        </div>
      </aside>
    </div>
  );
}
