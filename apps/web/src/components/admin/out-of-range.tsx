import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { adminQueryString } from '@/lib/admin-params';

export interface OutOfRangeProps {
  /** The surface's own path, without a query. */
  path: string;
  /** Every filter currently applied, so the way back keeps them. */
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}

/**
 * A page past the last one — rows match, this page just has none of them.
 *
 * Its own state rather than either empty state: "No bookings yet" and "No
 * payments match" both say there is nothing to see, beside a count line that
 * says otherwise. That is what an admin lands on after acting on the only
 * row of the last page and refreshing, or after pasting a stale `?page=`.
 */
export function OutOfRange({
  path,
  params,
  page,
  pageSize,
  total,
}: OutOfRangeProps): React.ReactElement {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <EmptyState
      headline={`Page ${page} is past the end`}
      description={`${total} ${total === 1 ? 'row matches' : 'rows match'}, on ${lastPage} ${lastPage === 1 ? 'page' : 'pages'}.`}
      action={
        <Link
          href={`${path}${adminQueryString(params)}`}
          className="inline-flex items-center rounded-lg border border-transparent bg-clay-400 px-4 py-2 text-base font-semibold text-stone-0 transition-colors duration-(--duration-fast) hover:bg-clay-500"
        >
          Back to page 1
        </Link>
      }
    />
  );
}
