import Link from 'next/link';
import { BOOKING_STATUSES, formatPrice, type BookingStatus } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { Pager } from '@/components/admin/pager';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { adminQueryString, getAdminBookings } from '@/lib/admin-data';
import { oneOf, pageNumber } from '@/lib/admin-params';

const PATH = '/admin/bookings';

const EVENT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The booking lifecycle on the shared pill vocabulary. `40-states.md` is the
 * law here: sage is settled, red is a failure, and neither is ever borrowed for
 * the other.
 */
const BOOKING_TONES: Record<BookingStatus, StatusTone> = {
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'failed',
  /*
   * Clay, not red. `needsYou` is the one tone reserved for "waiting on *this*
   * user" — and on the operator's own table that is exactly what a dispute is.
   * Red would say the booking failed, which a dispute has not yet done.
   */
  disputed: 'needsYou',
};

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const status = oneOf(raw.status, BOOKING_STATUSES);
  const bookings = await getAdminBookings(adminQueryString({ status, page: pageNumber(raw.page) }));

  return (
    <AdminSurface
      heading="Bookings"
      counts={[`${bookings.total} total`]}
      filters={
        <FilterBar action={PATH}>
          <FilterSelect
            name="status"
            label="Status"
            value={status ?? ''}
            options={BOOKING_STATUSES.map((status) => ({
              value: status,
              label: `${status.charAt(0).toUpperCase()}${status.slice(1)}`,
            }))}
          />
        </FilterBar>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <DataTable
            template="1.6fr 1.4fr 1fr .9fr .9fr"
            rows={bookings.items}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                headline={status ? 'No bookings with that status' : 'No bookings yet'}
                description={
                  status
                    ? 'Clear the filter to see every booking.'
                    : 'A booking appears here the moment a customer pays.'
                }
              />
            }
            columns={[
              {
                key: 'vendor',
                header: 'Vendor',
                className: 'truncate font-semibold text-stone-900',
                cell: (row) => (
                  <Link href={`/vendors/${row.vendorSlug}`} className="hover:underline">
                    {row.vendorName}
                  </Link>
                ),
              },
              { key: 'customer', header: 'Customer', cell: (row) => row.customerName },
              {
                key: 'date',
                header: 'Event date',
                // Parsed as UTC midnight: `eventDate` is a calendar date, and a
                // local-time read moves it a day for anyone west of UTC.
                cell: (row) => EVENT_DATE.format(new Date(`${row.eventDate}T00:00:00Z`)),
              },
              {
                key: 'total',
                header: 'Total',
                className: 'font-mono',
                cell: (row) => formatPrice(row.totalCents),
              },
              {
                key: 'status',
                header: 'Status',
                cell: (row) => (
                  <StatusPill tone={BOOKING_TONES[row.status as BookingStatus] ?? 'inert'}>
                    {row.status}
                  </StatusPill>
                ),
              },
            ]}
          />
        </div>
        <Pager
          path={PATH}
          params={{ status }}
          page={bookings.page}
          pageSize={bookings.pageSize}
          total={bookings.total}
        />
      </div>
    </AdminSurface>
  );
}
