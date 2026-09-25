import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
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
 * First, last, the current page and one neighbor each side; a gap of one page
 * is filled with its number (an ellipsis for a single page saves nothing), a
 * wider gap is an ellipsis.
 */
function pageWindow(current: number, lastPage: number): (number | 'gap')[] {
  const wanted = new Set([1, lastPage, current - 1, current, current + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= lastPage).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  pages.forEach((n, i) => {
    const prev = pages[i - 1];
    if (prev !== undefined && n - prev === 2) {
      out.push(prev + 1);
    } else if (prev !== undefined && n - prev > 2) {
      out.push('gap');
    }
    out.push(n);
  });
  return out;
}

const CONTROL =
  'inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-md border text-sm font-semibold';
const LIVE = 'border-stone-300 bg-stone-0 text-stone-900 hover:bg-stone-150';
const DISABLED = 'border-stone-200 bg-stone-0 text-stone-500';

/** Previous or next; a null `href` draws the disabled twin so the control does not jump. */
function Step({
  href,
  direction,
}: {
  href: string | null;
  direction: 'prev' | 'next';
}): ReactElement {
  const isPrev = direction === 'prev';
  const Chevron = isPrev ? ChevronLeft : ChevronRight;
  const className = cn(
    CONTROL,
    href === null ? DISABLED : LIVE,
    isPrev ? 'pr-2.5 pl-1.5' : 'pr-1.5 pl-2.5',
  );
  const content = (
    <>
      {isPrev ? <Chevron aria-hidden className="size-4" /> : null}
      {isPrev ? 'Previous' : 'Next'}
      {isPrev ? null : <Chevron aria-hidden className="size-4" />}
    </>
  );

  if (href === null) {
    return (
      <span role="link" aria-disabled="true" className={className}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} rel={direction} className={className}>
      {content}
    </Link>
  );
}

/**
 * Previous, numbered pages and next, with the window and total stated — in the
 * title row.
 *
 * The nav is exactly the heading's 30px box tall and never wraps, so it does not
 * move the count line beside it (the pane keeps the frame's fifteen rows at
 * 1440x900). Previous and next are always drawn and go `aria-disabled` at the
 * ends, so the control does not jump. Everything is a real link: it works with
 * JavaScript off. Below 1280px the numbers collapse to "Page 3 of 14".
 *
 * Renders nothing when everything fits on one page — a pager under six rows is
 * furniture. Every link carries the current filters, because a pager that
 * drops them takes the admin from "page 2 of the flagged vendors" to "page 2
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
  const current = Math.min(page, lastPage);
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const to = (n: number): string => href(path, params, pageParam, n);

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex h-[30px] shrink-0 items-center gap-3 whitespace-nowrap', className)}
    >
      <p className={cn('text-sm text-stone-600', pastEnd ? '' : 'hidden xl:block')}>
        {pastEnd ? 'Past the last page' : `${first}–${last} of ${total}`}
      </p>
      <span className="flex items-center gap-1">
        <Step href={page > 1 ? to(Math.min(page - 1, lastPage)) : null} direction="prev" />
        {pastEnd ? null : (
          <span className="text-sm text-stone-600 xl:hidden">{`Page ${page} of ${lastPage}`}</span>
        )}
        <span className="hidden items-center gap-1 xl:flex">
          {pageWindow(current, lastPage).map((n, i) =>
            n === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden className="px-1 text-sm text-stone-500">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={to(n)}
                aria-current={n === page ? 'page' : undefined}
                className={cn(
                  CONTROL,
                  'min-w-7 px-2',
                  n === page ? 'border-clay-400 bg-clay-400 text-stone-0' : LIVE,
                )}
              >
                {n}
              </Link>
            ),
          )}
        </span>
        <Step href={page < lastPage ? to(page + 1) : null} direction="next" />
      </span>
    </nav>
  );
}
