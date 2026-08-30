'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EVENT_TYPE_LABELS,
  type EventType,
  type ReviewRatingDistribution,
} from '@vendor-marketplace/shared';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { WriteReviewModal } from '@/components/reviews/write-review-modal';
import { apiRequest } from '@/lib/api-client';
import type { ReviewEligibility } from '@/lib/reviews-data';
import { cn } from '@/lib/utils';
import {
  wireVendorReviewsPageSchema,
  type WireVendorReview,
  type WireVendorReviewsPage,
} from '@/lib/wire-schemas';

const REVIEW_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const STAR_VALUES = [1, 2, 3, 4, 5] as const;
/** Drawn worst-to-best under the summary number, matching every rating UI that reads top-down. */
const DISTRIBUTION_ORDER = [5, 4, 3, 2, 1] as const;

/** A read-only star row — the display counterpart to `StarRatingInput`. */
function StarRow({
  value,
  size = 'text-sm',
}: {
  value: number;
  size?: string;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center" aria-hidden="true">
      {STAR_VALUES.map((star) => (
        <span key={star} className={cn(size, star <= value ? 'text-gold-400' : 'text-stone-300')}>
          ★
        </span>
      ))}
    </span>
  );
}

function DistributionBars({
  distribution,
  total,
}: {
  distribution: ReviewRatingDistribution;
  total: number;
}): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1.5" aria-hidden="true">
      {DISTRIBUTION_ORDER.map((star) => {
        const count = distribution[star];
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;

        return (
          <div key={star} className="flex items-center gap-2">
            <span className="w-3 text-right text-xs text-stone-600">{star}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-150">
              <div className="h-full rounded-full bg-clay-400" style={{ width: `${percent}%` }} />
            </div>
            <span className="w-6 text-right text-xs text-stone-600">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewCard({ review }: { review: WireVendorReview }): React.ReactElement {
  const occasion = review.eventType
    ? (EVENT_TYPE_LABELS[review.eventType as EventType] ?? review.eventType)
    : null;

  return (
    <article className="border-b border-stone-200 py-5 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-stone-900">
            {review.reviewerFirstName} {review.reviewerLastInitial}.
          </span>
          <StarRow value={review.rating} />
          <span className="sr-only">{review.rating} out of 5 stars</span>
        </div>
        <span className="text-xs text-stone-600">
          {REVIEW_DATE_FORMAT.format(review.createdAt)}
        </span>
      </div>
      {review.title ? (
        <h3 className="mt-2 font-display text-lg text-stone-900">{review.title}</h3>
      ) : null}
      <p className="mt-1.5 text-sm leading-prose text-stone-700">{review.content}</p>
      {occasion ? (
        <span className="mt-3 inline-block rounded-full bg-stone-150 px-2.5 py-1 text-[11.5px] font-semibold text-stone-700">
          {occasion}
        </span>
      ) : null}
    </article>
  );
}

export interface ReviewsPaneProps {
  slug: string;
  businessName: string;
  /** The vendor's own stored aggregate — the same number the header renders. */
  avgRating: number;
  reviewCount: number;
  initialPage: WireVendorReviewsPage;
  eligibility: ReviewEligibility;
}

/**
 * Frame `03`'s Reviews tab, filled in — ticket #12.
 *
 * "Show more reviews" **appends**; there are no page numbers anywhere on this
 * pane. "Write a review" renders only when `eligibility.eligible` is true,
 * which the server decided from the reader's own completed-and-unreviewed
 * booking with this vendor — never from anything this component chooses.
 *
 * The caller should mount this with `key={reviewCount}`: a submitted review
 * calls `router.refresh()` rather than patching state locally, and the key
 * forces a clean remount of the fetched-then-appended pagination state when
 * that refresh lands a new `reviewCount`.
 */
export function ReviewsPane({
  slug,
  businessName,
  avgRating,
  reviewCount,
  initialPage,
  eligibility,
}: ReviewsPaneProps): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = useState(initialPage.items);
  const [page, setPage] = useState(initialPage.page);
  const [total, setTotal] = useState(initialPage.total);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const hasMore = items.length < total;

  async function loadMore(): Promise<void> {
    setLoadingMore(true);
    setLoadError(null);

    try {
      const next = page + 1;
      const query = new URLSearchParams({
        page: String(next),
        limit: String(initialPage.limit),
      });
      const nextPage = await apiRequest(
        `/vendors/${encodeURIComponent(slug)}/reviews?${query.toString()}`,
        { schema: wireVendorReviewsPageSchema },
      );

      setItems((current) => [...current, ...nextPage.items]);
      setPage(next);
      setTotal(nextPage.total);
    } catch {
      setLoadError('More reviews did not load. Try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  const writeReviewCta =
    eligibility.eligible && eligibility.bookingId ? (
      <WriteReviewModal
        bookingId={eligibility.bookingId}
        businessName={businessName}
        onSubmitted={() => router.refresh()}
      />
    ) : null;

  if (total === 0) {
    return (
      <EmptyState
        headline="No reviews yet"
        description={`Every review here comes from a completed booking, so ${businessName} has none until they've worked an event.`}
        action={writeReviewCta ?? undefined}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-6 border-b border-stone-200 pb-6 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-start gap-1">
          {/*
            `display-hero-sm` (36px) rather than a stock Tailwind step: it is
            the same size the booking rail's own large Serif number uses for
            its price, and no Reviews-tab frame exists to measure against —
            see `display-type.test.ts`'s closed set of approved sizes.
          */}
          <span className="font-display text-display-hero-sm leading-none text-stone-900">
            {avgRating.toFixed(1)}
          </span>
          <StarRow value={Math.round(avgRating)} size="text-xl" />
          <span className="text-sm text-stone-600">
            {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
          </span>
        </div>
        <DistributionBars distribution={initialPage.distribution} total={reviewCount} />
      </div>

      {writeReviewCta ? <div className="mt-5">{writeReviewCta}</div> : null}

      <div className="mt-2">
        {items.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {loadError ? (
        <p role="alert" className="mt-3 text-xs text-error-500">
          {loadError}
        </p>
      ) : null}

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            loading={loadingMore}
            onClick={() => void loadMore()}
          >
            Show more reviews
          </Button>
        </div>
      ) : null}
    </div>
  );
}
