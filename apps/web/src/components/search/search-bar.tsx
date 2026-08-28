'use client';

import { isPastDate, todayDateString, type Category } from '@vendor-marketplace/shared';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { CategorySelect } from './category-select';

/**
 * The query, and the whole of it: **vendor type, city, event date**.
 *
 * Nobody arrives knowing a vendor's name — they arrive knowing what kind of
 * vendor, where, and when. All three are constrained, so a search can only ever
 * resolve to something the platform recognises. The free-text box that used to
 * sit in the first segment is gone; name search is a separate, deliberately
 * smaller affordance beside the bar (decision D6).
 *
 * Used compact in the search header and full-size on the landing hero, which is
 * why the segments and their flex weights live here rather than in either page.
 * See design/design-plan/11-search.md and `10-landing.md`.
 */
export interface SearchBarValues {
  /** A category slug, or `''` for "any vendor type". Never free text. */
  category: string;
  city: string;
  date: string;
}

export interface SearchBarProps {
  categories: readonly Category[];
  value: SearchBarValues;
  onSubmit: (value: SearchBarValues) => void;
  /** `compact` is the header variant; `hero` is the landing one. */
  size?: 'compact' | 'hero';
  /**
   * Whether the submit control keeps its label.
   *
   * Deliberately its own prop rather than something derived from `size` or a
   * media query. The choice follows the bar's **role**, not the window: a
   * narrow desktop viewport still shows the labelled pill on the hero, and a
   * wide one still shows the circle in the compact header, because what
   * decides it is whether the bar is the page's primary object or a strip
   * inside a 64px header. A breakpoint cannot express that.
   */
  action?: 'pill' | 'icon';
  className?: string;
}

export function SearchBar({
  categories,
  value,
  onSubmit,
  size = 'compact',
  action = 'pill',
  className,
}: SearchBarProps): React.ReactElement {
  const [draft, setDraft] = useState<SearchBarValues>(value);
  const [pastDate, setPastDate] = useState(false);
  const fieldId = useId();

  /*
   * Today, for the date field's floor. Resolved after mount rather than during
   * render because "today" is the viewer's local day: rendered on the server it
   * would be the server's day, and across a date boundary the two disagree and
   * React reports a hydration mismatch on the `min` attribute.
   *
   * It is only the picker's floor. Whether a *submitted* date is past is asked
   * again at submit time against a fresh clock, so a tab left open across
   * midnight cannot smuggle yesterday through.
   */
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(todayDateString());
  }, []);

  // The URL is the source of truth: a back-navigation has to be reflected here,
  // not overwritten by a stale draft.
  useEffect(() => {
    setDraft(value);
    setPastDate(false);
  }, [value]);

  const isHero = size === 'hero';
  const isIconAction = action === 'icon';

  const label = cn(
    'font-semibold tracking-[.05em] text-stone-600 uppercase',
    isHero ? 'text-[10.5px]' : 'text-[9.5px]',
  );
  const fieldText = isHero ? 'text-md' : 'text-[13.5px]';
  /*
   * No focus ring on the field itself. The bar is one control visually — a
   * single rounded-full pill with hairline dividers, per frame `01` — and a
   * rectangular ring around one segment breaks out past the pill's edge and
   * reads as a second, misaligned box. The ring lives on the bar instead, so
   * it follows the pill's shape. See the form's `has-[:focus-visible]` below.
   */
  const field = cn(
    'min-w-0 bg-transparent text-stone-900 outline-none placeholder:text-stone-600',
    'focus-visible:ring-0 focus-visible:ring-offset-0',
    fieldText,
    isHero && 'mt-0.5',
  );
  /*
   * Below `sm` the three segments stack into a three-row card. They are the
   * query, not a refinement, so they never collapse into the filter sheet — but
   * three flex segments across 390px squeezes each to a few characters, which
   * is worse than a taller control. See design/design-plan/30-responsive.md.
   */
  const divider = cn(
    'shrink-0 bg-stone-200 max-sm:h-px max-sm:w-full sm:w-px sm:bg-stone-300',
    isHero ? 'sm:h-8' : 'sm:h-6.5 sm:bg-stone-200',
  );
  const segment = 'flex min-w-0 flex-col max-sm:w-full max-sm:px-0 max-sm:py-1.5';

  return (
    <form
      role="search"
      /*
        `min` on the date field makes the browser refuse the submit outright and
        raise its own bubble — generic wording, browser-styled, and it fires
        before any handler here, so the message below would never appear.
        Validation is taken over rather than left to the platform: `min` keeps
        doing the part it is good at, greying the past out of the picker, and
        the check on submit says the rest in the product's own voice.
      */
      noValidate
      onSubmit={(event) => {
        event.preventDefault();

        /*
         * `min` greys the past out of the picker, but a date input can still be
         * typed into, and a stale tab's floor can be yesterday's. Nothing is
         * silently corrected — a search the customer didn't ask for is worse
         * than being told the date is wrong — so the query is held back and the
         * value stays put for them to fix.
         */
        if (isPastDate(draft.date, todayDateString())) {
          setPastDate(true);
          return;
        }

        setPastDate(false);
        onSubmit(draft);
      }}
      className={cn(
        'relative flex bg-stone-0 max-sm:flex-col max-sm:items-stretch max-sm:rounded-2xl max-sm:px-4 max-sm:py-3 sm:flex-row sm:items-center sm:rounded-full',
        /*
          The halo follows the pill because it is set on the pill. `:not(
          [type=submit])` keeps it off when the Search button is focused —
          that button is its own control and rings itself.
        */
        'transition-shadow duration-(--duration-fast) has-[:focus-visible:not([type=submit])]:ring-3 has-[:focus-visible:not([type=submit])]:ring-clay-400/20',
        isHero
          ? 'shadow-lg sm:py-1.75 sm:pr-1.75 sm:pl-6'
          : 'border border-stone-300 shadow-sm sm:py-1 sm:pr-1 sm:pl-4',
        className,
      )}
    >
      <CategorySelect
        categories={categories}
        value={draft.category}
        onChange={(category) => setDraft((previous) => ({ ...previous, category }))}
        size={size}
        id={`${fieldId}-type`}
      />

      <span aria-hidden="true" className={divider} />

      <label className={cn(segment, isHero ? 'sm:flex-1 sm:pl-4.5' : 'sm:flex-[0.9] sm:pl-3.5')}>
        <span className={label}>City</span>
        <input
          value={draft.city}
          onChange={(event) => setDraft((previous) => ({ ...previous, city: event.target.value }))}
          placeholder="Anywhere"
          className={field}
        />
      </label>

      <span aria-hidden="true" className={divider} />

      <label
        className={cn(
          segment,
          /*
            The floor is the "Add a date" prompt plus the browser's own
            calendar glyph, which sits inside the field and is not part of the
            text's measured width — at 1024 the segment shrank to exactly the
            prompt and the glyph landed on its last letter. Same rule as the
            vendor-type segment: the width changes, not the words.
          */
          isHero ? 'sm:min-w-28 sm:flex-[0.8] sm:pl-4.5' : 'sm:min-w-26 sm:flex-[0.85] sm:pl-3.5',
        )}
      >
        <span className={label}>Event date</span>
        {/*
          An empty date reads "Add a date", not the browser's "mm/dd/yyyy" —
          the frame draws the prompt, and the placeholder attribute does
          nothing on a date input. So the native edit field is made transparent
          while it is empty and unfocused, and the prompt is laid over it;
          focusing hands the field straight back to the browser's own editor.
          See design/design-plan/10-landing.md.
        */}
        <span className={cn('relative flex min-w-0', isHero && 'mt-0.5')}>
          <input
            type="date"
            value={draft.date}
            /*
              Past dates are unselectable, not merely rejected: `min` greys them
              out in the browser's own calendar, so the rule is visible in the
              control rather than discovered on submit. Empty until the client
              knows its own day — see `today` above.
            */
            min={today || undefined}
            aria-invalid={pastDate || undefined}
            aria-describedby={pastDate ? `${fieldId}-date-error` : undefined}
            onChange={(event) => {
              setDraft((previous) => ({ ...previous, date: event.target.value }));
              setPastDate(false);
            }}
            className={cn(
              'peer w-full min-w-0 bg-transparent text-stone-900 outline-none',
              'focus-visible:ring-0 focus-visible:ring-offset-0',
              fieldText,
              draft.date === '' && 'text-transparent focus:text-stone-600',
            )}
          />
          {draft.date === '' ? (
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-y-0 left-0 flex items-center text-stone-600 peer-focus:hidden',
                fieldText,
              )}
            >
              Add a date
            </span>
          ) : null}
        </span>
      </label>

      {pastDate ? (
        /*
          Absolute, so showing it moves nothing: the compact bar lives inside a
          header measured at exactly 64px, and on the hero a reflow would push
          the category row past the 836px fold that `10-landing.md` requires.
          It sits on its own surface because what is behind it is a photograph
          on one screen and a result grid on the other.
        */
        <p
          id={`${fieldId}-date-error`}
          role="alert"
          className="absolute top-full left-0 z-(--z-sticky) mt-2 rounded-lg bg-stone-0 px-3 py-2 text-sm text-stone-700 shadow-md max-sm:static max-sm:mt-3 max-sm:px-0 max-sm:shadow-none"
        >
          That date has already passed — pick today or a later date.
        </p>
      ) : null}

      {isIconAction ? (
        /*
          The one place the label is dropped, per frames `17` and `18`: inside
          the 64px header the three segments and a "Search" word cannot both
          fit, and the date is the field that loses its width first.

          The name is dropped visually, never semantically — `aria-label`
          carries it. An icon-only control with no icon would be an unlabelled
          one rather than a reduced one, which is why the glyph below is not
          optional and the button never renders as a bare ring.
        */
        <button
          type="submit"
          aria-label="Search"
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full bg-clay-400 text-stone-0 transition-colors duration-(--duration-fast) hover:bg-clay-500',
            'ml-1.5 focus-visible:ring-offset-0',
          )}
        >
          {/*
            Drawn rather than imported: the frame's magnifier is an 11px ring
            with a 5px stem at 45°, and no icon set in the project matches those
            proportions inside a 32px circle closely enough for the parity gate.
          */}
          <span
            aria-hidden
            className="relative box-border size-2.75 rounded-full border-[1.7px] border-stone-0"
          >
            <span className="absolute -right-1 -bottom-[3px] h-[1.7px] w-[5px] rotate-45 rounded-[2px] bg-stone-0" />
          </span>
        </button>
      ) : (
        <button
          type="submit"
          className={cn(
            'shrink-0 rounded-full bg-clay-400 font-semibold text-stone-0 transition-colors duration-(--duration-fast) hover:bg-clay-500 max-sm:mt-3 max-sm:w-full max-sm:py-2.75',
            // Inside a white pill the shared 2px cream offset reads as a gap in
            // the bar, so this ring sits directly on the button's edge.
            'focus-visible:ring-offset-0',
            isHero
              ? 'sm:ml-2 sm:px-6 sm:py-2.75 sm:text-base'
              : 'sm:ml-1.5 sm:px-5 sm:py-2.5 sm:text-[12.5px]',
          )}
        >
          Search
        </button>
      )}
    </form>
  );
}
