import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The narrowest the grid may resolve to, in pixels — **measured, not chosen**.
 *
 * `30-responsive.md:31` gives Admin `768 → Horizontal scroll`, and a scroll
 * needs something to scroll: the tracks have to stop collapsing first. This is
 * the width the table resolves to at **1024**, the narrowest viewport that row
 * still draws as a table — `1024 − 235` for the rail (`--sidebar-admin-width`
 * on `box-content` with a 12px gutter each side and a 1px border) `− 48` for
 * `AdminSurface`'s `px-6` `− 2` for the table's own hairline. Measured on all
 * six admin tables on 2026-09-05; every one of them read 739.
 *
 * So the floor says: **no track ever resolves narrower than it does at 1024**,
 * the width the contract accepts. Above 1024 it never binds. Below, the rail
 * folds away and the available width jumps, so it first binds at a viewport of
 * ~789 and holds through 768 — which is precisely the band the contract asks to
 * scroll. Below 768 there is no table to floor; there is a card list.
 *
 * Raising it would put a scrollbar on 1024, which the contract draws without
 * one. Lowering it reopens the collapse. It is applied below `lg` only — see
 * the class that reads it.
 */
const TABLE_MIN_WIDTH_PX = 739;

/**
 * The smallest a control's box may be in the card list — `04-laws.md`'s target.
 *
 * The card gives a control the width its column declares, floored here. Without
 * a definite width the controls that fill their table cell with `w-full`
 * resolve that percentage against their own content and collapse: the reviews
 * delete button measured **4px wide** at 390. Without the floor, the 22px
 * select track would carry straight over from a geometry the frame imposed on
 * the desktop table and nothing imposes here.
 */
const CONTROL_TARGET_PX = 44;

/** A control's box in the card list: its declared track, never under the law. */
function controlWidth(width: TableTrack): string {
  const fixed = /^(\d*\.?\d+)px$/.exec(width);

  return fixed ? `max(${CONTROL_TARGET_PX}px, ${fixed[1]}px)` : `${CONTROL_TARGET_PX}px`;
}

/** A column with no header label is a control — a checkbox, a `···` trigger. */
function isControl<T>(column: DataTableColumn<T>): boolean {
  return column.header === '';
}

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
  /**
   * **Called twice per row** — once for the grid, once for the card list, since
   * both branches are rendered and CSS picks one. Keep it cheap and free of
   * side effects; hoist an `Intl` formatter to the module rather than building
   * one per call, as the six tables already do.
   */
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
 * header row inside an `overflow-auto` body is what does it — a second scroll
 * container would put a scrollbar inside a rounded corner, and `position:fixed`
 * would take the header out of the grid it has to stay aligned with.
 *
 * **Below 768 the same rows render as cards.** `30-responsive.md:31` — "Card
 * list, not a table". Both branches are in the DOM and CSS picks one, because
 * these tables render on the server and a width read in an effect would flash
 * the wrong branch first. The card list is derived from the same `columns`, so
 * a column added to a table arrives in both shapes at once and neither can be
 * forgotten: each labelled column becomes one `dt`/`dd` pair, and the control
 * columns keep their controls on a row of their own.
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-panel border border-stone-300 bg-stone-0">
      {/*
        `pb-20` is measured, not chosen: the floating bulk bar sits at `bottom-4`
        (16px) and is 55px tall, so a row needs 71px of clearance to scroll past
        it. `pb-16` supplied 64 and left the last row's two 44px controls 5px
        under the bar — the glyphs were visible but `elementFromPoint` returned
        the bar, so the hit targets were 39px. Whoever changes the bar's height
        or offset changes this number with it.
      */}
      <div className={cn('min-h-0 flex-1 overflow-auto', scrollPadding && 'pb-20')}>
        <div
          role="table"
          /*
            The floor applies **below `lg` only**, and that bound is not
            cosmetic. At 1024 the floor equals the pane's width exactly — but
            only where the vertical scrollbar is an overlay. A classic 15px
            scrollbar, which is every Chrome on Windows and Linux, takes that
            width out of the content box, and a full 15-row page always has one:
            `100%` would resolve to 724 and the floor would pin the grid at 739,
            putting a horizontal scrollbar on the width the frame draws without
            one. Above `lg` the floor is unnecessary anyway — 739 *is* the
            natural width there — so confining it costs nothing and makes the
            desktop composition provably untouched.

            Set as a custom property because a Tailwind class must be a literal
            the scanner can see, and the value is derived from a constant.
          */
          className="hidden min-w-full md:block max-lg:min-w-(--admin-table-min-width)"
          style={{
            ['--admin-table-columns' as string]: template,
            ['--admin-table-min-width' as string]: `max(100%, ${TABLE_MIN_WIDTH_PX}px)`,
          }}
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

          {rows.map((row, index) => (
            <div
              role="row"
              key={rowKey(row)}
              className={cn(
                /*
                  `box-content`, and `text-action`. The frame's row is 44px of
                  content **plus** its 1px separator — `.side`-style
                  content-box, like every other measurement in that file — so a
                  border-box `h-11` rendered the pitch a pixel short. The body
                  step is 13px (`text-action`), not the 13.5px `text-base`
                  default.
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
                    — on `hidden` it is silently ignored, which is why the first
                    attempt at this changed nothing. The margin is what lets a
                    focus ring out: a ring is drawn outside the element's box
                    and each control fills its cell exactly, so under `hidden`
                    three of four sides were cut and a focused row link rendered
                    as a single clay hairline.

                    A column may opt out entirely with `overflow-visible`, which
                    the select column does — its track is 22px and its control
                    needs a taller target than that box.
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
          ))}
        </div>

        {rows.length > 0 ? (
          <CardList columns={columns} rows={rows} rowKey={rowKey} />
        ) : (
          /*
            One empty state for both branches, below the table rather than
            inside it: at `md` and up the fixed header stays visible above it,
            which is what the screen did before the card list existed, and
            below `md` it is the whole of what renders.
          */
          <div className="px-4 py-10">{empty}</div>
        )}
      </div>
    </div>
  );
}

/**
 * The same rows below 768, as the card list `30-responsive.md:31` specifies.
 *
 * **Every column, none of them truncated.** A table cell elides because the
 * reader can widen the window or scroll the pane to see the rest; a card has
 * neither affordance, so a card that elides has simply lost the value. Each
 * labelled column becomes a `dt`/`dd` pair on a two-track grid — the label
 * column is capped rather than fixed, so a long label wraps instead of
 * squeezing the value it describes — and the values wrap.
 *
 * `dl` rather than seven `role="row"`s: below the breakpoint these are not rows
 * of a table any more, they are one record's fields, and a screen reader
 * announcing "row 3 of 15, column 4" for a stack of cards describes a grid the
 * reader cannot navigate.
 */
function CardList<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
}): React.ReactElement {
  // Partitioned here rather than by the caller: both halves are consumed three
  // lines apart, and `columns` on this component means what it means everywhere
  // else in the file.
  const fields = columns.filter((column) => !isControl(column));
  const controls = columns.filter(isControl);

  return (
    <ul className="md:hidden">
      {rows.map((row) => (
        <li
          key={rowKey(row)}
          className="border-b border-stone-150 px-4 py-3 text-action text-stone-700 last:border-b-0"
        >
          {controls.length > 0 ? (
            /*
              The controls take a row of their own, first at the start and last
              at the end — where the table puts them. `ml-auto` on the last one
              does both cases: a lone control (reviews, tags) goes to the end,
              and a pair (vendors) splits to the two edges.

              Each keeps its declared width rather than an equal share of the
              row. An equal share made the reviews card's only control a 308px
              button whose glyph sat at the right edge and whose hit area was
              the whole top strip — a tap on what reads as padding opened
              "Delete this review?".

              `column.className` is deliberately **not** applied. It is the body
              cell's override bucket and it carries table geometry as well as
              typography — `flex justify-end overflow-visible` on a 70px track —
              which means nothing in a card and fought the sizing above.
            */
            <div className="mb-2 flex items-center gap-3">
              {controls.map((column, index) => (
                <div
                  key={column.key}
                  className={cn(
                    'flex shrink-0 items-center justify-end',
                    index === controls.length - 1 && 'ml-auto',
                  )}
                  style={{ width: controlWidth(column.width) }}
                >
                  {column.cell(row)}
                </div>
              ))}
            </div>
          ) : null}
          <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
            {fields.map((column) => (
              <Fragment key={column.key}>
                <dt className="text-label font-semibold tracking-label text-stone-600 uppercase">
                  {column.header}
                </dt>
                {/* The column's typography, without the table's truncation. */}
                <dd className={cn('min-w-0 break-words', column.className)}>{column.cell(row)}</dd>
              </Fragment>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
