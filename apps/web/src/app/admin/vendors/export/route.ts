import {
  ADMIN_PAYOUT_FILTERS,
  ADMIN_VENDOR_STATUSES,
  toDateString,
} from '@vendor-marketplace/shared';
import type { NextRequest } from 'next/server';
import { getAdminVendorFacets, getAdminVendors } from '@/lib/admin-data';
import { csvExport, rawSearchParams, refuseUnlessAdmin } from '@/lib/admin-export';
import { adminQueryString, boundedText, displayRating, oneOf } from '@/lib/admin-params';

/** Reads live accounts; never cached. */
export const dynamic = 'force-dynamic';

/** The frame's `Export CSV`, as the whole filtered set rather than the page on screen. */
export async function GET(request: NextRequest): Promise<Response> {
  const refused = await refuseUnlessAdmin(request);

  if (refused) {
    return refused;
  }

  /*
   * The same narrowing the page does, not the raw query string.
   *
   * Forwarding `request.nextUrl.search` verbatim made this the one admin URL
   * that skipped the boundary: `?status=nonsense` reached the API, came back
   * 400, threw inside the walk and rendered the 500 page — on an authenticated
   * admin route, for a link the operator had bookmarked.
   */
  const raw = rawSearchParams(request);
  const facets = await getAdminVendorFacets();

  return csvExport({
    name: 'vendors',
    columns: [
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
    ],
    query: adminQueryString({
      q: boundedText(raw.q),
      category: oneOf(
        raw.category,
        facets.categories.map((category) => category.slug),
      ),
      city: oneOf(raw.city, facets.cities),
      payouts: oneOf(raw.payouts, ADMIN_PAYOUT_FILTERS),
      status: oneOf(raw.status, ADMIN_VENDOR_STATUSES),
    }),
    readPage: getAdminVendors,
    row: (row) => [
      row.businessName,
      row.slug,
      row.categoryName,
      row.city,
      row.state,
      displayRating(row) ?? '',
      row.reviewCount,
      row.bookingsCount,
      row.status,
      row.stripeOnboarded ? 'yes' : 'no',
      toDateString(row.createdAt),
    ],
  });
}
