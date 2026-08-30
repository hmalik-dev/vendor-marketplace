'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  MAX_TITLE_LENGTH,
  REVIEW_CONTENT_MAX_LENGTH,
  REVIEW_CONTENT_MIN_LENGTH,
} from '@vendor-marketplace/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { wireReviewSchema, type WireReview } from '@/lib/wire-schemas';
import { StarRatingInput } from './star-rating-input';

/** `.inp` from the frame: `stone-150` fill, `stone-300` hairline. See `03-components.md`. */
const FIELD_CONTROL =
  'h-auto w-full rounded-[10px] border border-stone-300 bg-stone-150 px-3.25 py-2.5 text-base text-stone-900 outline-none placeholder:text-stone-500 focus-visible:border-clay-400 focus-visible:ring-3 focus-visible:ring-clay-400/15';

export interface WriteReviewModalProps {
  /** The completed booking this review is for — never sent as anything else. */
  bookingId: string;
  businessName: string;
  onSubmitted: (review: WireReview) => void;
}

/**
 * The write-review flow — a `Write a review` trigger that opens the modal the
 * ticket specifies: **"How was your experience?"**, never "Create review", and
 * a rating input that is a radio group rather than a row of buttons (see
 * `StarRatingInput`).
 *
 * `review_type` is never part of the form: the server derives
 * `customer_to_vendor` vs `vendor_to_customer` from who the signed-in caller
 * is on this booking, and nothing here could override that even by accident —
 * the request body simply has no field for it.
 */
export function WriteReviewModal({
  bookingId,
  businessName,
  onSubmitted,
}: WriteReviewModalProps): React.ReactElement {
  const call = useApi();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleFieldId = useId();
  const contentFieldId = useId();

  function reset(): void {
    setRating(null);
    setTitle('');
    setContent('');
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (rating === null) {
      setError('Choose a rating.');
      return;
    }

    if (content.trim().length < REVIEW_CONTENT_MIN_LENGTH) {
      setError(`Say a little more — at least ${REVIEW_CONTENT_MIN_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const review = await call('/reviews', {
        method: 'POST',
        schema: wireReviewSchema,
        body: {
          bookingId,
          rating,
          ...(title.trim() ? { title: title.trim() } : {}),
          content,
        },
      });

      setOpen(false);
      reset();
      onSubmitted(review);
    } catch (failure) {
      setError(
        failure instanceof ApiClientError
          ? failure.message
          : 'That did not reach us. Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          Write a review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px] gap-5 rounded-[18px] bg-stone-0 p-6 text-stone-900 shadow-xl ring-0">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-[26px] leading-[1.15] text-stone-900">
              How was your experience?
            </DialogTitle>
            <DialogDescription className="text-sm text-stone-600">
              Your review of {businessName} is public once you send it.
            </DialogDescription>
          </DialogHeader>

          <StarRatingInput
            name="rating"
            value={rating}
            onChange={setRating}
            label="Your rating"
            disabled={submitting}
          />

          <div>
            <Label htmlFor={titleFieldId} className="mb-1.5">
              Title (optional)
            </Label>
            <input
              id={titleFieldId}
              type="text"
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              disabled={submitting}
              onChange={(event) => setTitle(event.target.value)}
              className={FIELD_CONTROL}
              placeholder="Sum it up in a few words"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <Label htmlFor={contentFieldId}>Your review</Label>
              <span className="text-[11.5px] text-stone-600">
                {content.length} / {REVIEW_CONTENT_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id={contentFieldId}
              required
              minLength={REVIEW_CONTENT_MIN_LENGTH}
              maxLength={REVIEW_CONTENT_MAX_LENGTH}
              value={content}
              disabled={submitting}
              onChange={(event) => setContent(event.target.value)}
              className={cn(FIELD_CONTROL, 'min-h-28 leading-prose')}
              placeholder="What was it like to work with them?"
            />
          </div>

          {error ? (
            <p role="alert" className="text-xs text-error-500">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" variant="primary" loading={submitting}>
              Send review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
