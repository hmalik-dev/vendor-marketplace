'use client';

import { useId, useState } from 'react';
import { REVIEW_RATING_MAX, REVIEW_RATING_MIN } from '@vendor-marketplace/shared';
import { cn } from '@/lib/utils';

const STAR_VALUES = Array.from(
  { length: REVIEW_RATING_MAX - REVIEW_RATING_MIN + 1 },
  (_, index) => REVIEW_RATING_MIN + index,
);

const STAR_WORDS = ['one', 'two', 'three', 'four', 'five'];

export interface StarRatingInputProps {
  name: string;
  value: number | null;
  onChange: (value: number) => void;
  /** Announced to a screen reader as the group's name; not drawn on screen. */
  label: string;
  disabled?: boolean;
}

/**
 * The rating control on the "Write a review" modal.
 *
 * **A radio group, not a row of buttons** — the ticket's own accessibility
 * requirement. Five native `input[type=radio]` sharing one `name` inside a
 * `fieldset`/`legend` are a radio group without any ARIA of this component's
 * own invention: the browser exposes the grouping, arrow keys move the
 * checked star the way arrow keys move any radio group, and Tab enters and
 * leaves the group in one stop each — never one stop per star, which is what
 * five independent buttons would cost a keyboard user.
 *
 * The stars themselves are `aria-hidden`; each radio's accessible name comes
 * from an `sr-only` word ("four stars") in its label instead of the glyph, so
 * a screen reader announces the rating rather than a row of five identical
 * "★" characters.
 */
export function StarRatingInput({
  name,
  value,
  onChange,
  label,
  disabled = false,
}: StarRatingInputProps): React.ReactElement {
  const [hovered, setHovered] = useState<number | null>(null);
  const legendId = useId();
  const displayed = hovered ?? value ?? 0;

  return (
    <fieldset aria-labelledby={legendId}>
      <legend id={legendId} className="sr-only">
        {label}
      </legend>
      <div
        className="flex gap-1"
        onMouseLeave={() => setHovered(null)}
        onBlur={(event) => {
          // Losing focus to something outside the group clears any hover
          // preview left over from a mouse move that never landed on a click.
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setHovered(null);
          }
        }}
      >
        {STAR_VALUES.map((star, index) => (
          <label
            key={star}
            className={cn(
              'rounded-sm p-0.5',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            )}
            onMouseEnter={() => !disabled && setHovered(star)}
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              disabled={disabled}
              onChange={() => onChange(star)}
              className="peer sr-only"
              /*
               * Deliberately not `required`: a required-but-unchecked radio
               * group blocks the browser's native `submit` event outright, so
               * the form's own `onSubmit` handler — and its "Choose a
               * rating." message — never runs. Validation for this field is
               * therefore the caller's job, in JS, same as everywhere else in
               * this form.
               */
            />
            <span
              aria-hidden="true"
              className={cn(
                'block text-3xl leading-none transition-colors duration-(--duration-fast)',
                star <= displayed ? 'text-gold-400' : 'text-stone-300',
                /*
                 * `outline-solid` is load-bearing, not decoration — Tailwind
                 * v4's outline-width utilities resolve their style from
                 * `--tw-outline-style`, which defaults to the CSS initial
                 * value `none`; without this, `outline-2` sets a 2px outline
                 * with no style and paints nothing. See `button.tsx`.
                 */
                'rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-solid peer-focus-visible:outline-clay-400',
              )}
            >
              ★
            </span>
            <span className="sr-only">
              {STAR_WORDS[index]} star{index === 0 ? '' : 's'}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
