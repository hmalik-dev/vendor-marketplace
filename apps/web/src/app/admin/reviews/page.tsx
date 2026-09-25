import { REVIEW_TYPES } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { OutOfRange } from '@/components/admin/out-of-range';
import { FilteredEmpty, type ActiveFilter } from '@/components/admin/filtered-empty';
import { ReviewTable } from '@/components/admin/review-table';
import { getAdminReviews } from '@/lib/admin-data';
import {
  adminQueryString,
  boundedText,
  droppedKeys,
  oneOf,
  pageNumber,
  type RawParam,
} from '@/lib/admin-params';

const PATH = '/admin/reviews';

const TYPE_LABELS: Record<string, string> = {
  customer_to_vendor: 'About a vendor',
  vendor_to_customer: 'About a customer',
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: RawParam; q?: RawParam; page?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const type = oneOf(raw.type, REVIEW_TYPES);
  const q = boundedText(raw.q);
  const dropped = droppedKeys(raw, { type });
  const params = { type, q };
  const reviews = await getAdminReviews(
    adminQueryString({ ...params, page: pageNumber(raw.page) }),
  );
  const typeLabel = type && (TYPE_LABELS[type] ?? type);
  const active: ActiveFilter[] = [
    { key: 'type', widening: 'Both directions', carried: { q } },
    { key: 'q', widening: 'Clear the search', carried: { type } },
  ].filter((filter) => params[filter.key as keyof typeof params] !== undefined);

  return (
    <AdminSurface
      heading="Reviews"
      counts={[`${reviews.total} total`]}
      dropped={dropped}
      filters={
        <FilterBar
          action={PATH}
          params={params}
          searchPlaceholder="Search author, vendor or review…"
          searchValue={q}
        >
          <FilterSelect
            action={PATH}
            name="type"
            label="Direction"
            value={type ?? ''}
            options={REVIEW_TYPES.map((type) => ({
              value: type,
              label: TYPE_LABELS[type] ?? type,
            }))}
          />
        </FilterBar>
      }
      pager={{
        path: PATH,
        params,
        page: reviews.page,
        pageSize: reviews.pageSize,
        total: reviews.total,
      }}
    >
      <ReviewTable
        rows={reviews.items}
        filtered={Boolean(type ?? q)}
        pastEnd={
          reviews.items.length === 0 && reviews.total > 0 ? (
            <OutOfRange
              path={PATH}
              params={params}
              page={reviews.page}
              pageSize={reviews.pageSize}
              total={reviews.total}
            />
          ) : undefined
        }
        /*
         * One counted way out per filter (#454). `isPublic` is a moderation
         * state this table renders rather than a filter the bar offers, so
         * there is nothing else to widen.
         */
        filteredEmpty={
          active.length > 0 ? (
            <FilteredEmpty
              headline={
                q
                  ? `No reviews match "${q}"${typeLabel ? ` and ${typeLabel}` : ''}`
                  : `No ${typeLabel?.toLowerCase()} reviews`
              }
              path={PATH}
              filters={active}
              widenings={reviews.widenings}
            />
          ) : undefined
        }
      />
    </AdminSurface>
  );
}
