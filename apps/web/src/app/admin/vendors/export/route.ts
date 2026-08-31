import {
  ADMIN_PAYOUT_FILTERS,
  ADMIN_VENDOR_STATUSES,
  MAX_PAGE_SIZE,
  toDateString,
} from '@vendor-marketplace/shared';
import type { NextRequest } from 'next/server';
import { ApiClientError } from '@/lib/api-client';
import { getAdminVendorFacets, getAdminVendors } from '@/lib/admin-data';
import { adminQueryString, boundedText, displayRating, oneOf } from '@/lib/admin-params';
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
    csvField(displayRating(row) ?? ''),
    csvField(row.reviewCount),
    csvField(row.bookingsCount),
    csvField(row.status),
    csvField(row.stripeOnboarded ? 'yes' : 'no'),
    csvField(toDateString(row.createdAt)),
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
  /*
   * `getCurrentUser` propagates a 403, which for a **suspended** operator is an
   * unhandled render error rather than an answer. The pages avoid that by going
   * through `requireCurrentUser`; a route handler has no redirect to offer, so
   * it catches and states the refusal.
   */
  let user: Awaited<ReturnType<typeof getCurrentUser>>;

  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 403) {
      return new Response('Forbidden', { status: 403 });
    }
    throw error;
  }

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  /*
   * The same narrowing the page does, not the raw query string.
   *
   * Forwarding `request.nextUrl.search` verbatim made this the one admin URL
   * that skipped the boundary: `?status=nonsense` reached the API, came back
   * 400, threw inside the loop below and rendered the 500 page — on an
   * authenticated admin route, for a link the operator had bookmarked.
   */
  /*
   * `getAll`, not `Object.fromEntries` — which keeps the **last** value of a
   * repeated key while `admin-params`' `first()` keeps the first. `?status=review
   * &status=live` would have exported a different set from the table it claims
   * to be exporting.
   */
  const raw = Object.fromEntries(
    [...request.nextUrl.searchParams.keys()].map((key) => [
      key,
      request.nextUrl.searchParams.getAll(key),
    ]),
  );
  const facets = await getAdminVendorFacets();
  const filters = new URLSearchParams(
    adminQueryString({
      q: boundedText(raw.q),
      category: oneOf(
        raw.category,
        facets.categories.map((category) => category.slug),
      ),
      city: oneOf(raw.city, facets.cities),
      payouts: oneOf(raw.payouts, ADMIN_PAYOUT_FILTERS),
      status: oneOf(raw.status, ADMIN_VENDOR_STATUSES),
    }).slice(1),
  );
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

  /*
   * Say so when the walk stopped short. The docstring promises "the whole
   * filtered set", and a file that quietly ends at 5,000 rows is worse than one
   * that says where it stopped — an operator reconciling numbers would have no
   * way to tell.
   */
  if (lines.length - 1 < total) {
    lines.push(
      csvField(
        `Truncated at ${lines.length - 1} of ${total} rows — narrow the filters to export the rest.`,
      ),
    );
  }

  return new Response(`${lines.join('\r\n')}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="vendors-${toDateString(new Date())}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
