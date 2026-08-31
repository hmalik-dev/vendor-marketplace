import type { ReactNode } from 'react';
import { Pager, type PagerProps } from '@/components/admin/pager';
import { UpdatedAgo } from '@/components/admin/updated-ago';
import { droppedFiltersLine } from '@/lib/admin-params';

export interface AdminSurfaceProps {
  /** Serif 23px, per frame `13`. */
  heading: string;
  /**
   * The count line's leading clauses — "412 total", "38 awaiting review".
   * Every one is a query result read at request time; nothing here is invented.
   */
  counts: readonly string[];
  /** The Refine bar. */
  filters?: ReactNode;
  /**
   * Filters that were in the URL and could not be used.
   *
   * `web-route-boundaries.md` asks for a bad value to be dropped **and said** —
   * rendering the unfiltered list in silence tells an operator the platform
   * holds data it does not.
   */
  dropped?: readonly string[];
  /**
   * Rendered **in the title row**, not below the table.
   *
   * Frame `13` draws no pagination, so any is a deviation — and the version
   * that sat under the table took 45px out of the pane, which is one 44px row.
   * "Fifteen rows fit at 1440x900" is a stated acceptance criterion, and it
   * would have held only until the first page that needed a pager. The count
   * line already says how many rows there are in total.
   *
   * Beside the count line it costs **6px**, measured — not nothing, which is
   * what this comment claimed until a browser pass measured it. The `nav` is
   * 25px against the heading's 30px box, but it is `self-center` inside a
   * baseline-aligned wrapper whose top is pinned by the count line, so the row
   * grows from 30px to 36px. The pane goes from 5px short of fifteen rows to
   * 11px short; all fifteen remain reachable because the body scrolls, so the
   * acceptance criterion holds and this is a recorded composition delta rather
   * than a defect. Left as-is deliberately: the alignment here has already been
   * broken twice by fixes aimed at one pixel of baseline.
   */
  pager?: Omit<PagerProps, 'path'> & { path: string };
  /** The table, which fills the rest of the shell and scrolls inside itself. */
  children: ReactNode;
}

/**
 * The shell every console screen shares: title row, count line, filter bar, and
 * a table that fills what is left.
 *
 * `min-h-0` on the table region is what makes the internal scroll work — a flex
 * child defaults to `min-height: auto`, so without it the table grows to its
 * content and the *page* scrolls, which is the defect the frame's acceptance
 * list names first.
 */
export function AdminSurface({
  heading,
  counts,
  filters,
  dropped,
  pager,
  children,
}: AdminSurfaceProps): React.ReactElement {
  const ignored = droppedFiltersLine(dropped ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-4.5 pb-3.5">
        <div className="mb-3.5 flex items-baseline justify-between gap-4">
          <h1 className="display-heading text-[23px] text-stone-900">{heading}</h1>
          <div className="flex items-baseline gap-4">
            <p className="text-sm text-stone-600">
              {counts.join(' · ')}
              {counts.length > 0 ? ' · ' : null}
              <UpdatedAgo />
            </p>
            {/*
              `self-center`: the row aligns on the baseline, and a flex `nav`
              contributes its *first item's* baseline, which sat 1px below the
              heading's and moved the whole pane down by one pixel.
            */}
            {pager ? <Pager {...pager} className="self-center" /> : null}
          </div>
        </div>
        {filters}
        {ignored ? (
          <p role="status" className="mt-2 text-helper text-stone-600">
            {ignored}
          </p>
        ) : null}
      </div>

      {/*
        The `min-h-0 flex-1` pair is what makes the table scroll inside itself
        rather than the page — and it lives here rather than in each screen,
        because it was copied into five of them and the sixth would have got it
        wrong. Losing it is the defect the frame's acceptance list names first.

        Nothing else may sit in this box. The pager was here for one commit and
        cost the table 45px, which is one 44px row — so "fifteen rows fit"
        stopped being true at exactly the data volume that produces a pager.
        It lives in the title row above instead, where the frame leaves space.
      */}
      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-5">{children}</div>
    </div>
  );
}
