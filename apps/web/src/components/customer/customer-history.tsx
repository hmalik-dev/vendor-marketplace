import { EmptyState } from '@/components/ui/empty-state';
import type { WireCustomerReview } from '@/lib/wire-schemas';

export interface CustomerReviewsProps {
  reviews: readonly WireCustomerReview[];
}

/** What vendors said about working with this customer. */
export function CustomerReviews({ reviews }: CustomerReviewsProps): React.ReactElement {
  if (reviews.length === 0) {
    return (
      <EmptyState
        headline="No reviews yet"
        description="Reviews from vendors will appear here after completed events."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-xl border border-stone-300 bg-stone-0 px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-[19px] text-stone-900">{review.vendorBusinessName}</p>
            <span className="shrink-0 text-sm text-stone-700">
              <span aria-hidden="true">★ </span>
              <span className="font-semibold">{review.rating}</span>
              <span className="sr-only"> out of 5</span>
            </span>
          </div>
          {review.title ? (
            <p className="mt-1 text-base font-semibold text-stone-900">{review.title}</p>
          ) : null}
          <p className="mt-1 text-base leading-prose text-stone-700">{review.content}</p>
        </li>
      ))}
    </ul>
  );
}
