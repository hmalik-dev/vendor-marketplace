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
  /** Rendered below the table when there is more than one page. */
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
          <p className="text-meta text-stone-600">
            {counts.join(' · ')}
            {counts.length > 0 ? ' · ' : null}
            <UpdatedAgo />
          </p>
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
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5">
        <div className="min-h-0 flex-1">{children}</div>
        {pager ? <Pager {...pager} /> : null}
      </div>
    </div>
  );
}
