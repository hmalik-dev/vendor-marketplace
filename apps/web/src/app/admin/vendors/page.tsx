import Link from 'next/link';
import {
  ADMIN_PAYOUT_FILTERS,
  ADMIN_VENDOR_STATUSES,
  ADMIN_VENDOR_STATUS_LABELS,
} from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { FilteredEmpty, type ActiveFilter } from '@/components/admin/filtered-empty';
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

  /*
   * The five filters, each paired with the words that drop it (#454).
   *
   * `phrase` is how the filter reads inside the heading and `widening` is what
   * the button says, and they are deliberately different sentences: "No
   * **published Austin** vendors matching 'kessler'" reads one way and "Any
   * city" reads another. Built from the same label maps the filter bar uses, so
   * the state names each filter the way the operator set it.
   */
  const active: ActiveFilter[] = [
    { key: 'q', widening: 'Any search term' },
    { key: 'category', widening: 'Any category' },
    { key: 'city', widening: 'Any city' },
    { key: 'payouts', widening: 'Any payout state' },
    { key: 'status', widening: 'Any status' },
  ]
    .filter((filter) => params[filter.key as keyof typeof params] !== undefined)
    .map((filter) => ({ ...filter, carried: { ...params, [filter.key]: undefined } }));

  /*
   * One sentence, assembled from the filters that are actually set.
   *
   * A join is right *here* and wrong inside the component: these adjectives all
   * qualify the same noun, so "No live Austin Photo & film vendors matching
   * 'kessler'" is a real sentence — where a generic join of two unrelated
   * clauses, as on `/admin/cases`, is not.
   *
   * **The words are the labels, never the parameters.** `category` is a slug
   * and `payouts` is `not-connected`; reciting a filter in the operator's own
   * words means the words the filter bar showed them, which is what these three
   * maps hold.
   */
  const categoryName = facets.categories.find(
    (category) => category.slug === params.category,
  )?.name;
  const adjectives = [
    params.status ? ADMIN_VENDOR_STATUS_LABELS[params.status] : undefined,
    params.payouts ? PAYOUT_LABELS[params.payouts] : undefined,
    params.city,
    categoryName,
  ].filter((word): word is string => word !== undefined);

  const filteredHeadline = [
    'No',
    ...adjectives,
    'vendors',
    ...(params.q ? [`matching "${params.q}"`] : []),
  ].join(' ');

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
              className="text-sm font-semibold text-clay-500 hover:underline"
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
            /* `aria-current`, not `aria-pressed`: this is a link, and a link
               has no pressed state to report. `page` is the right value —
               following it is what puts the operator on this filtered view. */
            aria-current={awaitingActive ? 'page' : undefined}
            className={cn(
              'rounded-md px-3.5 py-2 text-sm font-semibold whitespace-nowrap',
              awaitingActive
                ? 'bg-clay-400 text-stone-0'
                : 'border border-stone-300 bg-stone-0 text-stone-900 hover:bg-stone-150',
            )}
          >
            Awaiting review ({vendors.awaitingReview})
          </Link>

          <FilterSelect
            action={PATH}
            carried={params}
            name="category"
            label="Category"
            value={params.category ?? ''}
            options={facets.categories.map((category) => ({
              value: category.slug,
              label: category.name,
            }))}
          />
          <FilterSelect
            action={PATH}
            carried={params}
            name="city"
            label="City"
            value={params.city ?? ''}
            options={facets.cities.map((city) => ({ value: city, label: city }))}
          />
          {/*
            The Status control, which the bar did not have (#433).

            The saved `Awaiting review` chip was the only thing that set this
            parameter, so the other states were reachable only by typing a query
            string. That was liveable while every state a vendor could be in was
            visible from the pill; it stopped being liveable when `retired`
            arrived, because a deleted account is exactly the row an operator
            goes looking for and cannot find by scrolling. Both controls write
            `status`, so they agree: choosing `Review` here and clicking the chip
            land on the same filtered view.
          */}
          <FilterSelect
            action={PATH}
            carried={params}
            name="status"
            label="Status"
            value={params.status ?? ''}
            options={ADMIN_VENDOR_STATUSES.map((status) => ({
              value: status,
              label: ADMIN_VENDOR_STATUS_LABELS[status],
            }))}
          />
          <FilterSelect
            action={PATH}
            carried={params}
            name="payouts"
            label="Payouts"
            value={params.payouts ?? ''}
            options={ADMIN_PAYOUT_FILTERS.map((filter) => ({
              value: filter,
              label: PAYOUT_LABELS[filter],
            }))}
          />
          {/*
            Every filter the search form does not own travels with it as a
            hidden field. Submitting a GET form sends only its own controls, and
            the three dropdowns now navigate on their own — so without these,
            pressing Enter in the search box would silently clear the category,
            the city, the payout state and the saved filter.
          */}
          {(['category', 'city', 'payouts', 'status'] as const).map((key) =>
            params[key] ? <input key={key} type="hidden" name={key} value={params[key]} /> : null,
          )}
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
      <VendorTable
        rows={vendors.items}
        filtered={filtered}
        filteredEmpty={
          <FilteredEmpty
            headline={filteredHeadline}
            path={PATH}
            filters={active}
            widenings={vendors.widenings}
          />
        }
      />
    </AdminSurface>
  );
}
