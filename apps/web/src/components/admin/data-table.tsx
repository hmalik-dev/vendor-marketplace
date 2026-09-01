import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A single grid track, as a column may declare it: flexible (`1.6fr`, `.9fr`)
 * or fixed (`22px`, `70px`). Nothing else — see `width` below.
 */
export type TableTrack = `${number}fr` | `${number}px`;

export interface DataTableColumn<T> {
  key: string;
  /** The uppercase micro-label in the fixed header row. Empty for a control column. */
  header: string;
  /**
   * This column's grid track — `1.6fr`, `70px`.
   *
   * On the column rather than in a separate track list beside it. The list and
   * the columns were two hand-synchronised arrays, so adding a column without
   * editing the string misaligned the header from the body with no type error
   * and no test — which is the single most visible way a table like this
   * breaks. Now the two cannot disagree, because there is only one.
   *
   * Narrowed from `string` to these two shapes by `#389`. `resolveTrack` floors
   * a flexible track so one row's content cannot resize it, but it can only
   * recognise the forms it is given — `auto`, `min-content`, `max-content` and
   * `fit-content()` all size against each row's own content in exactly the same
   * way and would reintroduce the bug past a regex that only reads `fr`. The
   * type is what makes that unwritable rather than merely unwritten, and it
   * accepts every one of the 37 tracks the six admin tables declare.
   */
  width: TableTrack;
  cell: (row: T) => ReactNode;
  /**
   * Overrides for one **body** cell — right alignment on the overflow column,
   * the business name's weight and colour.
   *
   * Deliberately not applied to the header. It was, and `vendor-table`'s
   * `text-stone-900` on the business column leaked into the `BUSINESS` label,
   * which the frame draws in `stone-600` like the other five — a near-black
   * header cell beside five muted ones, invisible in review.
   */
  className?: string;
  /** Overrides for the header cell alone, where one is genuinely needed. */
  headerClassName?: string;
}

/** A bare `<flex>` track as a column declares it — `1.6fr`, `.9fr`. */
const FLEX_TRACK = /^\d*\.?\d+fr$/;

/**
 * A flexible track, floored at zero. Fixed tracks pass through untouched.
 *
 * A bare `<flex>` track's automatic minimum is `min-content`, not zero — so a
 * cell wider than its share widens its own track and steals the difference from
 * the rest. `DataTable` gives the header and **every body row** their own grid
 * container, sharing only this template string, so those widths resolve per row
 * against that row's own content: on `/admin/reviews` 13 of 15 rows disagreed
 * with the header, the trailing action column was pushed to `right=1454` in a
 * 1440 viewport, and at 390 the document scrolled sideways.
 *
 * `minmax(0, …)` is what makes the template mean the same thing in every
 * container, and it is also what lets the cells' own `text-ellipsis` fire — a
 * track that grows to fit its content never overflows, so it never truncates.
 *
 * Applied here rather than in the six column specs on purpose: a new table, or
 * a new column on an existing one, cannot reintroduce the bug by declaring a
 * bare `fr`. The specs stay readable as the frame's own track list, which
 * `frame-13-parity.test.ts` reads back verbatim.
 *
 * **What this function does not do is the other half of the guard.** It floors
 * flexible tracks; it does not, and cannot, rescue an intrinsic sizing function
 * — `auto` and `min-content` would sail through untouched and size against each
 * row's content again. `TableTrack` is what keeps those unwritable, so the two
 * belong together: widening the type without widening this regex reopens #389.
 */
function resolveTrack(width: TableTrack): string {
  return FLEX_TRACK.test(width) ? `minmax(0, ${width})` : width;
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Rendered in place of the body when there is nothing to show. */
  empty: ReactNode;
  /**
   * Space below the last row, for a control floating over the table.
   *
   * The bulk-action bar floats so it does not displace rows — but floating
   * over the last two put their checkboxes and `···` under it, and a pane with
   * five pixels of scroll could not move them clear. This is what it scrolls
   * into.
   */
  scrollPadding?: boolean;
}

/**
 * The table frame `13 Admin` draws: `stone-0` on a `stone-300` hairline, 12px
 * radius, clipped.
 *
 * **The header is fixed and the body scrolls, not the page.** `sticky` on the
 * header row inside an `overflow-y-auto` body is what does it — a second scroll
 * container would put a scrollbar inside a rounded corner, and `position:fixed`
 * would take the header out of the grid it has to stay aligned with.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  scrollPadding = false,
}: DataTableProps<T>): React.ReactElement {
  // Joined once here; the header row and every body row read this one value.
  const template = columns.map((column) => resolveTrack(column.width)).join(' ');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-stone-300 bg-stone-0">
      {/*
        `pb-20` is measured, not chosen: the floating bulk bar sits at `bottom-4`
        (16px) and is 55px tall, so a row needs 71px of clearance to scroll past
        it. `pb-16` supplied 64 and left the last row's two 44px controls 5px
        under the bar — the glyphs were visible but `elementFromPoint` returned
        the bar, so the hit targets were 39px. Whoever changes the bar's height
        or offset changes this number with it.
      */}
      <div className={cn('min-h-0 flex-1 overflow-y-auto', scrollPadding && 'pb-20')}>
        <div
          role="table"
          className="min-w-full"
          style={{ ['--admin-table-columns' as string]: template }}
        >
          <div
            role="row"
            className="sticky top-0 z-10 grid items-center gap-3 border-b border-stone-300 bg-stone-100 px-4 py-2.5 text-label font-semibold tracking-label text-stone-600 uppercase grid-cols-(--admin-table-columns)"
          >
            {columns.map((column) => (
              <span
                role="columnheader"
                key={column.key}
                /*
                  The header truncates like a body cell does, and it has to for
                  the same reason the body does. Body cells always carried
                  `text-ellipsis` (below); the header carried nothing and was
                  silently propped up by the `min-content` floor on a bare
                  `<flex>` track — the very floor `resolveTrack` removes. With
                  the floor gone and nothing to truncate against, five of six
                  labels on `/admin/reviews` at 390 overprinted the next one:
                  `RATIN|VENDOR|AUTHOR|ABOUT`, `Rating` overflowing its 12.2px
                  track by 17.66px. Measured at 390 only — at 768 and above
                  every header cell's `scrollWidth` equals its `clientWidth`,
                  which is why nothing showed at the widths the frame draws.

                  `truncate`, not the body's `overflow-clip` pair: the
                  `[overflow-clip-margin:6px]` there exists to let a focused
                  control's ring escape its cell, and a header label is static
                  text with nothing to focus.
                */
                className={cn('truncate', column.headerClassName)}
              >
                {column.header}
              </span>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-10">{empty}</div>
          ) : (
            rows.map((row, index) => (
              <div
                role="row"
                key={rowKey(row)}
                className={cn(
                  /*
                    `box-content`, and `text-action`. The frame's row is 44px of
                    content **plus** its 1px separator — `.side`-style
                    content-box, like every other measurement in that file — so
                    a border-box `h-11` rendered the pitch a pixel short. The
                    body step is 13px (`text-action`), not the 13.5px
                    `text-base` default.
                  */
                  'grid box-content h-11 items-center gap-3 border-b border-stone-150 px-4 text-action text-stone-700 grid-cols-(--admin-table-columns)',
                  // Zebra on `stone-25`, the one surface between `stone-0` and `stone-50`.
                  index % 2 === 1 && 'bg-stone-25',
                )}
              >
                {columns.map((column) => (
                  <span
                    role="cell"
                    key={column.key}
                    /*
                      `overflow-clip`, not `overflow-hidden`.
                      `overflow-clip-margin` **only applies to `overflow: clip`**
                      — on `hidden` it is silently ignored, which is why the
                      first attempt at this changed nothing. The margin is what
                      lets a focus ring out: a ring is drawn outside the
                      element's box and each control fills its cell exactly, so
                      under `hidden` three of four sides were cut and a focused
                      row link rendered as a single clay hairline.

                      A column may opt out entirely with `overflow-visible`,
                      which the select column does — its track is 22px and its
                      control needs a taller target than that box.
                    */
                    className={cn(
                      'overflow-clip text-ellipsis whitespace-nowrap [overflow-clip-margin:6px]',
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </span>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
