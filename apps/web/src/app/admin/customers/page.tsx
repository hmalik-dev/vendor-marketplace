import Link from 'next/link';
import {
  ADMIN_CUSTOMER_STATUSES,
  ADMIN_CUSTOMER_STATUS_LABELS,
  type AdminCustomerStatus,
} from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { FilteredEmpty, type ActiveFilter } from '@/components/admin/filtered-empty';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
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

const JOINED = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The two statuses that draw a pill, and the tones are the frame's own (#450).
 *
 * `Flagged` keeps `needsYou`, which is what frame `13` spends on a flagged
 * account on the vendors table. `Closed` takes `inert` — the vocabulary's
 * "this account is not trading", the same tone `vendor-table.tsx` gives
 * `Retired` for the same state — and is told apart by its label rather than by
 * a colour nobody specified. Minting a token pair here would be inventing
 * design, which is the plan's job and not this ticket's.
 *
 * `active` is deliberately absent: that row prints its join date, which is the
 * more useful fact and what the screen has always shown. A pill reading
 * `Active` on every row would say nothing and crowd out the one that does.
 */
const STATUS_TONES: Partial<Record<AdminCustomerStatus, StatusTone>> = {
  flagged: 'needsYou',
  closed: 'inert',
};

type SearchParams = Record<'q' | 'status' | 'page', RawParam>;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Partial<SearchParams>>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const params = {
    q: boundedText(raw.q),
    status: oneOf(raw.status, ADMIN_CUSTOMER_STATUSES),
  };
  // What was in the URL and could not be used, so the screen can say so.
  const dropped = droppedKeys(raw, params);
  const customers = await getAdminCustomers(
    adminQueryString({ ...params, page: pageNumber(raw.page) }),
  );

  const closedView = params.status === 'closed';

  /*
   * The counted ways out (#454), and the `status` one is a **toggle** rather
   * than a dropped parameter.
   *
   * `role = 'customer'` is the screen's domain rather than a filter — widening
   * past it would list vendors on a screen about customers — so it is not
   * offered. `status` is: this screen has two domains, live accounts and closed
   * ones, and no URL spanning both, so the only honest route is to the other
   * one. From the default view that route is **into** the closed set, which is
   * the whole of #450: an operator searching a name after that person closed
   * their account gets an empty list, and the row they want is one query string
   * away with nothing on the screen saying so.
   *
   * `q` is only a route when it is set. The API drops a zero-count route, and a
   * `q` that is already absent reveals exactly the rows already on screen —
   * none — so it drops itself; this list says so rather than relying on that.
   */
  const active: ActiveFilter[] = [
    ...(params.q === undefined
      ? []
      : [
          {
            key: 'q',
            widening: 'Any name or email',
            carried: { ...params, q: undefined },
          },
        ]),
    {
      key: 'status',
      widening: closedView ? 'Live accounts' : 'Closed accounts',
      carried: { ...params, status: closedView ? undefined : 'closed' },
    },
  ];

  /*
   * One sentence, assembled from the filters that are set — and the words are
   * the labels the filter bar showed, never the parameter values.
   */
  const filteredHeadline = [
    'No',
    ...(params.status ? [ADMIN_CUSTOMER_STATUS_LABELS[params.status].toLowerCase()] : []),
    'customers',
    ...(params.q ? [`matching "${params.q}"`] : []),
  ].join(' ');

  return (
    <AdminSurface
      heading="Customers"
      counts={[`${customers.total} total`]}
      dropped={dropped}
      filters={
        <FilterBar action={PATH} searchPlaceholder="Search name or email…" searchValue={params.q}>
          {/*
            The control #450 exists for.

            `/admin/users/[userId]` — the export, the retained counts and the
            legal acceptance record — is reachable from this table and by direct
            URL and nowhere else, so before this there was no way to navigate to
            a closed account's data-rights page at all. Every reason to open one
            arrives *after* the closure and none of them carries a uuid.
          */}
          <FilterSelect
            action={PATH}
            carried={params}
            name="status"
            label="Status"
            value={params.status ?? ''}
            options={ADMIN_CUSTOMER_STATUSES.map((status) => ({
              value: status,
              label: ADMIN_CUSTOMER_STATUS_LABELS[status],
            }))}
            /*
              Named, not `Any status`. Clearing this parameter lands on live
              accounts, and `Closed` is one of the choices in the same list — so
              a control reading "Any status" would take an operator looking at
              closed accounts to a set those accounts are not in, silently. That
              is #450's own symptom, one click from #450's fix.
            */
            anyLabel="Live accounts"
          />
          {/*
            The dropdown navigates on choice, so it is outside the form's submit
            path — without this hidden field, pressing Enter in the search box
            would silently clear the status the operator had chosen.
          */}
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
        </FilterBar>
      }
      pager={{
        path: PATH,
        params,
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
           * Filtered means the operator asked something. A bare
           * `/admin/customers` on a platform with no customers is the true
           * empty, and `filtered-empty.tsx` is explicit that it must not be
           * used as one — its counted routes would offer moves that cannot
           * help.
           */
          params.q !== undefined || params.status !== undefined ? (
            <FilteredEmpty
              headline={filteredHeadline}
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
             * The way into the data-rights page (#438). A subject-access or
             * closure request arrives naming a person, and this table is where
             * an operator finds them — so the name is the link rather than a
             * second control in a column nobody would look in.
             *
             * It is a link on a closed row too (#450), and that is the whole
             * ticket: the page is what answers "did closure do what it
             * promised", and the account being gone is the reason to ask.
             */
            cell: (row) => (
              <Link href={`/admin/users/${row.id}`} className="hover:underline">
                {`${row.firstName} ${row.lastName}`.trim() || row.email}
              </Link>
            ),
          },
          { key: 'email', width: '1.6fr', header: 'Email', cell: (row) => row.email },
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
            cell: (row) => {
              const tone = STATUS_TONES[row.status];

              return tone ? (
                <StatusPill tone={tone}>{ADMIN_CUSTOMER_STATUS_LABELS[row.status]}</StatusPill>
              ) : (
                <span className="text-stone-600">Joined {JOINED.format(row.createdAt)}</span>
              );
            },
          },
        ]}
      />
    </AdminSurface>
  );
}
