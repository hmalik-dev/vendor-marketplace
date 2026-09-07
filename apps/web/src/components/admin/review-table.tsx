'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import { adminReviewVisibilityResultSchema } from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { DataTable } from '@/components/admin/data-table';
import { RowMenu } from '@/components/admin/row-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
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
          className: 'font-semibold text-stone-900',
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
          /*
            The console is the only surface that still shows a hidden review, so
            it is the only surface that can say a review *is* hidden — without
            the marker, "Unhide review" names a state the operator cannot see.

            **"Hidden" and "Private" are different facts and the pill must not
            conflate them.** `is_public = false` on a review *of a vendor* means
            an operator hid it; on a vendor's note *about a customer* it means
            the author chose not to let other vendors read it. Labelling the
            second "Hidden" invited an operator to unhide something nobody had
            hidden.
          */
          cell: (row) => (
            <span className="flex items-center gap-2 overflow-hidden">
              {row.isPublic ? null : (
                <StatusPill tone="inert">
                  {row.type === 'customer_to_vendor' ? 'Hidden' : 'Private'}
                </StatusPill>
              )}
              <span className="md:truncate">{row.title ?? row.content}</span>
            </span>
          ),
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
          className: 'flex justify-end overflow-visible',
          cell: (row) => <ReviewRowActions row={row} onDone={() => router.refresh()} />,
        },
      ]}
    />
  );
}

/**
 * Hide, then — only if it must not persist at all — delete.
 *
 * The order in the menu is the order the ticket asks an operator to reach for
 * them (#435): hiding is the default response and deletion the escalation, so
 * the reversible action is first and the permanent one last and red.
 *
 * **Deletion is the only one offered on a vendor's private note about a
 * customer.** Hiding is scoped to reviews *of a vendor*, so its dialog can name
 * the storefront rating outright; the delete dialog still branches, because
 * deletion works on both directions and resolves a `vendor_to_customer` row
 * back to the *customer's* rating — naming the vendor there would tell an
 * operator they were correcting a storefront when they were not.
 */
function ReviewRowActions({
  row,
  onDone,
}: {
  row: WireAdminReviewRow;
  onDone: () => void;
}): React.ReactElement {
  const call = useApi();
  const [open, setOpen] = useState<'visibility' | 'delete' | null>(null);
  /*
    Only a review **of a vendor** can be hidden or shown. On a vendor's note
    about a customer, `is_public` is the author's own choice about who may read
    it — offering "Unhide review" there would publish a private note to every
    other vendor, and `seed-demo` writes every one of those notes private, so it
    was one click away on any demo database. The API refuses it too; this is the
    half that stops an operator being invited to try.
  */
  const moderable = row.type === 'customer_to_vendor';

  return (
    <RowMenu
      label={`Actions for the review of ${row.vendorName} by ${row.authorName}`}
      items={[
        ...(moderable
          ? [
              {
                key: 'visibility',
                label: row.isPublic ? 'Hide review' : 'Unhide review',
                onSelect: () => setOpen('visibility'),
              },
            ]
          : []),
        {
          key: 'delete',
          label: 'Delete review',
          destructive: true,
          onSelect: () => setOpen('delete'),
        },
      ]}
    >
      {(restoreFocus) => (
        <>
          {/*
        Mounted only while open. `DataTable` calls every `cell` twice — grid and
        card list — so two always-mounted `AlertDialog` roots per row is sixty
        portals on a fifteen-row page for a screen where one dialog can be open.
      */}
          {open === 'visibility' ? (
            <ConfirmAction
              open
              onOpenChange={(next) => setOpen(next ? 'visibility' : null)}
              restoreFocus={restoreFocus}
              /*
            Title and confirm label say the **same word** as the menu item that
            opened them. A menu offering "Unhide review" whose button then reads
            "Show review" makes an operator check they clicked the right thing —
            small, but this ticket's whole risk is an operator misreading which
            action they are about to take.
          */
              title={row.isPublic ? 'Hide this review?' : 'Unhide this review?'}
              description={
                row.isPublic ? (
                  <>
                    It comes off every public page and stops counting toward{' '}
                    <strong className="font-semibold">{row.vendorName}</strong>&apos;s rating, which
                    is recalculated without it. Nothing is deleted, and you can unhide it again from
                    here.
                  </>
                ) : (
                  <>
                    It goes back on every public page and counts toward{' '}
                    <strong className="font-semibold">{row.vendorName}</strong>&apos;s rating again.
                  </>
                )
              }
              confirmLabel={row.isPublic ? 'Hide review' : 'Unhide review'}
              onConfirm={async () => {
                await call(`/admin/reviews/${row.id}/visibility`, {
                  method: 'PUT',
                  body: { isPublic: !row.isPublic },
                  schema: adminReviewVisibilityResultSchema,
                });
                onDone();
              }}
            />
          ) : null}
          {open === 'delete' ? (
            <ConfirmAction
              destructive
              open
              onOpenChange={(next) => setOpen(next ? 'delete' : null)}
              restoreFocus={restoreFocus}
              title="Delete this review?"
              description={
                /*
            Whose rating moves depends on the direction, and the dialog has to
            say which. `deleteReviewAndRecalculate` resolves a
            `vendor_to_customer` review back to the *customer* through its
            booking — so naming the vendor there told the operator they were
            correcting a public storefront rating when they were changing a
            customer's private one.
          */
                row.type === 'customer_to_vendor' ? (
                  <>
                    It is removed permanently and{' '}
                    <strong className="font-semibold">{row.vendorName}</strong>&apos;s public rating
                    is recalculated from the reviews that remain. There is no undo —{' '}
                    <strong className="font-semibold">hide it instead</strong> if it might need to
                    come back.
                  </>
                ) : (
                  <>
                    This is a vendor&apos;s private review of a customer. Deleting it recalculates{' '}
                    <strong className="font-semibold">that customer&apos;s</strong> rating, not{' '}
                    {row.vendorName}&apos;s. There is no undo.
                  </>
                )
              }
              confirmLabel="Delete review"
              onConfirm={async () => {
                await call(`/admin/reviews/${row.id}`, { method: 'DELETE', schema: NO_CONTENT });
                onDone();
              }}
            />
          ) : null}
        </>
      )}
    </RowMenu>
  );
}
