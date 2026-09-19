import { Button } from '@/components/ui/button';

export interface SearchPaginationProps {
  /** The page the result on screen answers, 1-based. */
  page: number;
  pageSize: number;
  /** Every match, not the number on this page. */
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * Previous / next beneath the result grid. Absent while every match fits on the
 * first page, so a small marketplace draws exactly what it drew before.
 *
 * The bounds come from the response's own `total` and `pageSize`, never from a
 * constant, so a control can only ever open a page the API has vendors for.
 */
export function SearchPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: SearchPaginationProps): React.ReactElement | null {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount === 1) {
    return null;
  }

  return (
    <nav aria-label="Search results pages" className="mt-6 flex items-center justify-center gap-4">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span aria-live="polite" className="text-sm text-stone-700">
        Page {page} of {pageCount}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
