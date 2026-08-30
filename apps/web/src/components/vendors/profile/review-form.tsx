'use client';

import {
  MAX_TITLE_LENGTH,
  REVIEW_CONTENT_MAX_LENGTH,
  REVIEW_CONTENT_MIN_LENGTH,
  REVIEW_RATINGS,
  reviewSchema,
} from '@vendor-marketplace/shared';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { userFacingError } from '@/lib/user-facing-error';
import { useApi } from '@/lib/use-api';
import { useSubmitValidation, type FieldIssue } from '@/lib/use-submit-validation';
import { cn } from '@/lib/utils';

/** What each rating means, spoken. The radio's accessible name, not decoration. */
const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below expectations',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

export interface ReviewFormProps {
  businessName: string;
  /** The completed booking this review is filed against; the API re-checks it. */
  bookingId: string;
  onCancel: () => void;
  /** Called once the review is filed, so the pane can re-read the tab. */
  onWritten: () => void;
}

/**
 * "How was your experience?" — the write-a-review form, opened from the tab.
 *
 * **The stars are a radio group**, not a row of buttons: five mutually
 * exclusive values are what a radio group *is*, so a keyboard user gets arrow
 * navigation, a single tab stop and a spoken group name from the platform
 * rather than from re-implemented key handling. The inputs are visually hidden
 * and the star is drawn by its `<label>`, which keeps the real control focusable
 * and the click target the full 44px the access law asks for.
 */
export function ReviewForm({
  businessName,
  bookingId,
  onCancel,
  onWritten,
}: ReviewFormProps): React.ReactElement {
  const request = useApi();
  const fieldId = useId();
  const [rating, setRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const issues = useMemo<FieldIssue[]>(() => {
    const found: FieldIssue[] = [];

    if (rating === null) {
      found.push({
        field: `${fieldId}-rating`,
        label: 'Rating',
        message: 'Pick a rating from one to five stars',
        severity: 'blocker',
      });
    }

    const trimmed = content.trim();

    if (trimmed.length < REVIEW_CONTENT_MIN_LENGTH) {
      found.push({
        field: `${fieldId}-content`,
        label: 'Review',
        message:
          trimmed.length === 0
            ? 'Say something about the day — at least 10 characters'
            : `A few more words — you’re ${REVIEW_CONTENT_MIN_LENGTH - trimmed.length} characters short`,
        severity: 'blocker',
      });
    }

    return found;
  }, [rating, content, fieldId]);

  const validation = useSubmitValidation(issues);
  const ratingIssue = validation.issueFor(`${fieldId}-rating`);
  const contentIssue = validation.issueFor(`${fieldId}-content`);

  async function send(): Promise<void> {
    setSubmitting(true);
    setFailure(null);

    try {
      await request(`/bookings/${encodeURIComponent(bookingId)}/reviews`, {
        // Only the id is read back; the pane re-reads the whole tab afterwards.
        schema: reviewSchema.pick({ id: true }),
        method: 'POST',
        body: {
          rating,
          ...(title.trim() ? { title: title.trim() } : {}),
          content: content.trim(),
        },
      });

      onWritten();
    } catch (error) {
      /*
       * The API's own sentence is shown here, and only here, because every
       * refusal this endpoint produces is already written for a reader — the
       * booking has not completed, it has been reviewed, the language cannot be
       * published. A generic line would replace a specific fix with a shrug.
       */
      setFailure(
        userFacingError(error, 'Your review didn’t reach us. Check your connection and try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      // Named by its own prompt, so the form is an addressable landmark rather
      // than an unlabelled region between the summary and the reviews.
      aria-labelledby={`${fieldId}-prompt`}
      className="mt-4 rounded-[14px] border border-stone-300 bg-stone-0 px-5 py-4.5"
      onSubmit={(event) => {
        event.preventDefault();
        validation.attemptSubmit(() => void send());
      }}
    >
      <h3 id={`${fieldId}-prompt`} className="font-display text-[22px] text-stone-900">
        How was your experience?
      </h3>
      <p className="mt-1 text-sm text-stone-600">
        Your review appears on {businessName}&apos;s profile under your first name and initial.
      </p>

      <fieldset className="mt-4">
        <legend className="text-label font-semibold tracking-label text-stone-600 uppercase">
          Rating
        </legend>
        <div className="mt-1.5 flex items-center gap-0.5">
          {REVIEW_RATINGS.map((value) => (
            <label
              key={value}
              className={cn(
                'flex size-11 cursor-pointer items-center justify-center rounded-md text-[26px] transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-clay-400/30 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-stone-50',
                rating !== null && value <= rating ? 'text-gold-400' : 'text-stone-400',
              )}
            >
              <input
                type="radio"
                name={`${fieldId}-rating`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                /*
                 * On each radio rather than on the row that holds them. A `div`
                 * is not in the accessibility tree, so describing it described
                 * nothing: a screen-reader user submitted an empty form and
                 * heard about the missing body but never the missing rating.
                 *
                 * `aria-describedby` only — `aria-invalid` is not supported on
                 * `role="radio"`, so the red state is carried by the message
                 * and its `role="alert"` rather than by a property that would
                 * be ignored.
                 */
                aria-describedby={ratingIssue ? `${fieldId}-rating-error` : undefined}
                className="sr-only"
              />
              <span aria-hidden="true">{rating !== null && value <= rating ? '★' : '☆'}</span>
              <span className="sr-only">
                {value} {value === 1 ? 'star' : 'stars'} — {RATING_LABELS[value]}
              </span>
            </label>
          ))}
        </div>
        {ratingIssue ? (
          <p
            id={`${fieldId}-rating-error`}
            role="alert"
            className="mt-1.5 text-helper text-error-500"
          >
            {ratingIssue.message}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-4">
        <Label htmlFor={`${fieldId}-title`}>Headline (optional)</Label>
        <Input
          id={`${fieldId}-title`}
          type="text"
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Worth every penny"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="mt-4">
        <Label htmlFor={`${fieldId}-content`}>Review</Label>
        <Textarea
          id={`${fieldId}-content`}
          value={content}
          rows={4}
          maxLength={REVIEW_CONTENT_MAX_LENGTH}
          aria-invalid={contentIssue ? true : undefined}
          aria-describedby={contentIssue ? `${fieldId}-content-error` : undefined}
          placeholder="What did they do, and how did the day go?"
          onChange={(event) => setContent(event.target.value)}
        />
        {contentIssue ? (
          <p id={`${fieldId}-content-error`} className="mt-1.5 text-helper text-error-500">
            {contentIssue.message}
          </p>
        ) : null}
      </div>

      {failure ? (
        <p role="alert" className="mt-3 text-helper text-error-500">
          {failure}
        </p>
      ) : null}

      <div className="mt-4.5 flex items-center gap-2.5">
        <Button type="submit" variant="primary" loading={submitting}>
          Post review
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
