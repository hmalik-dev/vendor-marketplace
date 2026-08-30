'use client';

import {
  AVAILABILITY_MONTHS_AHEAD,
  isPastDate,
  LOCKED_AVAILABILITY_STATUSES,
  type AvailabilityStatus,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { CELL_HELD, CELL_UNAVAILABLE } from '@/components/availability/cell-marks';
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
 * Cell states — **every one carries a shape, not just a fill** (#166, #301).
 *
 * Booked, pending and blocked previously sat within two points of luminance of
 * each other: indistinguishable in greyscale, at a glance, or with red-green
 * deficiency. The frame's answer is a mark per state — dot, dashed border,
 * hatch + strike, check, ink outline — and the fill became reinforcement rather
 * than the signal. See design/design-plan/19-availability.md.
 *
 * The blocked hatch is the one place this departs from the frame, and the
 * departure is ruled and recorded (#278 via #306) — see `cell-marks.ts`, which
 * now holds it, because #167's customer-side date picker draws the same marks
 * and the frame's own note requires the two to be one visual language.
 */
const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  available: 'bg-stone-0 text-stone-900 hover:bg-clay-50',
  booked: 'bg-clay-100 font-semibold text-clay-600 cursor-not-allowed',
  pending: `${CELL_HELD} cursor-not-allowed`,
  blocked: CELL_UNAVAILABLE,
  completed: 'bg-sage-50 font-semibold text-sage-600',
};

const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Available',
  booked: 'Booked — locked',
  pending: 'Pending request',
  blocked: 'Blocked by you',
  completed: 'Completed',
};

/**
 * The mark each state carries, drawn beneath the numeral.
 *
 * `dot` and `check` are absolutely positioned, which is why their cells take
 * the frame's asymmetric `5px 0 10px` padding: the numeral stays optically
 * centred above the mark rather than being shouldered off it.
 */
type CellMark = 'dot' | 'check' | null;

const STATUS_MARKS: Record<AvailabilityStatus, CellMark> = {
  available: null,
  booked: 'dot',
  pending: null,
  blocked: null,
  completed: 'check',
};

/** Frame `11`: a 4px clay dot, centred, 4px from the bottom of the cell. */
function BookedDot(): React.ReactElement {
  return (
    <i
      aria-hidden="true"
      className="absolute bottom-[4px] left-1/2 -ml-[2px] size-[4px] rounded-full bg-clay-400"
    />
  );
}

/** Frame `11`: a 7x4 two-sided border rotated -45deg — a tick, not a glyph. */
function CompletedCheck(): React.ReactElement {
  return (
    <i
      aria-hidden="true"
      className="absolute bottom-[5px] left-1/2 -ml-[4px] h-[4px] w-[7px] -rotate-45 border-b-[1.6px] border-l-[1.6px] border-sage-400"
    />
  );
}

/**
 * The legend renders the **actual marks**, not flat colour chips (#263).
 *
 * A legend of plain swatches cannot explain a calendar whose states are told
 * apart by shape — it would be a key to the one signal the redesign stopped
 * relying on. Each swatch is the cell it describes, at the frame's 22px.
 */
const LEGEND: ReadonlyArray<{
  readonly label: string;
  readonly shape: string | null;
  readonly status: AvailabilityStatus | 'selecting' | 'today';
}> = [
  { label: STATUS_LABELS.available, shape: 'no mark', status: 'available' },
  { label: STATUS_LABELS.booked, shape: 'dot', status: 'booked' },
  { label: STATUS_LABELS.pending, shape: 'dashed', status: 'pending' },
  { label: STATUS_LABELS.blocked, shape: 'hatch + strike', status: 'blocked' },
  { label: STATUS_LABELS.completed, shape: 'check', status: 'completed' },
  { label: 'Selecting now', shape: null, status: 'selecting' },
  { label: 'Today', shape: 'ink outline', status: 'today' },
];

/** `selecting` and `today` are cell states without being stored statuses. */
const LEGEND_MARK: Record<AvailabilityStatus | 'selecting' | 'today', CellMark> = {
  ...STATUS_MARKS,
  selecting: null,
  today: null,
};

const LOCKED: ReadonlySet<string> = new Set(LOCKED_AVAILABILITY_STATUSES);

/** The selecting state, which outranks whatever the date currently is. */
const SELECTING_STYLE = 'bg-clay-400 font-semibold text-stone-0';

/*
 * A past date is inert, and the frame fills it rather than leaving it bare:
 * `stone-50` ground under a `stone-500` numeral. `stone-500` is the one token
 * allowed to fail AA, and this is the content it is reserved for.
 */
const PAST_STYLE = 'cursor-not-allowed bg-stone-50 text-stone-500';

/** Frame `11`: today is an ink border, not a clay ring (#264). */
const TODAY_STYLE = 'border-[1.5px] border-stone-900 font-semibold';

/**
 * Resolves a day cell to exactly one appearance.
 *
 * **`completed` outranks `isPast`**, which no other state does. A completed
 * event is *defined* by being in the past, so the past branch would erase the
 * one state it exists to show — and the frame draws it clickable, because
 * opening the delivered booking is why it stays on the calendar at all.
 */
export function cellAppearance(
  status: AvailabilityStatus,
  { isPast, isSelected }: { isPast: boolean; isSelected: boolean },
): string {
  if (status === 'completed') {
    return STATUS_STYLES.completed;
  }
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
 * an icon-only control, so `04-laws.md` requires a 44x44 hit area.
 *
 * The target is a real 44px box **in flow**, with the glyph drawn at the frame's
 * size and colour inside it. It cannot be an absolutely positioned pseudo-element
 * hung off a 16px box: this row is the first child of `section.app-pane`, which
 * `theme.css` gives `overflow-y: auto`, so anything reaching above the pane's
 * content origin is clipped. Measured on the page, that cost the top 1px of the
 * target — 43px against the 44px the law requires. A flex item cannot overflow
 * the start of its own flex line, so an in-flow box has nothing to clip.
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
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-action text-stone-600 outline-none transition-colors duration-(--duration-fast) hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-clay-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 disabled:pointer-events-none disabled:opacity-50"
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
  const router = useRouter();
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
    let completed = 0;
    let openSaturdays = 0;

    for (const date of visible) {
      // Read from the map rather than through `statusOf`, so this memo's
      // dependencies are exactly what it uses.
      const status = statusByDate.get(date) ?? 'available';

      if (status === 'booked') {
        booked += 1;
      }
      /*
       * Only what is still ahead. The read window starts at the first of the
       * month so completed events can render, which also brings back elapsed
       * blocked days — and `cellAppearance` draws those as ordinary past cells,
       * with no hatch and no strike. Counting them said "Blocked 1 dates" with
       * nothing hatched anywhere on screen.
       */
      if (status === 'blocked' && !isPastDate(date, today)) {
        blocked += 1;
      }
      if (status === 'completed') {
        completed += 1;
      }
      if (
        status === 'available' &&
        !isPastDate(date, today) &&
        new Date(`${date}T00:00:00Z`).getUTCDay() === SATURDAY
      ) {
        openSaturdays += 1;
      }
    }

    return { booked, blocked, completed, openSaturdays };
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
          <h1 className="display-heading text-display-md text-stone-900">Availability</h1>

          <div className="flex items-center gap-3 text-[13px] text-stone-700">
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

        {/*
          `leading-[normal]`, not `leading-normal`. The frame declares no
          line-height, so it inherits the CSS keyword `normal` (~1.19) — while
          Tailwind's `leading-normal` is the RATIO 1.5, a 40.5px box against the
          frame's 32px, which pushed the whole calendar 23px down the page.
        */}
        <p className="mt-1 shrink-0 text-base leading-[normal] text-stone-700">
          Click a date to block it, or drag across several. Booked dates are locked, and completed
          events stay on the calendar &mdash; click one to open it.
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
                        const mark = STATUS_MARKS[status];
                        const locked = isPast || LOCKED.has(status);
                        /*
                         * The one past cell that is not inert. It is still not
                         * vendor-settable — `completed` is in
                         * `LOCKED_AVAILABILITY_STATUSES` — but the frame draws
                         * it with a pointer and the instruction above promises
                         * a click, so it stays focusable and navigates instead
                         * of being `disabled`.
                         *
                         * A `disabled` button is removed from the tab order
                         * entirely, so its accessible name is never announced:
                         * the promise would have been dead for a keyboard user
                         * before it was dead for anyone else.
                         */
                        const opensBooking = status === 'completed';
                        /*
                         * Same shape, same reason. `19-availability.md` gives
                         * pending the interaction "opens the request", and a
                         * `disabled` button is out of the tab order — so the
                         * cell's accessible name is never announced and the
                         * promise is dead for a keyboard user first.
                         *
                         * The dashboard rather than a deep link: `availability`
                         * carries no request id, and a URL the data cannot
                         * support is the same defect wearing a different hat.
                         */
                        const opensRequest = status === 'pending';
                        const navigates = opensBooking || opensRequest;

                        return (
                          <td key={date} className="p-0">
                            <button
                              type="button"
                              disabled={(locked && !navigates) || isSaving}
                              {...(locked ? {} : { 'aria-pressed': isSelected })}
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
                                if (navigates) {
                                  /*
                                   * The calendar knows the date, not which
                                   * booking sat on it — `availability` carries
                                   * no request id — so this opens the surface
                                   * that lists them rather than inventing a
                                   * deep link the data cannot support.
                                   */
                                  router.push(
                                    opensBooking ? '/vendor/bookings' : '/vendor/dashboard',
                                  );
                                  return;
                                }
                                // Keyboard activation reports no pointer, and
                                // never fires the pointer handlers above.
                                if (event.detail === 0) startAt(date, event.shiftKey);
                              }}
                              className={cn(
                                // 7px padding at the 1440 reference; a 44px
                                // touch target below `sm`, where the input is
                                // a finger rather than a pointer.
                                'relative min-h-11 w-full rounded-[7px] py-[7px] text-center text-meta tabular-nums transition-colors duration-(--duration-fast) sm:min-h-0',
                                // Exactly one of these, never layered: a
                                // `hover:` utility outranks a plain one at the
                                // same specificity, so an available cell's
                                // hover fill would beat the selected fill and
                                // paint white text on near-white.
                                cellAppearance(status, { isPast, isSelected }),
                                /*
                                  The frame's asymmetric padding for the two
                                  states that carry an absolutely positioned
                                  mark, so the numeral stays optically centred
                                  above it rather than being shouldered off.
                                */
                                /*
                                  A `1.5px` border, so the padding drops by the
                                  same amount and the cell keeps its height —
                                  the frame does exactly this arithmetic.

                                  Emitted BEFORE the mark padding, because
                                  `twMerge` lets the later class win and `py`
                                  conflicts with `pt`/`pb`: the other order
                                  silently collapsed a booked-today cell's 10px
                                  clearance to 5.5px and dropped its numeral
                                  onto the dot.
                                */
                                (isToday || status === 'pending') && 'py-[5.5px]',
                                mark !== null && 'pt-[5px] pb-[10px]',
                                isToday && TODAY_STYLE,
                              )}
                            >
                              {Number(date.slice(-2))}
                              {mark === 'dot' ? <BookedDot /> : null}
                              {mark === 'check' ? <CompletedCheck /> : null}
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
                  // Frame `11` draws `Clear` at `8px 6px`, not the `sm` default.
                  className="px-1.5 py-2 text-stone-700 hover:text-stone-900"
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
                {/*
                  The swatch IS the cell, at the frame's 22px — same fill, same
                  border, same mark. A flat colour chip would be a key to the one
                  signal this calendar stopped relying on.
                */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative flex size-5.5 shrink-0 items-center justify-center rounded-[6px] text-[10px] font-semibold',
                    /*
                      Stripped of the cell's interactive utilities: a legend
                      swatch is not a control, and inheriting them tinted the
                      Available chip on hover and put a 🚫 cursor on Booked.
                    */
                    item.status === 'selecting'
                      ? SELECTING_STYLE
                      : item.status === 'today'
                        ? cn('bg-stone-0 text-stone-900', TODAY_STYLE)
                        : STATUS_STYLES[item.status]
                            .split(' ')
                            .filter(
                              (token) =>
                                !token.startsWith('hover:') && token !== 'cursor-not-allowed',
                            )
                            .join(' '),
                    item.status === 'available' && 'border border-stone-300',
                    LEGEND_MARK[item.status] !== null && 'pb-1',
                  )}
                >
                  {item.status === 'today' ? '11' : '14'}
                  {LEGEND_MARK[item.status] === 'dot' ? <BookedDot /> : null}
                  {LEGEND_MARK[item.status] === 'check' ? <CompletedCheck /> : null}
                </span>
                <span>
                  {item.label}
                  {/* The frame leaves row 1's tail in the row colour. */}
                  {item.shape === null ? null : (
                    <span className={item.status === 'available' ? undefined : 'text-stone-600'}>
                      {item.status === 'available' ? ' — ' : ' · '}
                      {item.shape}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2.5 text-label font-semibold tracking-label text-stone-600 uppercase">
            This quarter
          </h2>
          <dl className="flex flex-col gap-2 text-[13px] text-stone-700">
            <div className="flex justify-between">
              <dt>Booked ahead</dt>
              <dd className="font-semibold">{quarter.booked} dates</dd>
            </div>
            <div className="flex justify-between">
              <dt>Completed</dt>
              {/*
                Sage, because settled is what sage means (`40-states.md`) — and
                the number is a real count of past booked dates, not a promise.
              */}
              <dd className="font-semibold text-sage-600">
                {quarter.completed} {quarter.completed === 1 ? 'event' : 'events'}
              </dd>
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
