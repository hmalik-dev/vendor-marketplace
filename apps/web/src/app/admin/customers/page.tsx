import Link from 'next/link';
import { ADMIN_CUSTOMER_FLAGS, ADMIN_CUSTOMER_STATUSES } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { FilteredEmpty, type ActiveFilter } from '@/components/admin/filtered-empty';
import { StatusPill } from '@/components/ui/status-pill';
import { getAdminCustomers } from '@/lib/admin-data';
import {
  adminQueryString,
  boundedText,
  droppedKeys,
  oneOf,
  pageNumber,
  type RawParam,
} from '@/lib/admin-params';

const PATH = '/admin/customers';

/** The flag's label, so the filter option and the row pill cannot drift. */
const EMAIL_STALE_LABEL = 'Email out of date';

const JOINED = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: RawParam; status?: RawParam; flag?: RawParam; page?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const q = boundedText(raw.q);
  const parsedStatus = oneOf(raw.status, ADMIN_CUSTOMER_STATUSES);
  /*
   * Live accounts are the default set (VEN-382), so `status=live` is carried
   * exactly as its absence is: only `closed` reaches the API or the URL.
   */
  const status = parsedStatus === 'closed' ? parsedStatus : undefined;
  const flag = oneOf(raw.flag, ADMIN_CUSTOMER_FLAGS);
  const dropped = droppedKeys(raw, { q, status: parsedStatus, flag });
  const customers = await getAdminCustomers(
    adminQueryString({ q, status, flag, page: pageNumber(raw.page) }),
  );

  /*
   * Every filter is read, not just the search (#462). Pairing a search with
   * the flag is two clicks away and returns nothing whenever the person being
   * searched for is not one of the diverged accounts — and answering that with
   * "No customers match ada" would send an operator looking for a typo rather
   * than at the filter they left on.
   */
  const subject = status ? 'closed customers' : 'customers';
  let headline: string;
  if (q && flag) {
    headline = `No ${subject} match "${q}" with an out-of-date email`;
  } else if (flag) {
    headline = status
      ? 'No closed customers have an out-of-date email'
      : 'No addresses are out of date';
  } else if (q) {
    headline = `No ${subject} match "${q}"`;
  } else {
    headline = `No ${subject}`;
  }

  const filtered = q !== undefined || status !== undefined || flag !== undefined;

  /*
   * Built by spreading each filter in only when it is set, rather than by
   * filtering a fixed list on a key-conditional.
   *
   * `status` is toggled rather than dropped (VEN-382): no URL spans live and
   * closed accounts, so its route goes to the other set — and from a live-view
   * search that finds nobody, into the closed accounts it may be hiding.
   */
  const active: ActiveFilter[] = [
    ...(q === undefined
      ? []
      : [{ key: 'q', widening: 'Any name or email', carried: { status, flag } }]),
    ...(filtered
      ? [
          {
            key: 'status',
            widening: status ? 'Live accounts' : 'Closed accounts',
            carried: { q, status: status ? undefined : 'closed', flag },
          },
        ]
      : []),
    ...(flag === undefined
      ? []
      : [{ key: 'flag', widening: 'Any account', carried: { q, status } }]),
  ];

  return (
    <AdminSurface
      heading="Customers"
      counts={[`${customers.total} total`]}
      dropped={dropped}
      filters={
        <FilterBar
          action={PATH}
          params={{ q, status, flag }}
          searchPlaceholder="Search name or email…"
          searchValue={q}
        >
          {/*
            Closed accounts, asked for deliberately (VEN-382). No `Any status`
            choice: clearing the parameter lands on live accounts, which `Live`
            already names.
          */}
          <FilterSelect
            action={PATH}
            name="status"
            label="Status"
            value={status ?? ''}
            allowAny={false}
            options={[
              { value: 'live', label: 'Live' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
          {/*
            The state an operator could not find (#462). A `user.updated`
            carrying an address another account already holds cannot be
            written, so the row keeps the **old** address and every
            notification for it goes there. Nothing said so before this.
          */}
          <FilterSelect
            action={PATH}
            name="flag"
            label="Needs attention"
            value={flag ?? ''}
            options={[{ value: 'email-stale', label: EMAIL_STALE_LABEL }]}
          />
        </FilterBar>
      }
      pager={{
        path: PATH,
        params: { q, status, flag },
        page: customers.page,
        pageSize: customers.pageSize,
        total: customers.total,
      }}
    >
      <DataTable
        rows={customers.items}
        rowKey={(row) => row.id}
        empty={
          /*
           * Counted ways out (#454, widened by #462 and VEN-382).
           * `role = 'customer'` is the screen's domain rather than a filter, so
           * it is not offered: widening past it would list vendors.
           */
          filtered ? (
            <FilteredEmpty
              headline={headline}
              path={PATH}
              filters={active}
              widenings={customers.widenings}
            />
          ) : (
            <EmptyState
              headline="No customers yet"
              description="Customers appear here as soon as they create an account."
            />
          )
        }
        columns={[
          {
            key: 'name',
            width: '1.4fr',
            header: 'Name',
            className: 'font-semibold text-stone-900',
            /*
             * The way into the customer's record (VEN-400), and through its
             * Records card to the data-rights page (#438). A request arrives
             * naming a person, and this table is where an operator finds them —
             * so the name is the link rather than a second control in a column
             * nobody would look in, and the table itself is unchanged.
             */
            cell: (row) => (
              <Link href={`/admin/customers/${row.id}`} className="hover:underline">
                {`${row.firstName} ${row.lastName}`.trim() || row.email}
              </Link>
            ),
          },
          {
            key: 'email',
            width: '1.6fr',
            header: 'Email',
            /*
              Marked in the column it is about rather than in one of its own,
              and on every row rather than only inside the filter — an operator
              scanning the table finds these without having to already know the
              filter exists, which is the whole failure this replaces.

              Both addresses are printed because the repair needs both: the one
              mail is going to, and the one the auth provider says it should be going to.
            */
            cell: (row) =>
              row.pendingEmail === null ? (
                row.email
              ) : (
                <span className="flex flex-col gap-0.5">
                  <span>{row.email}</span>
                  <span className="flex items-center gap-1.5">
                    <StatusPill tone="failed">{EMAIL_STALE_LABEL}</StatusPill>
                    <span className="text-stone-600">{row.pendingEmail}</span>
                  </span>
                </span>
              ),
          },
          {
            key: 'location',
            width: '1.2fr',
            header: 'Location',
            cell: (row) => [row.city, row.state].filter(Boolean).join(', ') || '—',
          },
          {
            key: 'bookings',
            width: '.8fr',
            header: 'Bookings',
            cell: (row) => row.totalBookingsCount,
          },
          {
            key: 'status',
            width: '1fr',
            header: 'Status',
            /*
              Closed leads a ban: an account that is gone cannot be moderated.
              `inert` is the tone `Retired` takes on the vendors table.
            */
            cell: (row) =>
              row.isClosed ? (
                <StatusPill tone="inert">Closed</StatusPill>
              ) : row.isBanned ? (
                <StatusPill tone="needsYou">Flagged</StatusPill>
              ) : (
                <span className="text-stone-600">Joined {JOINED.format(row.createdAt)}</span>
              ),
          },
        ]}
      />
    </AdminSurface>
  );
}
