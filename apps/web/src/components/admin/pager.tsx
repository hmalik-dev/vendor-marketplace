import Link from 'next/link';
import { adminQueryString } from '@/lib/admin-params';
import { cn } from '@/lib/utils';

export interface PagerProps {
  /** The surface's own path, without a query. */
  path: string;
  /** Every filter currently applied, so paging does not silently clear them. */
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
  /** The query key this pager walks, for a surface with two paged tables. */
  pageParam?: string;
  className?: string;
}

/** The same emptiness rule the filter links use — see `adminQueryString`. */
function href(
  path: string,
  params: Record<string, string | undefined>,
  pageParam: string,
  page: number,
): string {
  return `${path}${adminQueryString({ ...params, [pageParam]: page })}`;
}

/**
 * Previous and next, with the window stated — in the title row.
 *
 * `first–last` rather than `first–last of total`, because the count line beside
 * it already says the total and repeating it is two numbers for one fact.
 *
 * Renders nothing when everything fits on one page — a pager under six rows is
 * furniture. Both controls carry the current filters, because a pager that
 * drops them takes the operator from "page 2 of the flagged vendors" to "page 2
 * of everything" without saying so.
 */
export function Pager({
  path,
  params,
  page,
  pageSize,
  total,
  pageParam = 'page',
  className,
}: PagerProps): React.ReactElement | null {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  if (lastPage <= 1) {
    return null;
  }

  /*
   * A page past the end has no window to state: `first` would exceed `last`
   * ("1486–16"). Say so, and let Previous land on the last page that has rows.
   */
  const pastEnd = page > lastPage;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className={cn('flex shrink-0 items-center gap-2.5', className)}>
      <p className="text-sm text-stone-600">
        {pastEnd ? 'Past the last page' : `${first}–${last}`}
      </p>
      <span className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link
            href={href(path, params, pageParam, Math.min(page - 1, lastPage))}
            rel="prev"
            className="rounded-md border border-stone-300 bg-stone-0 px-2.5 py-1 text-sm font-semibold text-stone-900 hover:bg-stone-150"
          >
            Previous
          </Link>
        ) : null}
        {page < lastPage ? (
          <Link
            href={href(path, params, pageParam, page + 1)}
            rel="next"
            className="rounded-md border border-stone-300 bg-stone-0 px-2.5 py-1 text-sm font-semibold text-stone-900 hover:bg-stone-150"
          >
            Next
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
