'use client';

import {
  EVENT_TYPE_LABELS,
  REVIEW_RATINGS,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  type EventType,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { wireVendorReviewsPageSchema, type WireVendorReviewsPage } from '@/lib/wire-schemas';
import { ReviewForm } from './review-form';

/**
 * `★★★★☆` — the frame's own glyph, filled to the rating and hollow after it.
 *
 * A character rather than an SVG for the same reason the profile header uses
 * one: a filled clay star is a heavier mark than the design draws, and the
 * glyph inherits its colour and baseline from the line it sits on.
 */
function StarRow({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}): React.ReactElement {
  /*
   * Five whole glyphs, but the *spoken* value is the real one. An average of
   * 4.9 fills five stars and used to announce "5 out of 5" — a screen-reader
   * user was told a different number from the one printed beside it, which is
   * the worst kind of wrong: confidently, and only for them.
   */
  const filled = Math.round(rating);

  return (
    <span className={cn('text-gold-400', className)}>
      <span aria-hidden="true">
        {REVIEW_RATINGS.map((value) => (value <= filled ? '★' : '☆')).join('')}
      </span>
      <span className="sr-only">
        {Number.isInteger(rating) ? rating : rating.toFixed(1)} out of {REVIEW_RATING_MAX} stars
      </span>
    </span>
  );
}

/** `November 14, 2026` — a review is dated to a day, never to a time. */
const REVIEW_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

function occasionOf(eventType: string | null): string | null {
  if (!eventType) {
    return null;
  }

  return EVENT_TYPE_LABELS[eventType as EventType] ?? eventType;
}

export interface ReviewsPaneProps {
  slug: string;
  businessName: string;
  /**
   * The vendor's own denormalised count, from the profile read.
   *
   * The only thing that distinguishes "this vendor has no reviews" from "we
   * could not fetch them", because it arrives on a different request. Without
   * it a failed read told visitors a vendor with 127 reviews had never worked
   * an event, under a header still showing 4.9 ★ · 127 reviews.
   */
  reviewCount: number;
  /** The first page, read on the server; `null` when that read failed. */
  initial: WireVendorReviewsPage | null;
}

/**
 * The Reviews tab of frame `03`: the summary, the five-bar distribution chart,
 * and the reviews themselves.
 *
 * **The frame draws the tab button but not its content**, so
 * `12-vendor-profile.md:133` is the specification here rather than a rendered
 * rectangle — a gap in the design contract, recorded on #12 rather than papered
 * over.
 *
 * A client component because the tab does two things a server one cannot:
 * "Show more reviews" **appends** rather than paging, and the write form folds
 * the new review into the summary and the list in place. Both keep the reader
 * where they were, which is why the plan asks for an append and no page
 * numbers.
 */
export function ReviewsPane({
  slug,
  businessName,
  reviewCount,
  initial,
}: ReviewsPaneProps): React.ReactElement {
  const request = useApi();
  const router = useRouter();
  const [page, setPage] = useState<WireVendorReviewsPage | null>(initial);
  const [items, setItems] = useState(initial?.items ?? []);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  /*
   * Re-seed from the server whenever the page above re-renders with a new read.
   *
   * The alternative — patching the list here after a write — left the tab
   * saying "128 reviews" beside a header still saying 127 and a rail still
   * saying 127, because those two are server-rendered and this is not. One
   * `router.refresh()` moves all three, and this is what carries it into the
   * appended list. Adjusting state during render is React's own documented way
   * to do this; the alternative is an effect that renders the stale value once
   * first.
   */
  const [seeded, setSeeded] = useState(initial);

  if (seeded !== initial) {
    setSeeded(initial);
    setPage(initial);
    setItems(initial?.items ?? []);
    setFailure(null);
  }

  async function showMore(): Promise<void> {
    if (!page) {
      return;
    }

    setLoadingMore(true);
    setFailure(null);

    try {
      const next = await request(
        `/vendors/${encodeURIComponent(slug)}/reviews?page=${page.page + 1}`,
        { schema: wireVendorReviewsPageSchema },
      );

      /*
       * Appended, and de-duplicated by id. A review filed while someone is
       * reading pushes the list down by one, so page 2 can repeat the row that
       * was last on page 1 — no offset pager avoids that, and a duplicate key
       * is a React error rather than a cosmetic one.
       */
      setItems((current) => {
        const seen = new Set(current.map((review) => review.id));
        return [...current, ...next.items.filter((review) => !seen.has(review.id))];
      });
      setPage(next);
    } catch (error) {
      setFailure(
        error instanceof ApiClientError
          ? 'We couldn’t load more reviews. Try again in a moment.'
          : 'We couldn’t reach the server. Check your connection and try again.',
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const bookingId = page?.viewer.canReview ? page.viewer.bookingId : null;
  const form =
    writing && bookingId ? (
      <ReviewForm
        businessName={businessName}
        bookingId={bookingId}
        onCancel={() => setWriting(false)}
        onWritten={() => {
          setWriting(false);
          /*
           * The whole route, not just this pane. The header's rating line and
           * the booking rail's "N reviews from verified bookings" are rendered
           * on the server from the same numbers, and updating only what is in
           * reach here put three different counts on one screen.
           */
          router.refresh();
        }}
      />
    ) : null;
  const writeAction =
    bookingId && !writing ? (
      <Button variant="secondary" onClick={() => setWriting(true)}>
        Write a review
      </Button>
    ) : null;

  const summary = page?.summary;

  if (!summary || summary.reviewCount === 0) {
    /*
     * Two different states, and the vendor's own count is what tells them
     * apart. Saying "no reviews yet" under a header reading `4.9 ★ (127
     * reviews)` is not a smaller failure than an error — it is a claim about
     * the vendor that is false.
     */
    const unread = !summary && reviewCount > 0;

    return (
      <div>
        <EmptyState
          headline={unread ? 'Reviews are on their way' : 'No reviews yet'}
          description={
            unread
              ? `${businessName} has ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}. We couldn’t load them just now — reload the page to try again.`
              : `Every review here comes from a completed booking, so ${businessName} has none until they've worked an event.`
          }
          action={writeAction}
        />
        {form}
        <Failure message={failure} />
      </div>
    );
  }

  /*
   * Bars are scaled against the *biggest* bucket rather than the total. Against
   * the total, a vendor with thirty fives and two ones draws four bars that are
   * indistinguishable from empty, and the shape of the distribution — which is
   * the only thing a chart adds over the average — disappears.
   */
  const highest = Math.max(...summary.distribution);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-8 rounded-[14px] bg-stone-0 px-6 py-5">
        <div>
          <p className="font-display text-[46px] leading-none text-stone-900">
            {summary.avgRating === null ? '—' : summary.avgRating.toFixed(1)}
          </p>
          <StarRow rating={summary.avgRating ?? 0} className="mt-1.5 block text-[17px]" />
          <p className="mt-1 text-sm text-stone-600">
            {summary.reviewCount} {summary.reviewCount === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {/* Five bars, highest rating first, so the chart reads the way ratings
            are spoken. */}
        <ul className="min-w-[220px] flex-1">
          {[...REVIEW_RATINGS].reverse().map((rating) => {
            const count = summary.distribution[rating - REVIEW_RATING_MIN] ?? 0;

            return (
              <li key={rating} className="flex items-center gap-2.5 py-0.5 text-sm text-stone-600">
                <span className="w-3 shrink-0 text-right tabular-nums">{rating}</span>
                <span aria-hidden="true" className="text-gold-400">
                  ★
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
                  <span
                    className="block h-full rounded-full bg-clay-400"
                    style={{ width: `${highest === 0 ? 0 : (count / highest) * 100}%` }}
                  />
                </span>
                <span className="w-7 shrink-0 text-right tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>

        {writeAction}
      </div>

      {form}

      <ul className="mt-5 flex flex-col gap-2.5">
        {items.map((review) => {
          const occasion = occasionOf(review.eventType);

          return (
            <li
              key={review.id}
              className="rounded-xl border border-stone-300 bg-stone-0 px-4 py-3.5"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {/*
                  Every string on this card is written by a customer, so all
                  three wrap rather than push the card wide: a name at the
                  column's full 100 characters, or a body with no spaces in it,
                  is legal input and must not decide the layout.
                */}
                <p className="min-w-0 font-semibold break-words text-stone-900">
                  {review.reviewerName}
                </p>
                <StarRow rating={review.rating} className="text-sm" />
                <span className="text-sm text-stone-600">
                  {REVIEW_DATE.format(review.createdAt)}
                </span>
                {occasion ? (
                  <span className="ml-auto inline-block rounded-sm bg-stone-200 px-2.5 py-1.25 text-helper font-semibold text-stone-700">
                    {occasion}
                  </span>
                ) : null}
              </div>
              {review.title ? (
                <p className="mt-1.5 text-base font-semibold break-words text-stone-900">
                  {review.title}
                </p>
              ) : null}
              <p className="mt-1 text-base leading-prose break-words text-stone-700">
                {review.content}
              </p>
            </li>
          );
        })}
      </ul>

      <Failure message={failure} />

      {page?.hasMore ? (
        <div className="mt-4">
          <Button variant="secondary" loading={loadingMore} onClick={() => void showMore()}>
            Show more reviews
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** One line saying what went wrong, in the reader's words rather than the API's. */
function Failure({ message }: { message: string | null }): React.ReactElement | null {
  if (!message) {
    return null;
  }

  return (
    <p role="status" className="mt-3 text-helper text-error-500">
      {message}
    </p>
  );
}
