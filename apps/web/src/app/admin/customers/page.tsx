import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';
import { Pager } from '@/components/admin/pager';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { adminQueryString, getAdminCustomers } from '@/lib/admin-data';
import { boundedText, pageNumber } from '@/lib/admin-params';

const PATH = '/admin/customers';

const JOINED = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const q = boundedText(raw.q);
  const customers = await getAdminCustomers(adminQueryString({ q, page: pageNumber(raw.page) }));

  return (
    <AdminSurface
      heading="Customers"
      counts={[`${customers.total} total`]}
      filters={
        <FilterBar action={PATH} searchPlaceholder="Search name or email…" searchValue={q} />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <DataTable
            template="1.4fr 1.6fr 1.2fr .8fr 1fr"
            rows={customers.items}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                headline={q ? 'No customers match that search' : 'No customers yet'}
                description={
                  q
                    ? 'Try a different name or email.'
                    : 'Customers appear here as soon as they create an account.'
                }
              />
            }
            columns={[
              {
                key: 'name',
                header: 'Name',
                className: 'truncate font-semibold text-stone-900',
                cell: (row) => `${row.firstName} ${row.lastName}`.trim(),
              },
              { key: 'email', header: 'Email', cell: (row) => row.email },
              {
                key: 'location',
                header: 'Location',
                cell: (row) => [row.city, row.state].filter(Boolean).join(', ') || '—',
              },
              { key: 'bookings', header: 'Bookings', cell: (row) => row.totalBookingsCount },
              {
                key: 'status',
                header: 'Status',
                cell: (row) =>
                  row.isBanned ? (
                    <StatusPill tone="needsYou">Flagged</StatusPill>
                  ) : (
                    <span className="text-stone-600">Joined {JOINED.format(row.createdAt)}</span>
                  ),
              },
            ]}
          />
        </div>
        <Pager
          path={PATH}
          params={{ q }}
          page={customers.page}
          pageSize={customers.pageSize}
          total={customers.total}
        />
      </div>
    </AdminSurface>
  );
}
