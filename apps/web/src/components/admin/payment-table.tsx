'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  adminPayoutRetryResultSchema,
  formatPrice,
  type AdminPayoutRetryResult,
  type PayoutStatus,
} from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { DataTable } from '@/components/admin/data-table';
import { Banner, type BannerStatus } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { BOOKING_PRESENTATION } from '@/lib/booking-entries';
import { useApi } from '@/lib/use-api';
import type { WireAdminPaymentRow } from '@/lib/wire-schemas';

const PAID_AT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The three payout states, in the shared pill vocabulary — no fourth colour.
 *
 * `held` earns `needsYou` rather than `failed`: a dispute hold is deliberate
 * and correct, and painting it as a failure would tell an operator to fix
 * something that is working. The failing case is the separate flag below,
 * because it is a different fact — see `payoutFailing`.
 */
const PAYOUT_PILLS: Record<PayoutStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: 'pending', label: 'Awaiting release' },
  held: { tone: 'needsYou', label: 'Held' },
  released: { tone: 'confirmed', label: 'Released' },
};

/** The one flag's words, so the filter option and the row pill cannot drift. */
export const PAYOUT_FAILING_LABEL = 'Transfer failing';

/**
 * What a retry answered, in the operator's words — and in the banner tone the
 * outcome earns, rather than one neutral grey for all three.
 *
 * A `failed` retry is a successful *request*: the attempt was made, recorded and
 * counted. The outcome is the whole point of pressing the button, so it is
 * reported rather than swallowed — an operator shown a closed dialog and an
 * unchanged row has learned nothing, which is the state #432 opens with.
 */
function retryNotice(
  row: WireAdminPaymentRow,
  result: AdminPayoutRetryResult,
): { status: BannerStatus; message: string } {
  if (result.outcome === 'released') {
    return {
      status: 'settled',
      message: `${row.vendorName} has been paid ${formatPrice(row.vendorPayoutCents)}.`,
    };
  }

  if (result.outcome === 'busy') {
    return {
      status: 'informational',
      message: 'The scheduled release is already working this payout. Check back in a few minutes.',
    };
  }

  return {
    status: 'failed',
    message: `Stripe refused it again: ${result.payoutFailureReason ?? 'no reason given'}. That is attempt ${result.payoutAttempts}.`,
  };
}

export interface PaymentTableProps {
  rows: readonly WireAdminPaymentRow[];
  empty: { headline: string; description: string };
}

/**
 * The Payments table, and the one action it offers.
 *
 * A client component because of that action alone — the retry moves money, so
 * it goes through the same `AlertDialog` every other consequential console
 * control does (`22-admin.md`), and the row has to redraw from the answer
 * afterwards.
 */
export function PaymentTable({ rows, empty }: PaymentTableProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  /** What the last retry answered, so a `busy` or `failed` result is not silent. */
  const [notice, setNotice] = useState<ReturnType<typeof retryNotice> | null>(null);

  async function retry(row: WireAdminPaymentRow): Promise<void> {
    const result = await call(`/admin/bookings/${row.bookingId}/payout/retry`, {
      method: 'PUT',
      schema: adminPayoutRetryResultSchema,
    });

    /*
     * Reported above the table rather than thrown into `ConfirmAction`, which
     * holds its dialog open on a throw under a comment saying that an open
     * dialog means the action did nothing. This action did something.
     */
    setNotice(retryNotice(row, result));

    router.refresh();
  }

  return (
    <div className="h-full min-h-0">
      {notice ? (
        <Banner status={notice.status} className="mb-3">
          {notice.message}
        </Banner>
      ) : null}
      <DataTable
        rows={rows}
        rowKey={(row) => row.bookingId}
        empty={<EmptyState headline={empty.headline} description={empty.description} />}
        columns={[
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
          { key: 'customer', width: '1fr', header: 'Customer', cell: (row) => row.customerName },
          {
            key: 'total',
            width: '.8fr',
            header: 'Total',
            className: 'font-mono',
            cell: (row) => formatPrice(row.totalAmountCents),
          },
          {
            key: 'fee',
            width: '.7fr',
            header: 'Fee',
            className: 'font-mono',
            cell: (row) => formatPrice(row.platformFeeCents),
          },
          {
            key: 'payout',
            width: '.8fr',
            header: 'Payout',
            className: 'font-mono',
            cell: (row) => formatPrice(row.vendorPayoutCents),
          },
          {
            key: 'paid',
            width: '.9fr',
            header: 'Paid',
            cell: (row) => (row.paidAt ? PAID_AT.format(row.paidAt) : '—'),
          },
          {
            key: 'status',
            width: '.9fr',
            header: 'Status',
            /*
              Without it a refunded booking is indistinguishable from a live
              payment: same total, same fee, same payout, no pill. `paid_at` is
              never cleared by a cancellation, so the row legitimately stays —
              what it must not do is look like money the platform kept.
            */
            cell: (row) => (
              <StatusPill tone={BOOKING_PRESENTATION[row.status].tone}>
                {BOOKING_PRESENTATION[row.status].label}
              </StatusPill>
            ),
          },
          {
            key: 'payoutState',
            width: '1.3fr',
            header: 'Payout state',
            /*
              The column this screen did not have (#432): a booking whose money
              reached the platform and never reached the vendor read exactly
              like one that settled. The flag is drawn on every row, not only
              under the filter, for the same reason the Bookings table draws
              `refund-stuck` everywhere — the failure #415 fixed was a state you
              had to already know about in order to find.
            */
            cell: (row) =>
              row.payoutFailing ? (
                <span className="flex flex-col items-start gap-1">
                  <StatusPill tone="failed">{PAYOUT_FAILING_LABEL}</StatusPill>
                  <span className="text-meta text-stone-600">
                    {row.payoutAttempts} {row.payoutAttempts === 1 ? 'attempt' : 'attempts'}
                    {row.payoutFailureReason ? ` · ${row.payoutFailureReason}` : ''}
                  </span>
                </span>
              ) : (
                <StatusPill tone={PAYOUT_PILLS[row.payoutStatus].tone}>
                  {PAYOUT_PILLS[row.payoutStatus].label}
                </StatusPill>
              ),
          },
          {
            key: 'retry',
            width: '110px',
            header: '',
            /*
              Offered only where it can do something. The API refuses a
              released, disputed or cancelled payout with a specific message,
              and a button that exists to be refused teaches an operator to
              distrust the whole column.
            */
            cell: (row) =>
              row.payoutFailing ? (
                <ConfirmAction
                  trigger={
                    <Button variant="secondary" size="sm">
                      Retry payout
                    </Button>
                  }
                  title="Retry this payout?"
                  description={
                    <>
                      Another attempt will be made to send {formatPrice(row.vendorPayoutCents)} to{' '}
                      {row.vendorName}. It is a fresh request rather than a repeat of the last one,
                      so Stripe answers it anew. The scheduled release keeps retrying either way —
                      this only asks now.
                    </>
                  }
                  confirmLabel="Retry payout"
                  onConfirm={() => retry(row)}
                />
              ) : null,
          },
        ]}
      />
    </div>
  );
}
