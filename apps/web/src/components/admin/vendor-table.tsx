'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminBanResultSchema, type AdminVendorStatus } from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { RowTrigger } from '@/components/admin/row-trigger';
import { DataTable } from '@/components/admin/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { displayRating } from '@/lib/admin-params';
import { useApi } from '@/lib/use-api';
import type { WireAdminVendorRow } from '@/lib/wire-schemas';

/**
 * The four statuses frame `13` draws, mapped onto the shared pill vocabulary in
 * `03-components.md` rather than onto four new colours. Every value here is a
 * token pair the frame already uses:
 *
 * | Status  | Frame fill / text   | Shared tone |
 * | ------- | ------------------- | ----------- |
 * | Live    | `#EDF0E9` `#4B5940` | `confirmed` |
 * | Review  | `#F5EEDC` `#7A5A12` | `pending`   |
 * | Flagged | `#F7E7E0` `#8E3F20` | `needsYou`  |
 * | Paused  | `#EFE9E0` `#6B6459` | `inert`     |
 */
const STATUS_PILLS: Record<AdminVendorStatus, { tone: StatusTone; label: string }> = {
  live: { tone: 'confirmed', label: 'Live' },
  review: { tone: 'pending', label: 'Review' },
  flagged: { tone: 'needsYou', label: 'Flagged' },
  paused: { tone: 'inert', label: 'Paused' },
};

/**
 * What a suspension does, in one place.
 *
 * The bulk bar and the row control both name the consequence, and a destructive
 * dialog that describes the same action two different ways is how an operator
 * learns not to read them. `subject` is the only word that legitimately differs
 * — one dialog is about several accounts, the other about one.
 */
function SuspensionConsequence({ subject }: { subject: string }): React.ReactElement {
  return (
    <>
      Their open requests are declined and every confirmed booking in the future is cancelled and{' '}
      <strong className="font-semibold">refunded in full</strong>. {subject} comes down. Suspension
      can be lifted, but the bookings are not restored.
    </>
  );
}

export interface VendorTableProps {
  rows: readonly WireAdminVendorRow[];
  /** True when a filter is applied, so the empty state can say which kind of empty this is. */
  filtered: boolean;
}

export function VendorTable({ rows, filtered }: VendorTableProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const selectedRows = rows.filter((row) => selected.has(row.userId));
  /*
   * A vendor already flagged is already suspended. Offering them in a bulk
   * suspend would send a request the API answers 409, so they are excluded from
   * the count the dialog names as well as from the loop.
   */
  const suspendable = selectedRows.filter((row) => row.status !== 'flagged');

  function toggle(userId: string, checked: boolean): void {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(userId);
      } else {
        next.delete(userId);
      }

      return next;
    });
  }

  async function setBanned(userId: string, banned: boolean): Promise<void> {
    await call(`/admin/users/${userId}/${banned ? 'ban' : 'unban'}`, {
      method: 'PUT',
      schema: adminBanResultSchema,
    });
  }

  return (
    <div className="relative h-full min-h-0">
      {/*
        Bulk actions appear only when rows are selected (`22-admin.md`). A bar
        that is always present, greyed out, teaches an operator to ignore it.

        It **floats over** the table rather than sitting above it. Displacing
        the table cost two of the fifteen rows the frame fits — in the very
        state frame `13` draws, which shows a checked row and all fifteen rows
        with no bar between them.
      */}
      {selectedRows.length > 0 ? (
        <div className="absolute inset-x-4 bottom-4 z-20 flex items-center gap-3 rounded-lg border border-stone-300 bg-stone-0 px-4 py-2.5 shadow-md">
          <p className="text-meta font-semibold text-stone-900">{selectedRows.length} selected</p>
          <ConfirmAction
            destructive
            trigger={
              <button
                type="button"
                disabled={suspendable.length === 0}
                className="ml-auto rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-2 text-meta font-semibold text-error-500 hover:bg-stone-150 disabled:opacity-50"
              >
                Suspend selected
              </button>
            }
            title={`Suspend ${suspendable.length} ${suspendable.length === 1 ? 'account' : 'accounts'}?`}
            description={<SuspensionConsequence subject="A published storefront" />}
            confirmLabel="Suspend accounts"
            onConfirm={async () => {
              /*
               * Serial, not `Promise.all`. Each ban issues Stripe refunds and
               * writes notifications, and firing ten of those concurrently at
               * the payment provider is how a bulk action becomes a rate-limit
               * failure halfway through with no record of where it stopped.
               */
              for (const row of suspendable) {
                await setBanned(row.userId, true);
              }
              setSelected(new Set());
              router.refresh();
            }}
          />
        </div>
      ) : null}

      <DataTable
        scrollPadding={selectedRows.length > 0}
        rows={rows}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            headline={filtered ? 'No vendors match those filters' : 'No vendors yet'}
            description={
              filtered
                ? 'Clear a filter to widen the search.'
                : 'Vendors appear here as soon as they create a storefront.'
            }
          />
        }
        columns={[
          {
            key: 'select',
            width: '22px',
            header: '',
            // No clip: the 22px track would cut the box and its focus ring.
            className: 'overflow-visible',
            cell: (row) => (
              /*
                A `<label>` wrapping the input, not a bare 14px control.
                `border-*` and `rounded-*` are inert on a native checkbox —
                `appearance: auto` draws the OS square and ignores both — so the
                frame's 14px `1.3px #D5CEC2` box was never rendered.
                `appearance-none` with the frame's own border draws it, and the
                label supplies the 44x44 target `04-laws.md` requires without
                growing the glyph.
              */
              /*
                22 x 44, and that is the frame's ceiling rather than a choice.
                Frame `13` gives this column a **22px** track with the box at its
                left edge, so a 44px-wide target cannot exist here without
                overlapping the business name. The label takes the full row
                height, which is the axis that was free.
              */
              <label className="flex h-11 w-full cursor-pointer items-center justify-start">
                <span className="sr-only">Select {row.businessName}</span>
                <input
                  type="checkbox"
                  checked={selected.has(row.userId)}
                  onChange={(event) => toggle(row.userId, event.currentTarget.checked)}
                  className="size-3.5 appearance-none rounded-[4px] border-[1.3px] border-stone-400 bg-stone-0 checked:border-clay-400 checked:bg-clay-400 checked:after:block checked:after:text-center checked:after:text-[9px] checked:after:leading-[12px] checked:after:text-stone-0 checked:after:content-['✓']"
                />
              </label>
            ),
          },
          {
            key: 'business',
            width: '1.6fr',
            header: 'Business',
            className: 'font-semibold text-stone-900',
            cell: (row) => (
              <Link href={`/vendors/${row.slug}`} className="hover:underline">
                {row.businessName}
              </Link>
            ),
          },
          {
            key: 'category',
            width: '1.1fr',
            header: 'Category',
            cell: (row) => row.categoryName ?? '—',
          },
          { key: 'city', width: '1fr', header: 'City', cell: (row) => row.city ?? '—' },
          {
            key: 'rating',
            width: '.7fr',
            header: 'Rating',
            cell: (row) => displayRating(row) ?? '—',
          },
          { key: 'bookings', width: '.8fr', header: 'Bookings', cell: (row) => row.bookingsCount },
          {
            key: 'status',
            width: '.9fr',
            header: 'Status',
            cell: (row) => (
              <StatusPill tone={STATUS_PILLS[row.status].tone}>
                {STATUS_PILLS[row.status].label}
              </StatusPill>
            ),
          },
          {
            key: 'actions',
            width: '70px',
            header: '',
            // The control fills the cell and pushes its glyph to the right edge,
            // where the frame draws it — a 44px button centred in a 70px cell
            // put the dots 20px left of the frame's.
            className: 'flex justify-end overflow-visible',
            cell: (row) => {
              /*
                One control, two decisions. The branch is over the props rather
                than over two near-identical elements — the consequence copy is
                the part that must not drift, and it had already drifted once
                between here and the bulk bar above.
              */
              const flagged = row.status === 'flagged';

              return (
                <ConfirmAction
                  destructive={!flagged}
                  trigger={
                    <RowTrigger
                      label={
                        flagged
                          ? `Lift the suspension on ${row.businessName}`
                          : `Suspend ${row.businessName}`
                      }
                    />
                  }
                  title={
                    flagged
                      ? `Lift the suspension on ${row.businessName}?`
                      : `Suspend ${row.businessName}?`
                  }
                  description={
                    flagged ? (
                      'They can sign in again straight away. Their storefront stays unpublished until they publish it themselves, and the bookings cancelled by the suspension are not restored.'
                    ) : (
                      <SuspensionConsequence subject="Their storefront" />
                    )
                  }
                  confirmLabel={flagged ? 'Lift suspension' : 'Suspend account'}
                  onConfirm={async () => {
                    await setBanned(row.userId, !flagged);
                    router.refresh();
                  }}
                />
              );
            },
          },
        ]}
      />
    </div>
  );
}
