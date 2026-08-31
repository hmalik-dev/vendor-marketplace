import Link from 'next/link';
import { ADMIN_PAYOUT_FILTERS, ADMIN_VENDOR_STATUSES } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { VendorTable } from '@/components/admin/vendor-table';
import { getAdminVendorFacets, getAdminVendors } from '@/lib/admin-data';
import {
  adminQueryString,
  boundedText,
  droppedKeys,
  oneOf,
  pageNumber,
  type RawParam,
} from '@/lib/admin-params';
import { cn } from '@/lib/utils';

const PATH = '/admin/vendors';

/** The frame's `Payouts ▾` options, worded the way an operator asks the question. */
const PAYOUT_LABELS: Record<(typeof ADMIN_PAYOUT_FILTERS)[number], string> = {
  connected: 'Payouts connected',
  'not-connected': 'No payouts yet',
};

/**
 * Every value typed as `RawParam`, not `string`.
 *
 * Next hands a page `string[]` for a repeated key — `?q=a&q=b` — and typing
 * these as `string` hides that from the compiler entirely, which is how the
 * boundary helpers came to be called with an array.
 */
type SearchParams = Record<'q' | 'category' | 'city' | 'payouts' | 'status' | 'page', RawParam>;

/**
 * Frame `13 Admin`.
 *
 * Every filter lives in the URL, so the state the frame draws — the saved
 * "Awaiting review" filter applied — is reachable as `?status=review`, which is
 * the state to compare against the frame.
 */
export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<Partial<SearchParams>>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const facets = await getAdminVendorFacets();
  /*
   * Narrowed against what the platform actually holds, not just against a
   * length: `category` and `city` are checked against the facets the filter bar
   * offers, so a pasted `?city=<script>` is dropped rather than round-tripped
   * into an API call and a 500.
   */
  const params = {
    q: boundedText(raw.q),
    category: oneOf(
      raw.category,
      facets.categories.map((category) => category.slug),
    ),
    city: oneOf(raw.city, facets.cities),
    payouts: oneOf(raw.payouts, ADMIN_PAYOUT_FILTERS),
    status: oneOf(raw.status, ADMIN_VENDOR_STATUSES),
  };
  const query = adminQueryString({ ...params, page: pageNumber(raw.page) });
  // What was in the URL and could not be used, so the screen can say so.
  const dropped = droppedKeys(raw, params);

  const vendors = await getAdminVendors(query);
  const awaitingActive = params.status === 'review';
  const filtered = Boolean(
    params.q || params.category || params.city || params.payouts || params.status,
  );

  return (
    <AdminSurface
      heading="Vendors"
      counts={[`${vendors.total} total`, `${vendors.awaitingReview} awaiting review`]}
      dropped={dropped}
      filters={
        <FilterBar
          action={PATH}
          searchPlaceholder="Search name, email or slug…"
          searchValue={params.q}
          trailing={
            <Link
              href={`/admin/vendors/export${query}`}
              prefetch={false}
              className="text-meta font-semibold text-clay-500 hover:underline"
            >
              Export CSV
            </Link>
          }
        >
          {/*
            The saved filter, and the one control that is a link rather than a
            form field: it sets `status` on its own and clears the page, so it
            cannot be half-applied alongside the `Status` the dropdowns do not
            offer.
          */}
          <Link
            href={
              awaitingActive
                ? `${PATH}${adminQueryString({ q: params.q, category: params.category, city: params.city, payouts: params.payouts })}`
                : `${PATH}${adminQueryString({ q: params.q, category: params.category, city: params.city, payouts: params.payouts, status: 'review' })}`
            }
            aria-pressed={awaitingActive}
            className={cn(
              'rounded-lg px-3.5 py-2 text-meta font-semibold whitespace-nowrap',
              awaitingActive
                ? 'bg-clay-400 text-stone-0'
                : 'border border-stone-300 bg-stone-0 text-stone-900 hover:bg-stone-150',
            )}
          >
            Awaiting review ({vendors.awaitingReview})
          </Link>

          <FilterSelect
            name="category"
            label="Category"
            value={params.category ?? ''}
            options={facets.categories.map((category) => ({
              value: category.slug,
              label: category.name,
            }))}
          />
          <FilterSelect
            name="city"
            label="City"
            value={params.city ?? ''}
            options={facets.cities.map((city) => ({ value: city, label: city }))}
          />
          <FilterSelect
            name="payouts"
            label="Payouts"
            value={params.payouts ?? ''}
            options={ADMIN_PAYOUT_FILTERS.map((filter) => ({
              value: filter,
              label: PAYOUT_LABELS[filter],
            }))}
          />
          {/*
            `status` is carried through the form as a hidden field so changing a
            dropdown does not silently drop the saved filter the operator turned
            on with the button above.
          */}
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
        </FilterBar>
      }
      pager={{
        path: PATH,
        params: params,
        page: vendors.page,
        pageSize: vendors.pageSize,
        total: vendors.total,
      }}
    >
      <VendorTable rows={vendors.items} filtered={filtered} />
    </AdminSurface>
  );
}
