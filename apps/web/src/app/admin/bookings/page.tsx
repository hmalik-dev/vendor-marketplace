import Link from 'next/link';
import { ADMIN_BOOKING_FLAGS, BOOKING_STATUSES, formatPrice } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { BookingsTabs } from '@/components/admin/bookings-tabs';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { FilteredEmpty, type ActiveFilter } from '@/components/admin/filtered-empty';
import { OutOfRange } from '@/components/admin/out-of-range';
import { StatusPill } from '@/components/ui/status-pill';
import { BOOKING_PRESENTATION } from '@/lib/booking-entries';
import { getAdminBookings } from '@/lib/admin-data';
import {
  adminQueryString,
  boundedText,
  droppedKeys,
  oneOf,
  pageNumber,
  type RawParam,
} from '@/lib/admin-params';

const PATH = '/admin/bookings';

/** The one flag's label, so the filter option and the row pill cannot drift. */
const REFUND_STUCK_LABEL = 'Refund did not go through';

const EVENT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: RawParam; flag?: RawParam; q?: RawParam; page?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const status = oneOf(raw.status, BOOKING_STATUSES);
  const flag = oneOf(raw.flag, ADMIN_BOOKING_FLAGS);
  const q = boundedText(raw.q);
  const dropped = droppedKeys(raw, { status, flag });
  const params = { status, flag, q };
  const bookings = await getAdminBookings(
    adminQueryString({ ...params, page: pageNumber(raw.page) }),
  );
  /*
   * One place the empty states are chosen, so headline and description cannot
   * fall out of step — and **both** filters are read, not just the flag.
   *
   * `refund-stuck` is only ever `confirmed`, so pairing it with any other
   * status returns nothing by construction, and that pairing is two clicks
   * away because each select carries the other. Branching on the flag alone
   * answered it with "Every booking on a suspended account has been unwound."
   * — told to an admin with stuck refunds one click away.
   */
  const named = [status && BOOKING_PRESENTATION[status].label, flag && REFUND_STUCK_LABEL].filter(
    Boolean,
  );
  const withFilters = named.length > 0 ? ` and ${named.join(' and ')}` : '';
  const empty = q
    ? {
        headline: `No bookings match "${q}"${withFilters}`,
        description: 'Search by booking id, customer name or email, or vendor.',
      }
    : flag && status
      ? {
          headline: 'No bookings match both filters',
          description: `A stuck refund is always ${BOOKING_PRESENTATION.confirmed.label.toLowerCase()}. Clear the status to see them.`,
        }
      : flag
        ? {
            headline: 'No refunds are stuck',
            description: 'Every booking on a closed or suspended account has been unwound.',
          }
        : status
          ? {
              headline: 'No bookings with that status',
              description: 'Clear the filter to see every booking.',
            }
          : {
              headline: 'No bookings yet',
              description: 'A booking appears here the moment a customer pays.',
            };

  /*
   * The counted ways out (#454). Two filters, and the pairing that produces
   * nothing by construction — `refund-stuck` is always `confirmed`, so any
   * other status with it returns zero — is exactly where a counted widening
   * earns itself: dropping the status is the route that pays, and the number
   * says so before the admin clicks.
   */
  const filtered = Boolean(status ?? flag ?? q);
  // Rows exist, this page is just past them: not "no bookings", and not filtered-empty.
  const pastEnd = bookings.items.length === 0 && bookings.total > 0;
  const active: ActiveFilter[] = [
    { key: 'status', widening: 'Any status', carried: { flag, q } },
    { key: 'flag', widening: 'Any booking', carried: { status, q } },
    { key: 'q', widening: 'Clear the search', carried: { status, flag } },
  ].filter((filter) => params[filter.key as keyof typeof params] !== undefined);

  return (
    <AdminSurface
      heading="Bookings"
      tabs={<BookingsTabs current="bookings" />}
      counts={[`${bookings.total} total`]}
      dropped={dropped}
      filters={
        <FilterBar
          action={PATH}
          params={params}
          searchPlaceholder="Search booking, customer or vendor…"
          searchValue={q}
        >
          <FilterSelect
            action={PATH}
            name="status"
            label="Status"
            value={status ?? ''}
            options={BOOKING_STATUSES.map((value) => ({
              value,
              label: BOOKING_PRESENTATION[value].label,
            }))}
          />
          {/*
            The one state the console could not find (#415). A ban refunds each
            confirmed booking before cancelling it and skips one Stripe
            refuses, which leaves a confirmed booking on a suspended account —
            announced once, in component state, over the vendors table, and
            gone on the next navigation.
          */}
          <FilterSelect
            action={PATH}
            name="flag"
            label="Needs attention"
            value={flag ?? ''}
            options={[{ value: 'refund-stuck', label: REFUND_STUCK_LABEL }]}
          />
        </FilterBar>
      }
      pager={{
        path: PATH,
        params,
        page: bookings.page,
        pageSize: bookings.pageSize,
        total: bookings.total,
      }}
    >
      <DataTable
        rows={bookings.items}
        rowKey={(row) => row.id}
        empty={
          pastEnd ? (
            <OutOfRange
              path={PATH}
              params={params}
              page={bookings.page}
              pageSize={bookings.pageSize}
              total={bookings.total}
            />
          ) : filtered ? (
            <FilteredEmpty
              headline={empty.headline}
              path={PATH}
              filters={active}
              widenings={bookings.widenings}
            />
          ) : (
            <EmptyState headline={empty.headline} description={empty.description} />
          )
        }
        columns={[
          {
            key: 'vendor',
            width: '1.6fr',
            header: 'Vendor',
            className: 'font-semibold text-stone-900',
            cell: (row) => (
              <Link href={`/admin/vendors/${row.vendorId}`} className="hover:underline">
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
            // local-time read moves it a day for anyone west of UTC. The row's
            // way into its money story (VEN-399).
            cell: (row) => (
              <Link href={`/admin/bookings/${row.id}`} className="hover:underline">
                {EVENT_DATE.format(new Date(`${row.eventDate}T00:00:00Z`))}
              </Link>
            ),
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
          {
            key: 'attention',
            width: '1.2fr',
            header: 'Needs attention',
            /*
              Marked on every row rather than only inside the filter, so an
              admin scanning the table finds these without having to already
              know the filter exists — which is the whole failure this replaces.
            */
            cell: (row) =>
              row.refundStuck ? (
                <StatusPill tone="failed">{REFUND_STUCK_LABEL}</StatusPill>
              ) : (
                <span className="text-stone-600">—</span>
              ),
          },
        ]}
      />
    </AdminSurface>
  );
}
