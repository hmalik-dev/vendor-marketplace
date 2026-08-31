import { MAX_PAGE_SIZE } from '@vendor-marketplace/shared';
import type { NextRequest } from 'next/server';
import { getAdminVendors } from '@/lib/admin-data';
import { getCurrentUser } from '@/lib/current-user';
import type { WireAdminVendorRow } from '@/lib/wire-schemas';

/** Reads live accounts; never cached. */
export const dynamic = 'force-dynamic';

/** How many pages the export will walk before it stops asking. */
const MAX_PAGES = 50;

const COLUMNS = [
  'Business',
  'Slug',
  'Category',
  'City',
  'State',
  'Rating',
  'Reviews',
  'Bookings',
  'Status',
  'Payouts connected',
  'Created',
] as const;

/**
 * RFC 4180 quoting on every field, unconditionally.
 *
 * Quoting only the fields that "need" it is how a business name with a comma in
 * it shifts every column after it by one — and a spreadsheet does not complain,
 * it just shows the wrong city. A leading `=`, `+`, `-` or `@` is additionally
 * prefixed with a tab, because a spreadsheet reads those as a formula: this is
 * a file of user-supplied business names, and CSV injection is the one way an
 * export of untrusted text becomes code on the operator's machine.
 */
function csvField(value: string | number | null): string {
  const raw = value === null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `\t${raw}` : raw;

  return `"${safe.replaceAll('"', '""')}"`;
}

function csvRow(row: WireAdminVendorRow): string {
  return [
    csvField(row.businessName),
    csvField(row.slug),
    csvField(row.categoryName),
    csvField(row.city),
    csvField(row.state),
    csvField(row.reviewCount === 0 ? '' : Number(row.avgRating).toFixed(1)),
    csvField(row.reviewCount),
    csvField(row.bookingsCount),
    csvField(row.status),
    csvField(row.stripeOnboarded ? 'yes' : 'no'),
    csvField(row.createdAt.toISOString().slice(0, 10)),
  ].join(',');
}

/**
 * The frame's `Export CSV`, as the whole filtered set rather than the page on
 * screen.
 *
 * Exporting only the visible page would be the surprising half of a control
 * that looks like it exports the table. The filters travel with it, so what
 * comes out is exactly what the operator was looking at.
 *
 * **This route handler authorizes itself.** A layout does not run for a route
 * handler, so `/admin/layout.tsx`'s `requireRole('admin')` never sees this
 * request — leaving it out would have made the one admin URL that returns bulk
 * data the one that was not role-gated.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const filters = new URLSearchParams(request.nextUrl.search);
  filters.delete('page');
  filters.set('pageSize', String(MAX_PAGE_SIZE));

  const lines: string[] = [COLUMNS.map((column) => csvField(column)).join(',')];
  let page = 1;
  let total = 0;

  do {
    filters.set('page', String(page));
    const result = await getAdminVendors(`?${filters.toString()}`);
    total = result.total;

    for (const row of result.items) {
      lines.push(csvRow(row));
    }

    page += 1;
  } while ((page - 1) * MAX_PAGE_SIZE < total && page <= MAX_PAGES);

  return new Response(`${lines.join('\r\n')}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="vendors-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
