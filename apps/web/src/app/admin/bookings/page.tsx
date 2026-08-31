import Link from 'next/link';
import { BOOKING_STATUSES, formatPrice } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { BOOKING_PRESENTATION } from '@/lib/booking-entries';
import { getAdminBookings } from '@/lib/admin-data';
import { adminQueryString, oneOf, pageNumber, type RawParam } from '@/lib/admin-params';

const PATH = '/admin/bookings';

const EVENT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: RawParam; page?: RawParam }>;
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
            options={BOOKING_STATUSES.map((value) => ({
              value,
              label: BOOKING_PRESENTATION[value].label,
            }))}
          />
        </FilterBar>
      }
      pager={{
        path: PATH,
        params: { status },
        page: bookings.page,
        pageSize: bookings.pageSize,
        total: bookings.total,
      }}
    >
      <DataTable
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
            width: '1.6fr',
            header: 'Vendor',
            className: 'truncate font-semibold text-stone-900',
            cell: (row) => (
              <Link href={`/vendors/${row.vendorSlug}`} className="hover:underline">
                {row.vendorName}
              </Link>
            ),
          },
          { key: 'customer', width: '1.4fr', header: 'Customer', cell: (row) => row.customerName },
          {
            key: 'date',
            width: '1fr',
            header: 'Event date',
            // Parsed as UTC midnight: `eventDate` is a calendar date, and a
            // local-time read moves it a day for anyone west of UTC.
            cell: (row) => EVENT_DATE.format(new Date(`${row.eventDate}T00:00:00Z`)),
          },
          {
            key: 'total',
            width: '.9fr',
            header: 'Total',
            className: 'font-mono',
            cell: (row) => formatPrice(row.totalCents),
          },
          {
            key: 'status',
            width: '.9fr',
            header: 'Status',
            cell: (row) => (
              /*
                  The same words and the same tone the customer sees on their
                  own bookings. A console that painted `cancelled` red where
                  the customer saw it grey would be two products describing
                  one row.
                */
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
