import { REVIEW_TYPES } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { ReviewTable } from '@/components/admin/review-table';
import { getAdminReviews } from '@/lib/admin-data';
import {
  adminQueryString,
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
  searchParams: Promise<{ type?: RawParam; page?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const type = oneOf(raw.type, REVIEW_TYPES);
  const dropped = droppedKeys(raw, { type });
  const reviews = await getAdminReviews(adminQueryString({ type, page: pageNumber(raw.page) }));

  return (
    <AdminSurface
      heading="Reviews"
      counts={[`${reviews.total} total`]}
      dropped={dropped}
      filters={
        <FilterBar action={PATH}>
          <FilterSelect
            action={PATH}
            carried={{ type }}
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
        params: { type },
        page: reviews.page,
        pageSize: reviews.pageSize,
        total: reviews.total,
      }}
    >
      <ReviewTable rows={reviews.items} filtered={Boolean(type)} />
    </AdminSurface>
  );
}
