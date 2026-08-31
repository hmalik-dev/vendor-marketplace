'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { DataTable } from '@/components/admin/data-table';
import { RowTrigger } from '@/components/admin/row-trigger';
import { EmptyState } from '@/components/ui/empty-state';
import { useApi } from '@/lib/use-api';
import type { WireAdminReviewRow } from '@/lib/wire-schemas';

const REVIEWED = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `DELETE` answers 204 with an empty body, which `apiRequest` hands back as `null`. */
const NO_CONTENT = z.null();

export function ReviewTable({
  rows,
  filtered,
}: {
  rows: readonly WireAdminReviewRow[];
  filtered: boolean;
}): React.ReactElement {
  const router = useRouter();
  const call = useApi();

  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.id}
      empty={
        <EmptyState
          headline={filtered ? 'No reviews of that kind' : 'No reviews yet'}
          description={
            filtered
              ? 'Clear the filter to see every review.'
              : 'A review can only be written after a booking has been completed.'
          }
        />
      }
      columns={[
        {
          key: 'rating',
          width: '.5fr',
          header: 'Rating',
          className: 'font-mono text-stone-900',
          // The number, not stars: an ops table is scanned and sorted, not admired.
          cell: (row) => `${row.rating}/5`,
        },
        {
          key: 'vendor',
          width: '1.3fr',
          header: 'Vendor',
          className: 'truncate font-semibold text-stone-900',
          cell: (row) => (
            <Link href={`/vendors/${row.vendorSlug}`} className="hover:underline">
              {row.vendorName}
            </Link>
          ),
        },
        { key: 'author', width: '1.3fr', header: 'Author', cell: (row) => row.authorName },
        {
          key: 'content',
          width: '2.4fr',
          header: 'Review',
          cell: (row) => row.title ?? row.content,
        },
        {
          key: 'written',
          width: '.9fr',
          header: 'Written',
          cell: (row) => REVIEWED.format(row.createdAt),
        },
        {
          key: 'actions',
          width: '70px',
          header: '',
          className: 'flex justify-end',
          cell: (row) => (
            <ConfirmAction
              destructive
              trigger={
                <RowTrigger label={`Delete the review of ${row.vendorName} by ${row.authorName}`} />
              }
              title="Delete this review?"
              description={
                <>
                  It is removed permanently and{' '}
                  <strong className="font-semibold">{row.vendorName}</strong>&rsquo;s rating is
                  recalculated from the reviews that remain. There is no undo.
                </>
              }
              confirmLabel="Delete review"
              onConfirm={async () => {
                await call(`/admin/reviews/${row.id}`, { method: 'DELETE', schema: NO_CONTENT });
                router.refresh();
              }}
            />
          ),
        },
      ]}
    />
  );
}
