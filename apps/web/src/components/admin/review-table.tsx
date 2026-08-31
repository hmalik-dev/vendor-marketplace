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
          key: 'direction',
          width: '.9fr',
          header: 'About',
          /*
            A `vendor_to_customer` row lists the vendor as both author and
            vendor, because `reviews.reviewer_id` is the vendor's own account —
            so without this column the two directions are indistinguishable.
          */
          cell: (row) => (row.type === 'customer_to_vendor' ? 'The vendor' : 'The customer'),
        },
        {
          key: 'content',
          width: '1.9fr',
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
                /*
                  Whose rating moves depends on the direction, and the dialog has
                  to say which. `deleteReviewAndRecalculate` resolves a
                  `vendor_to_customer` review back to the *customer* through its
                  booking — so naming the vendor there told the operator they
                  were correcting a public storefront rating when they were
                  changing a customer's private one.
                */
                row.type === 'customer_to_vendor' ? (
                  <>
                    It is removed permanently and{' '}
                    <strong className="font-semibold">{row.vendorName}</strong>&rsquo;s public
                    rating is recalculated from the reviews that remain. There is no undo.
                  </>
                ) : (
                  <>
                    This is a vendor&rsquo;s private review of a customer. Deleting it recalculates{' '}
                    <strong className="font-semibold">that customer&rsquo;s</strong> rating, not{' '}
                    {row.vendorName}&rsquo;s. There is no undo.
                  </>
                )
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
