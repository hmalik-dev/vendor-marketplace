'use client';

import {
  AVAILABILITY_MONTHS_AHEAD,
  isPastDate,
  LOCKED_AVAILABILITY_STATUSES,
  type AvailabilityStatus,
} from '@vendor-marketplace/shared';
import { useEffect, useMemo, useState } from 'react';
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

/** Saturday, as `Date.getUTCDay()` numbers it. */
const SATURDAY = 6;

/**
 * Cell states. Colour is never the only signal: booked is bold, blocked is
 * struck through, and every cell carries its state in its accessible name.
 * See design/design-plan/19-availability.md.
 */
const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  available: 'bg-stone-0 text-stone-900 hover:bg-clay-50',
  booked: 'bg-clay-100 font-semibold text-clay-600 cursor-not-allowed',
  pending: 'bg-gold-50 font-semibold text-gold-600 cursor-not-allowed',
  blocked: 'bg-stone-200 text-stone-600 line-through hover:bg-stone-300',
};

const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Available',
  booked: 'Booked — locked',
  pending: 'Pending request',
  blocked: 'Blocked by you',
};

/** The legend swatch for each state, plus the one for an in-progress drag. */
const LEGEND: ReadonlyArray<{ label: string; swatch: string }> = [
  { label: STATUS_LABELS.available, swatch: 'bg-stone-0 border border-stone-300' },
  { label: STATUS_LABELS.booked, swatch: 'bg-clay-100' },
  { label: STATUS_LABELS.pending, swatch: 'bg-gold-50' },
  { label: STATUS_LABELS.blocked, swatch: 'bg-stone-200' },
  { label: 'Selecting', swatch: 'bg-clay-400' },
];

const LOCKED: ReadonlySet<string> = new Set(LOCKED_AVAILABILITY_STATUSES);

/** The selecting state, which outranks whatever the date currently is. */
const SELECTING_STYLE = 'bg-clay-400 font-semibold text-stone-0';

/*
 * stone-500 is the one token allowed to fail AA, and a past date is exactly the
 * inert content it is reserved for.
 */
const PAST_STYLE = 'cursor-not-allowed text-stone-500';

/** Resolves a day cell to exactly one appearance. */
export function cellAppearance(
  status: AvailabilityStatus,
  { isPast, isSelected }: { isPast: boolean; isSelected: boolean },
): string {
  if (isPast) {
    return PAST_STYLE;
  }
  if (isSelected) {
    return SELECTING_STYLE;
  }
  return STATUS_STYLES[status];
}

/*
 * Frame `11 Availability` draws month paging as bare `‹` / `›` glyphs at 13px in
 * `stone-600` on the heading baseline — not as filled icon buttons. It is still
 * an icon-only control, so `04-laws.md` requires a 44x44 hit area: the glyph
 * keeps the frame's size and colour while a centred pseudo-element carries the
 * target, so the law is met without the frame's composition moving.
 */
function MonthNavButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="relative rounded-sm text-action text-stone-600 outline-none transition-colors duration-(--duration-fast) before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-clay-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 disabled:pointer-events-none disabled:opacity-50"
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

const RANGE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** `Jul 17 — 19` for a range, `Jul 17` for a single day. */
export function formatRange(dates: readonly string[]): string {
  const first = dates[0];
  const last = dates.at(-1);

  if (!first) {
    return '';
  }
  if (!last || first === last) {
    return RANGE_FORMATTER.format(new Date(`${first}T00:00:00Z`));
  }

  const start = RANGE_FORMATTER.format(new Date(`${first}T00:00:00Z`));
  const end = new Date(`${last}T00:00:00Z`);
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);

  return `${start} — ${sameMonth ? end.getUTCDate() : RANGE_FORMATTER.format(end)}`;
}

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
  const [isDragging, setIsDragging] = useState(false);
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

  const statusOf = (date: string): AvailabilityStatus => statusByDate.get(date) ?? 'available';
  /*
   * Today is editable, the days before it are not. A vendor who wakes up ill
   * blocks *today* — refusing that while offering tomorrow is the calendar
   * failing at the one moment it matters most.
   *
   * What has already happened is history, not a setting: a past cell keeps the
   * status it actually had — booked, blocked, available — and is rendered
   * read-only rather than blanked, so the calendar stays a record of what
   * transpired. See design/design-plan/19-availability.md.
   */
  const isEditable = (date: string): boolean =>
    !isPastDate(date, today) && !LOCKED.has(statusOf(date));

  /*
   * A drag that ends outside the grid still has to end. Without this the
   * calendar stays in drag mode and the next hover silently repaints the
   * selection.
   */
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const stop = (): void => setIsDragging(false);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);

    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [isDragging]);

  /** The quarter on screen, which is what the rail's counts describe. */
  const quarter = useMemo(() => {
    const visible = new Set(
      visibleMonths.flatMap((month) => month.weeks.flat().filter((date) => date !== null)),
    );

    let booked = 0;
    let blocked = 0;
    let openSaturdays = 0;

    for (const date of visible) {
      // Read from the map rather than through `statusOf`, so this memo's
      // dependencies are exactly what it uses.
      const status = statusByDate.get(date) ?? 'available';

      if (status === 'booked') {
        booked += 1;
      }
      if (status === 'blocked') {
        blocked += 1;
      }
      if (
        status === 'available' &&
        !isPastDate(date, today) &&
        new Date(`${date}T00:00:00Z`).getUTCDay() === SATURDAY
      ) {
        openSaturdays += 1;
      }
    }

    return { booked, blocked, openSaturdays };
  }, [visibleMonths, statusByDate, today]);

  const extendTo = (date: string): void => {
    if (anchor === null) {
      return;
    }
    setSelection(datesBetween(anchor, date).filter(isEditable));
  };

  /**
   * A plain click starts a new selection; dragging or shift-clicking extends
   * from the anchor. Shift-click is kept alongside the drag because a range is
   * otherwise unreachable from the keyboard.
   */
  const startAt = (date: string, extend: boolean): void => {
    if (extend && anchor !== null) {
      extendTo(date);
      return;
    }

    setAnchor(date);
    setSelection((previous) => (previous.length === 1 && previous[0] === date ? [] : [date]));
  };

  const apply = async (
    dates: readonly string[],
    status: 'available' | 'blocked',
  ): Promise<void> => {
    const editable = dates.filter(isEditable);

    if (editable.length === 0) {
      toast.error('Pick one or more future dates that are not already spoken for.');
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
          : `${editable.length} ${editable.length === 1 ? 'date is' : 'dates are'} open again.`,
      );
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'Could not update your calendar.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  /*
   * "June — August 2026" rather than "June 2026 — August 2026": the year is
   * only worth saying twice when the range actually crosses one.
   */
  const rangeLabel = useMemo(() => {
    const first = visibleMonths[0]?.label ?? '';
    const last = visibleMonths.at(-1)?.label ?? '';

    if (!last || first === last) {
      return first;
    }

    const sameYear = first.slice(-4) === last.slice(-4);
    return `${sameYear ? first.replace(/\s\d{4}$/, '') : first} — ${last}`;
  }, [visibleMonths]);

  const canPageBack = pageStart > 0;
  const canPageForward = pageStart + MONTHS_PER_PAGE < allMonths.length;

  const selectionStatuses = new Set(selection.map(statusOf));
  const selectionIsBlocked = selectionStatuses.size === 1 && selectionStatuses.has('blocked');

  return (
    <div
      /*
       * The rail is a grid track, so `box-content` cannot reach it the way it
       * does the sidebar: the track sizes the aside, not its own `width`. The
       * frame draws 300px of content inside 20px gutters and a 1px left
       * border, so the track carries all 341px. `--list-pane` stays at its
       * 300px content value because the messaging list, which has neither
       * gutters nor a border, is sized from the same token.
       */
      className="grid min-h-0 gap-6 xl:h-full xl:grid-cols-[1fr_calc(var(--list-pane)+41px)] xl:gap-0"
    >
      <section className="app-pane flex min-h-0 flex-col pr-0 xl:pr-6">
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-3">
          <h2 className="display-heading text-display-md text-stone-900">Availability</h2>

          <div className="flex items-center gap-3 text-base text-stone-700">
            <MonthNavButton
              label="Show earlier months"
              glyph="‹"
              disabled={!canPageBack}
              onClick={() => setPageStart((previous) => Math.max(0, previous - MONTHS_PER_PAGE))}
            />
            <span className="tabular-nums">{rangeLabel}</span>
            <MonthNavButton
              label="Show later months"
              glyph="›"
              disabled={!canPageForward}
              onClick={() =>
                setPageStart((previous) =>
                  Math.min(allMonths.length - MONTHS_PER_PAGE, previous + MONTHS_PER_PAGE),
                )
              }
            />
          </div>
        </div>

        <p className="mt-1 shrink-0 text-base leading-normal text-stone-700">
          Click a date to block it, or drag across several. Booked dates are locked.
        </p>

        {/*
          Three months side by side at the 1440 reference viewport, two from
          1024, one below — a booking horizon with no month navigation
          (design/design-plan/19-availability.md).
        */}
        <div className="mt-5 grid min-h-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleMonths.map((month) => (
            <div key={`${month.year}-${month.month}`}>
              <h3 className="mb-2.5 font-display text-[18px] text-stone-900">
                {month.label.replace(/\s\d{4}$/, '')}
              </h3>

              <table className="w-full table-fixed border-separate border-spacing-1">
                <thead>
                  <tr>
                    {WEEKDAY_LABELS.map((weekday, index) => (
                      <th
                        // Weekday initials repeat (S, T), so the index is the id.
                        key={`${weekday}-${index}`}
                        scope="col"
                        className="pb-1 text-center text-[10px] font-semibold text-stone-600"
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
                        const isPast = isPastDate(date, today);
                        const isToday = date === today;
                        const isSelected = selectedSet.has(date);
                        const locked = isPast || LOCKED.has(status);

                        return (
                          <td key={date} className="p-0">
                            <button
                              type="button"
                              disabled={locked || isSaving}
                              aria-pressed={isSelected}
                              aria-label={`${date} — ${STATUS_LABELS[status]}${isPast ? ', in the past' : ''}`}
                              onPointerDown={(event) => {
                                if (locked) return;
                                setIsDragging(true);
                                startAt(date, event.shiftKey);
                              }}
                              onPointerEnter={() => {
                                if (isDragging && !locked) extendTo(date);
                              }}
                              onClick={(event) => {
                                // Keyboard activation reports no pointer, and
                                // never fires the pointer handlers above.
                                if (event.detail === 0) startAt(date, event.shiftKey);
                              }}
                              className={cn(
                                // 7px padding at the 1440 reference; a 44px
                                // touch target below `sm`, where the input is
                                // a finger rather than a pointer.
                                'min-h-11 w-full rounded-[7px] py-[7px] text-center text-meta tabular-nums transition-colors duration-(--duration-fast) sm:min-h-0',
                                // Exactly one of these, never layered: a
                                // `hover:` utility outranks a plain one at the
                                // same specificity, so an available cell's
                                // hover fill would beat the selected fill and
                                // paint white text on near-white.
                                cellAppearance(status, { isPast, isSelected }),
                                isToday && 'ring-2 ring-clay-400',
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

      {/*
        The rail holds the selection, the legend and the counts, so none of them
        scroll away while the vendor works through a booking horizon.
      */}
      <aside className="app-pane flex min-h-0 flex-col gap-4 border-stone-300 bg-stone-0 p-5 xl:border-l">
        <section>
          <h2 className="mb-2.5 text-label font-semibold tracking-label text-stone-600 uppercase">
            Selected
          </h2>

          {selection.length === 0 ? (
            /*
              A status line, not a second instruction. The frame draws no empty
              state here, and the sentence that used to sit in this slot told
              the vendor a click "selects" while the pane 40px away told them it
              "blocks". Only the pane carries an instruction now.
            */
            <p className="text-sm leading-normal text-stone-700">No dates selected yet.</p>
          ) : (
            <div className="rounded-[12px] bg-clay-100 p-[13px]">
              <p className="font-display text-[20px] text-stone-900">{formatRange(selection)}</p>
              <p className="mt-1 text-sm text-stone-700">
                {selection.length} {selection.length === 1 ? 'day' : 'days'} · currently{' '}
                {selectionIsBlocked ? 'blocked' : 'available'}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="px-3.5 py-2"
                  disabled={isSaving}
                  onClick={() =>
                    void apply(selection, selectionIsBlocked ? 'available' : 'blocked')
                  }
                >
                  {selectionIsBlocked ? 'Open these up' : 'Block these'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-stone-700 hover:text-stone-900"
                  disabled={isSaving}
                  onClick={() => {
                    setSelection([]);
                    setAnchor(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2.5 text-label font-semibold tracking-label text-stone-600 uppercase">
            Legend
          </h2>
          <ul className="flex flex-col gap-2.25 text-sm text-stone-700">
            {LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn('size-4.5 shrink-0 rounded-[5px]', item.swatch)}
                />
                {item.label}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2.5 text-label font-semibold tracking-label text-stone-600 uppercase">
            This quarter
          </h2>
          <dl className="flex flex-col gap-2 text-base text-stone-700">
            <div className="flex justify-between">
              <dt>Booked</dt>
              <dd className="font-semibold">{quarter.booked} dates</dd>
            </div>
            <div className="flex justify-between">
              <dt>Blocked</dt>
              <dd className="font-semibold">{quarter.blocked} dates</dd>
            </div>
            <div className="flex justify-between">
              <dt>Open Saturdays</dt>
              {/* The number that drives behaviour, so it is the one in clay. */}
              <dd className="font-semibold text-clay-600">{quarter.openSaturdays} left</dd>
            </div>
          </dl>
        </section>

        {/*
          The design's market note ("Saturdays are 80% booked across Austin") is
          deferred until there is real market data to read it from — see
          design/design-plan/98-post-mvp.md. Until then this panel says only
          what this vendor's own calendar says, which is true on day one.
        */}
        <p className="rounded-[12px] bg-stone-150 p-3 text-sm leading-relaxed text-stone-700">
          {quarter.openSaturdays === 0
            ? 'Every Saturday in these three months is already spoken for.'
            : `${quarter.openSaturdays} of your Saturdays in these three months are still open, alongside ${quarter.booked} booked and ${quarter.blocked} blocked dates.`}
        </p>
      </aside>
    </div>
  );
}
