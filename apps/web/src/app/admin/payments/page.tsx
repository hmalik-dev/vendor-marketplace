import { formatPrice } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { Pager } from '@/components/admin/pager';
import { EmptyState } from '@/components/ui/empty-state';
import { adminQueryString, getAdminPayments } from '@/lib/admin-data';
import { pageNumber } from '@/lib/admin-params';

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
  searchParams: Promise<{ page?: string }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const payments = await getAdminPayments(adminQueryString({ page: pageNumber(raw.page) }));

  const feeTotal = payments.items.reduce((total, row) => total + row.platformFeeCents, 0);

  return (
    <AdminSurface
      heading="Payments"
      counts={[`${payments.total} paid`, `${formatPrice(feeTotal)} platform fee on this page`]}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <DataTable
            template="1.4fr 1.2fr .9fr .8fr .8fr 1.2fr"
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
                header: 'Vendor',
                className: 'truncate font-semibold text-stone-900',
                cell: (row) => row.vendorName,
              },
              { key: 'customer', header: 'Customer', cell: (row) => row.customerName },
              {
                key: 'total',
                header: 'Total',
                className: 'font-mono',
                cell: (row) => formatPrice(row.totalAmountCents),
              },
              {
                key: 'fee',
                header: 'Fee',
                className: 'font-mono',
                cell: (row) => formatPrice(row.platformFeeCents),
              },
              {
                key: 'payout',
                header: 'Payout',
                className: 'font-mono',
                cell: (row) => formatPrice(row.vendorPayoutCents),
              },
              {
                key: 'paid',
                header: 'Paid',
                cell: (row) => (row.paidAt ? PAID_AT.format(row.paidAt) : '—'),
              },
            ]}
          />
        </div>
        <Pager
          path={PATH}
          params={{}}
          page={payments.page}
          pageSize={payments.pageSize}
          total={payments.total}
        />
      </div>
    </AdminSurface>
  );
}
