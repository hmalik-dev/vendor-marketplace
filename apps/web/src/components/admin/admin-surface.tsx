import type { ReactNode } from 'react';
import { UpdatedAgo } from '@/components/admin/updated-ago';

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
  children,
}: AdminSurfaceProps): React.ReactElement {
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
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-5">{children}</div>
    </div>
  );
}
