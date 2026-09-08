'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPrice } from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { DataTable } from '@/components/admin/data-table';
import { Banner, type BannerStatus } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import {
  BOOKING_PRESENTATION,
  PAYOUT_FAILING_LABEL,
  PAYOUT_PRESENTATION,
} from '@/lib/booking-entries';
import { useApi } from '@/lib/use-api';
import {
  wireAdminPayoutRetryResultSchema,
  type WireAdminPaymentRow,
  type WireAdminPayoutRetryResult,
} from '@/lib/wire-schemas';

const PAID_AT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Whether this row's payout can be forced by hand.
 *
 * A cancelled booking's residual is genuinely owed and genuinely failing, so
 * the row keeps its flag — but the service refuses to release it on an
 * operator's say-so, because D31 rewrote the amount after the fact and the
 * scheduled sweep is what pays it. A button whose only outcome is a 409
 * teaches an operator to distrust the whole column.
 */
export function canRetryPayout(row: WireAdminPaymentRow): boolean {
  return row.payoutFailing && row.status !== 'cancelled';
}

/**
 * What a retry answered, in the operator's words — and in the banner tone the
 * outcome earns, rather than one neutral grey for all three.
 *
 * A `failed` retry is a successful *request*: the attempt was made, recorded
 * and counted. The outcome is the whole point of pressing the button, so it is
 * reported rather than swallowed — an operator shown a closed dialog and an
 * unchanged row has learned nothing, which is the state #432 opens with.
 *
 * **Every branch names the vendor.** The filter exists to put several failing
 * rows on screen at once, so "Stripe refused it again" is a sentence about no
 * particular row — and it would still be sitting there, reading as the answer,
 * if the next retry threw before `setNotice` ran.
 */
export function retryNotice(
  row: WireAdminPaymentRow,
  result: WireAdminPayoutRetryResult,
): { status: BannerStatus; message: string } {
  /*
   * The **state** is read before the outcome, and that order is the point.
   *
   * A retry whose claim found the row already locked comes back `busy` — but
   * the thing holding the lock may have been the scheduled sweep releasing this
   * very payout, or a dispute landing on it. Reporting the outcome first would
   * put "the scheduled release is already working this payout" beside a row
   * that has just redrawn as Released, or promise a release that a hold has now
   * cancelled. What happened to the money is the answer; `busy` only says who
   * did it.
   */
  if (result.payoutStatus === 'released') {
    return {
      status: 'settled',
      message: `${row.vendorName} has been paid ${formatPrice(row.vendorPayoutCents)}.`,
    };
  }

  if (result.payoutStatus === 'held') {
    return {
      status: 'pending',
      message: `A problem was reported on ${row.vendorName}'s booking, so the payout is on hold.`,
    };
  }

  if (result.outcome === 'busy') {
    return {
      status: 'informational',
      message: `The scheduled release is already working ${row.vendorName}'s payout. Check back in a few minutes.`,
    };
  }

  return {
    status: 'failed',
    message: `Stripe refused ${row.vendorName}'s transfer again: ${
      result.payoutFailureReason ?? 'no reason given'
    }. That is attempt ${result.payoutAttempts}.`,
  };
}

export interface PaymentTableProps {
  rows: readonly WireAdminPaymentRow[];
  empty: { headline: string; description: string };
  /**
   * The counted filtered-empty state (#454), supplied by the page.
   *
   * Here rather than built in this component because the words on the widening
   * button are the screen's copy. The true empty below stays this component's.
   */
  filteredEmpty?: React.ReactNode;
}

/**
 * The Payments table, and the one action it offers.
 *
 * A client component because of that action alone — the retry moves money, so
 * it goes through the same `AlertDialog` every other consequential console
 * control does (`22-admin.md`), and the row has to redraw from the answer
 * afterwards.
 */
export function PaymentTable({
  rows,
  empty,
  filteredEmpty,
}: PaymentTableProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  /** What the last retry answered, so a `busy` or `failed` result is not silent. */
  const [notice, setNotice] = useState<ReturnType<typeof retryNotice> | null>(null);

  async function retry(row: WireAdminPaymentRow): Promise<void> {
    /*
     * Cleared first, so a previous row's answer cannot be read as this one's.
     * `ConfirmAction` holds its dialog open when the call throws, and the
     * `setNotice` below never runs on that path — which would otherwise leave
     * the last banner standing above a table the operator has just acted on
     * again, naming a different vendor.
     */
    setNotice(null);

    const result = await call(`/admin/bookings/${row.bookingId}/payout/retry`, {
      method: 'PUT',
      schema: wireAdminPayoutRetryResultSchema,
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
        empty={
          filteredEmpty ?? <EmptyState headline={empty.headline} description={empty.description} />
        }
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
          { key: 'customer', width: '1.2fr', header: 'Customer', cell: (row) => row.customerName },
          {
            key: 'total',
            width: '.9fr',
            header: 'Total',
            className: 'font-mono',
            cell: (row) => formatPrice(row.totalAmountCents),
          },
          {
            key: 'fee',
            width: '.8fr',
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
            width: '1.8fr',
            header: 'Payout state',
            /*
              The column this screen did not have (#432): a booking whose money
              reached the platform and never reached the vendor read exactly
              like one that settled. The flag is drawn on every row, not only
              under the filter, for the same reason the Bookings table draws
              `refund-stuck` everywhere — the failure #415 fixed was a state you
              had to already know about in order to find.

              **The retry lives in this cell rather than in a column of its
              own.** A ninth column cost the money columns width they need:
              `DataTable`'s grid floors at a measured 739px below `lg`, and
              spending a tenth of that pool on a control shown on two rows in
              six left `Fee` too narrow for `$1,450.00` in `font-mono`. The
              control belongs to this state anyway — it is only ever offered
              where the pill beside it is red.
            */
            cell: (row) =>
              row.payoutFailing ? (
                <span className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    <StatusPill tone="failed">{PAYOUT_FAILING_LABEL}</StatusPill>
                    {canRetryPayout(row) ? (
                      <ConfirmAction
                        trigger={
                          <Button variant="secondary" size="sm">
                            Retry payout
                          </Button>
                        }
                        title="Retry this payout?"
                        description={
                          <>
                            Another attempt will be made to send{' '}
                            {formatPrice(row.vendorPayoutCents)} to {row.vendorName}. It is a fresh
                            request rather than a repeat of the last one, so Stripe answers it anew.
                            The scheduled release keeps retrying either way — this only asks now.
                          </>
                        }
                        confirmLabel="Retry payout"
                        onConfirm={() => retry(row)}
                      />
                    ) : null}
                  </span>
                  <span className="text-meta text-stone-600">
                    {row.payoutAttempts} {row.payoutAttempts === 1 ? 'attempt' : 'attempts'}
                    {row.payoutFailureReason ? ` · ${row.payoutFailureReason}` : ''}
                  </span>
                </span>
              ) : (
                <StatusPill tone={PAYOUT_PRESENTATION[row.payoutStatus].tone}>
                  {PAYOUT_PRESENTATION[row.payoutStatus].label}
                </StatusPill>
              ),
          },
        ]}
      />
    </div>
  );
}
