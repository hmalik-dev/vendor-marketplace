import { ADMIN_PAYMENT_FLAGS, formatPrice } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { FilteredEmpty } from '@/components/admin/filtered-empty';
import { PaymentTable } from '@/components/admin/payment-table';
import { PAYOUT_FAILING_LABEL } from '@/lib/booking-entries';
import { getAdminPayments } from '@/lib/admin-data';
import {
  adminQueryString,
  droppedKeys,
  oneOf,
  pageNumber,
  type RawParam,
} from '@/lib/admin-params';

const PATH = '/admin/payments';

/**
 * Where the money went, per booking — and, since #432, whether it arrived.
 *
 * There is no `payments` table and this screen does not pretend otherwise: it
 * is the `bookings` rows that carry a payment intent, read for the money rather
 * than for the event. A second source would be a second answer.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ flag?: RawParam; page?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const flag = oneOf(raw.flag, ADMIN_PAYMENT_FLAGS);
  const dropped = droppedKeys(raw, { flag });
  const payments = await getAdminPayments(adminQueryString({ flag, page: pageNumber(raw.page) }));

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

  const empty = flag
    ? {
        headline: 'Every transfer has gone through',
        description: 'No payout has been attempted and failed.',
      }
    : {
        headline: 'No payments yet',
        description: "A payment appears here the moment a customer's card is charged.",
      };

  return (
    <AdminSurface
      heading="Payments"
      counts={[
        `${payments.total} paid`,
        `${formatPrice(feeTotal)} platform fee on this page, refunds excluded`,
      ]}
      dropped={dropped}
      filters={
        <FilterBar action={PATH} params={{ flag }}>
          {/*
            The state this screen could not show (#432). Both columns behind it
            were written by the release sweep and read by nothing, so a vendor
            owed money by a transfer failing every quarter of an hour generated
            no signal anywhere in the console.
          */}
          <FilterSelect
            action={PATH}
            carried={{}}
            name="flag"
            label="Needs attention"
            value={flag ?? ''}
            options={[{ value: 'payout-failing', label: PAYOUT_FAILING_LABEL }]}
          />
        </FilterBar>
      }
      pager={{
        path: PATH,
        params: { flag },
        page: payments.page,
        pageSize: payments.pageSize,
        total: payments.total,
      }}
    >
      <PaymentTable
        rows={payments.items}
        empty={empty}
        /*
         * One filter, so one counted way out (#454). `paid_at is not null` is
         * this screen's domain rather than a filter, so it is not offered:
         * widening past it would list bookings nobody has paid for on the
         * screen about payments.
         */
        filteredEmpty={
          flag ? (
            <FilteredEmpty
              headline={`No payments match "${PAYOUT_FAILING_LABEL}"`}
              path={PATH}
              filters={[{ key: 'flag', widening: 'Every payment', carried: {} }]}
              widenings={payments.widenings}
            />
          ) : undefined
        }
      />
    </AdminSurface>
  );
}
