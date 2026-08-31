import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { getAdminCustomers } from '@/lib/admin-data';
import { adminQueryString, boundedText, pageNumber, type RawParam } from '@/lib/admin-params';

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
  searchParams: Promise<{ q?: RawParam; page?: RawParam }>;
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
      pager={{
        path: PATH,
        params: { q },
        page: customers.page,
        pageSize: customers.pageSize,
        total: customers.total,
      }}
    >
      <DataTable
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
            width: '1.4fr',
            header: 'Name',
            className: 'font-semibold text-stone-900',
            cell: (row) => `${row.firstName} ${row.lastName}`.trim(),
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
            cell: (row) =>
              row.isBanned ? (
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
