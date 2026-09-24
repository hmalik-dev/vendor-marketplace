import Link from 'next/link';
import {
  ADMIN_REQUEST_GROUPS,
  BOOKING_REQUEST_STATUSES,
  LIVE_BOOKING_REQUEST_STATUSES,
  expiryCountdown,
  formatPrice,
  type AdminRequestGroup,
} from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { BookingsTabs } from '@/components/admin/bookings-tabs';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { FilteredEmpty, type ActiveFilter } from '@/components/admin/filtered-empty';
import { OutOfRange } from '@/components/admin/out-of-range';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { getAdminRequests } from '@/lib/admin-data';
import {
  adminQueryString,
  droppedKeys,
  oneOf,
  pageNumber,
  type RawParam,
} from '@/lib/admin-params';
import { formatEventDate, REQUEST_PRESENTATION } from '@/lib/booking-entries';
import { cn } from '@/lib/utils';
import type { WireAdminRequestRow } from '@/lib/wire-schemas';

/** Every row is a request-time read, and the countdown is measured against this render. */
export const dynamic = 'force-dynamic';

const PATH = '/admin/requests';

const GROUP_LABELS: Record<AdminRequestGroup, string> = {
  live: 'Live',
  closed: 'Closed',
  lapsed: 'Lapsed',
};

/** Pattern A: the countdown turns gold inside the last twelve hours. */
const URGENT_MS = 12 * 60 * 60 * 1000;

const DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The Expires cell. A countdown only while the request can still move; on the
 * other four statuses the date it was resolved, because a dead countdown is a
 * lie (Pattern A).
 */
function Expires({ row, now }: { row: WireAdminRequestRow; now: Date }): React.ReactElement {
  if (!LIVE_BOOKING_REQUEST_STATUSES.includes(row.status)) {
    return (
      <span className="text-stone-600">{row.resolvedAt ? DAY.format(row.resolvedAt) : '—'}</span>
    );
  }

  if (!row.expiresAt) {
    return <span className="text-stone-600">—</span>;
  }

  const urgent = row.expiresAt.getTime() - now.getTime() < URGENT_MS;

  return (
    <span className={urgent ? 'text-gold-600' : undefined}>
      {expiryCountdown(row.expiresAt, now)}
    </span>
  );
}

/**
 * `Bookings · Requests` (VEN-399) — the pre-payment funnel, every status.
 *
 * Frame `13`'s shell and table verbatim, with Pattern A's columns. The status on
 * each row is the status **as read**, lazy expiry applied by the API, so a
 * request past its window reads `Expired` here as it does to its customer.
 */
export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: RawParam; status?: RawParam; page?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const group = oneOf(raw.group, ADMIN_REQUEST_GROUPS);
  const status = oneOf(raw.status, BOOKING_REQUEST_STATUSES);
  const dropped = droppedKeys(raw, { group, status });
  const requests = await getAdminRequests(
    adminQueryString({ group, status, page: pageNumber(raw.page) }),
  );
  const now = new Date();

  const filtered = Boolean(group ?? status);
  const active: ActiveFilter[] = [
    { key: 'group', widening: 'Any group', carried: { status } },
    { key: 'status', widening: 'Any status', carried: { group } },
  ].filter((filter) => (filter.key === 'group' ? group : status) !== undefined);

  return (
    <AdminSurface
      heading="Bookings"
      tabs={<BookingsTabs current="requests" />}
      counts={[`${requests.total} ${requests.total === 1 ? 'request' : 'requests'}`]}
      dropped={dropped}
      filters={
        <FilterBar action={PATH} params={{ group, status }}>
          {/*
            Pattern A's segmented control: six statuses in three groups. Each
            segment is a link, so a group is a URL; the active one clears.
          */}
          <nav aria-label="Request group" className="flex rounded-full bg-stone-100 p-0.5">
            {ADMIN_REQUEST_GROUPS.map((value) => (
              <Link
                key={value}
                href={`${PATH}${adminQueryString({ group: value === group ? undefined : value, status })}`}
                aria-current={value === group ? 'true' : undefined}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium',
                  value === group
                    ? 'bg-stone-0 font-semibold text-stone-900'
                    : 'text-stone-700 hover:text-stone-900',
                )}
              >
                {GROUP_LABELS[value]}
              </Link>
            ))}
          </nav>
          <FilterSelect
            action={PATH}
            name="status"
            label="Status"
            value={status ?? ''}
            options={BOOKING_REQUEST_STATUSES.map((value) => ({
              value,
              label: REQUEST_PRESENTATION[value]?.label ?? value,
            }))}
          />
        </FilterBar>
      }
      pager={{
        path: PATH,
        params: { group, status },
        page: requests.page,
        pageSize: requests.pageSize,
        total: requests.total,
      }}
    >
      <DataTable
        rows={requests.items}
        rowKey={(row) => row.id}
        empty={
          requests.items.length === 0 && requests.total > 0 ? (
            <OutOfRange
              path={PATH}
              params={{ group, status }}
              page={requests.page}
              pageSize={requests.pageSize}
              total={requests.total}
            />
          ) : filtered ? (
            <FilteredEmpty
              headline="No requests match these filters"
              path={PATH}
              filters={active}
              widenings={requests.widenings}
            />
          ) : (
            <EmptyState
              headline="No requests yet"
              description="A request appears here the moment a customer sends one."
            />
          )
        }
        columns={[
          {
            key: 'vendor',
            width: '1.4fr',
            header: 'Vendor',
            className: 'font-semibold text-stone-900',
            cell: (row) => (
              <Link href={`/admin/vendors/${row.vendorId}`} className="hover:underline">
                {row.vendorName}
              </Link>
            ),
          },
          { key: 'customer', width: '1.2fr', header: 'Customer', cell: (row) => row.customerName },
          {
            key: 'date',
            width: '1fr',
            header: 'Event date',
            cell: (row) => formatEventDate(row.eventDate),
          },
          {
            key: 'quoted',
            width: '.8fr',
            header: 'Quoted',
            className: 'justify-end text-right font-mono tabular-nums',
            cell: (row) =>
              row.quotedPriceCents === null ? (
                <span className="text-stone-600">—</span>
              ) : (
                formatPrice(row.quotedPriceCents)
              ),
          },
          {
            key: 'expires',
            width: '.9fr',
            header: 'Expires',
            cell: (row) => <Expires row={row} now={now} />,
          },
          {
            key: 'status',
            width: '.9fr',
            header: 'Status',
            cell: (row) => {
              // The customer hub's words and tones: `quoted` is steel, as `03-components.md` rules.
              const presentation = REQUEST_PRESENTATION[row.status];

              return presentation ? (
                <StatusPill tone={presentation.tone}>{presentation.label}</StatusPill>
              ) : (
                row.status
              );
            },
          },
        ]}
      />
    </AdminSurface>
  );
}
