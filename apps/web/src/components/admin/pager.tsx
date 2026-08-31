import Link from 'next/link';
import { adminQueryString } from '@/lib/admin-params';

export interface PagerProps {
  /** The surface's own path, without a query. */
  path: string;
  /** Every filter currently applied, so paging does not silently clear them. */
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}

/** The same emptiness rule the filter links use — see `adminQueryString`. */
function href(path: string, params: Record<string, string | undefined>, page: number): string {
  return `${path}${adminQueryString({ ...params, page })}`;
}

/**
 * Previous and next, with the window stated.
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
}: PagerProps): React.ReactElement | null {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  if (lastPage <= 1) {
    return null;
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className="flex shrink-0 items-center gap-4 pt-3">
      <p className="text-meta text-stone-600">
        {first}–{last} of {total}
      </p>
      <span className="ml-auto flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={href(path, params, page - 1)}
            rel="prev"
            className="rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-2 text-meta font-semibold text-stone-900 hover:bg-stone-150"
          >
            Previous
          </Link>
        ) : null}
        {page < lastPage ? (
          <Link
            href={href(path, params, page + 1)}
            rel="next"
            className="rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-2 text-meta font-semibold text-stone-900 hover:bg-stone-150"
          >
            Next
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
