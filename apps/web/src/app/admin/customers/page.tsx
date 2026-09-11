import Link from 'next/link';
import {
  ADMIN_CUSTOMER_FLAGS,
  ADMIN_CUSTOMER_STATUSES,
  ADMIN_CUSTOMER_STATUS_LABELS,
  type AdminCustomerFlag,
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

/** The flag's label, so the filter option and the row pill cannot drift. */
const EMAIL_STALE_LABEL = 'Email out of date';

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

type SearchParams = Record<'q' | 'status' | 'flag' | 'page', RawParam>;

/**
 * The filtered-empty sentence, reciting the filters in the operator's own words.
 *
 * Three filters and therefore three clauses, assembled rather than enumerated —
 * but `flag` **on its own** keeps the sentence #462 wrote for it, because "No
 * customers with an out-of-date email" answers a question nobody asked. An
 * operator filtering for that fault wants to know whether the fault exists, not
 * whether customers do.
 */
function customersHeadline(
  status: AdminCustomerStatus | undefined,
  q: string | undefined,
  flag: AdminCustomerFlag | undefined,
): string {
  const subject =
    status === undefined
      ? 'customers'
      : `${ADMIN_CUSTOMER_STATUS_LABELS[status].toLowerCase()} customers`;

  if (q !== undefined) {
    return flag === undefined
      ? `No ${subject} match "${q}"`
      : `No ${subject} match "${q}" with an out-of-date email`;
  }

  if (flag !== undefined) {
    return status === undefined
      ? 'No addresses are out of date'
      : `No ${subject} have an out-of-date email`;
  }

  return `No ${subject}`;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Partial<SearchParams>>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const params = {
    q: boundedText(raw.q),
    status: oneOf(raw.status, ADMIN_CUSTOMER_STATUSES),
    flag: oneOf(raw.flag, ADMIN_CUSTOMER_FLAGS),
  };
  // What was in the URL and could not be used, so the screen can say so.
  const dropped = droppedKeys(raw, params);
  const customers = await getAdminCustomers(
    adminQueryString({ ...params, page: pageNumber(raw.page) }),
  );

  const closedView = params.status === 'closed';
  /*
   * Filtered means the operator asked something. A bare `/admin/customers` on a
   * platform with no customers is the **true** empty, and `filtered-empty.tsx`
   * is explicit that it must not be used as one: its counted routes would offer
   * moves that cannot help.
   */
  const filtered =
    params.q !== undefined || params.status !== undefined || params.flag !== undefined;

  /*
   * The counted ways out (#454, widened by #462 and #450), and the `status` one
   * is a **toggle** rather than a dropped parameter.
   *
   * `role = 'customer'` is the screen's domain rather than a filter — widening
   * past it would list vendors on a screen about customers — so it is not
   * offered. `status` is, and it cannot be *dropped*: this screen has two
   * domains, live accounts and closed ones, and no URL spanning both, so the
   * only honest route is to the other one. From the default view that route is
   * **into** the closed set, which is the whole of #450 — an operator searching
   * a name after that person closed their account gets an empty list, and the
   * row they want is one query string away with nothing on the screen saying so.
   *
   * `q` and `flag` are spread in only when set, rather than a fixed list
   * filtered on a key-conditional: that shape is only correct while there are
   * exactly two entries, and a third would silently take the last arm's value.
   */
  const active: ActiveFilter[] = !filtered
    ? []
    : [
        ...(params.q === undefined
          ? []
          : [{ key: 'q', widening: 'Any name or email', carried: { ...params, q: undefined } }]),
        {
          key: 'status',
          widening: closedView ? 'Live accounts' : 'Closed accounts',
          carried: { ...params, status: closedView ? undefined : 'closed' },
        },
        ...(params.flag === undefined
          ? []
          : [{ key: 'flag', widening: 'Any account', carried: { ...params, flag: undefined } }]),
      ];

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
            The state an operator could not find (#462). A `user.updated`
            carrying an address another account already holds cannot be
            written, so the row keeps the **old** address and every
            notification for it goes there. Nothing said so before this.
          */}
          <FilterSelect
            action={PATH}
            carried={params}
            name="flag"
            label="Needs attention"
            value={params.flag ?? ''}
            options={[{ value: 'email-stale', label: EMAIL_STALE_LABEL }]}
          />
          {/*
            Both dropdowns navigate on choice, so they sit outside the form's
            submit path. A GET form submits only its own controls — so without
            these hidden fields, pressing Enter in the search box would silently
            clear the status and the flag the operator had chosen and answer
            with every live customer, which is the opposite of what somebody
            filtering for a problem wants.
          */}
          {(['status', 'flag'] as const).map((key) =>
            params[key] ? <input key={key} type="hidden" name={key} value={params[key]} /> : null,
          )}
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
          filtered ? (
            <FilteredEmpty
              headline={customersHeadline(params.status, params.q, params.flag)}
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
              mail is going to, and the one Clerk says it should be going to.
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
