import { REVIEW_TYPES } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { Pager } from '@/components/admin/pager';
import { ReviewTable } from '@/components/admin/review-table';
import { adminQueryString, getAdminReviews } from '@/lib/admin-data';
import { oneOf, pageNumber } from '@/lib/admin-params';

const PATH = '/admin/reviews';

const TYPE_LABELS: Record<string, string> = {
  customer_to_vendor: 'About a vendor',
  vendor_to_customer: 'About a customer',
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const type = oneOf(raw.type, REVIEW_TYPES);
  const reviews = await getAdminReviews(adminQueryString({ type, page: pageNumber(raw.page) }));

  return (
    <AdminSurface
      heading="Reviews"
      counts={[`${reviews.total} total`]}
      filters={
        <FilterBar action={PATH}>
          <FilterSelect
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
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <ReviewTable rows={reviews.items} filtered={Boolean(type)} />
        </div>
        <Pager
          path={PATH}
          params={{ type }}
          page={reviews.page}
          pageSize={reviews.pageSize}
          total={reviews.total}
        />
      </div>
    </AdminSurface>
  );
}
