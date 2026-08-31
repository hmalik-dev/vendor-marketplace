import { formatPrice } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { BOOKING_PRESENTATION } from '@/lib/booking-entries';
import { getAdminPayments } from '@/lib/admin-data';
import { adminQueryString, pageNumber, type RawParam } from '@/lib/admin-params';

const PATH = '/admin/payments';

const PAID_AT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Where the money went, per booking.
 *
 * There is no `payments` table and this screen does not pretend otherwise: it
 * is the `bookings` rows that carry a payment intent, read for the money rather
 * than for the event. A second source would be a second answer.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const payments = await getAdminPayments(adminQueryString({ page: pageNumber(raw.page) }));

  /*
   * Cancelled bookings are excluded from the sum, and carry a pill saying so.
   *
   * `cancelBooking` never clears `paid_at`, so a fully refunded booking stays
   * on this list — correctly, because the money did move and an operator has to
   * be able to find it. What was wrong was counting it: the Overview's Revenue
   * card excludes cancelled bookings, so the same dollar read as taken here and
   * given back there, on two screens one person compares.
   */
  const feeTotal = payments.items
    .filter((row) => row.status !== 'cancelled')
    .reduce((total, row) => total + row.platformFeeCents, 0);

  return (
    <AdminSurface
      heading="Payments"
      counts={[
        `${payments.total} paid`,
        `${formatPrice(feeTotal)} platform fee on this page, refunds excluded`,
      ]}
      pager={{
        path: PATH,
        params: {},
        page: payments.page,
        pageSize: payments.pageSize,
        total: payments.total,
      }}
    >
      <DataTable
        rows={payments.items}
        rowKey={(row) => row.bookingId}
        empty={
          <EmptyState
            headline="No payments yet"
            description="A payment appears here the moment a customer's card is charged."
          />
        }
        columns={[
          {
            key: 'vendor',
            width: '1.4fr',
            header: 'Vendor',
            className: 'font-semibold text-stone-900',
            cell: (row) => row.vendorName,
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
            width: '1fr',
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
        ]}
      />
    </AdminSurface>
  );
}
