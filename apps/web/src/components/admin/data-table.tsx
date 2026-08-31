import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
   */
  width: string;
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

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Rendered in place of the body when there is nothing to show. */
  empty: ReactNode;
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
}: DataTableProps<T>): React.ReactElement {
  // Joined once here; the header row and every body row read this one value.
  const template = columns.map((column) => column.width).join(' ');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-stone-300 bg-stone-0">
      <div className="min-h-0 flex-1 overflow-y-auto">
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
              <span role="columnheader" key={column.key} className={column.headerClassName}>
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
                      `overflow-clip-margin`, not a bare `truncate`.
                      `overflow: hidden` clipped the focus ring of every control
                      inside a cell — a ring is drawn outside the element's box,
                      and each control fills its cell exactly, so three of four
                      sides were cut and a focused row link rendered as a single
                      clay hairline. The margin keeps the ellipsis and lets the
                      ring out.
                    */
                    className={cn(
                      'overflow-hidden text-ellipsis whitespace-nowrap [overflow-clip-margin:6px]',
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
