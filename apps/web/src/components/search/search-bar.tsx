'use client';

import {
  isPastDate,
  todayDateString,
  type Category,
  type VendorCity,
} from '@vendor-marketplace/shared';
import { useEffect, useId, useState } from 'react';
import { useViewerToday } from '@/lib/use-viewer-today';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { DateDropdown } from '@/components/ui/dropdown-date';
import { CategorySelect } from './category-select';
import { CitySelect } from './city-select';
import { useSearchStatus } from './search-status';

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
/*
 * The date the customer picked, in the frames' words rather than the browser's.
 *
 * Every search frame draws a formatted value and **none** draws a picker:
 * `Jun 14, 2026` in `17` and `18` at 1440, `Jun 14` in the three at 1024.
 * Frame `02` draws `Sun, Jun 14`, but it is one frame against five and #102
 * ruled for the majority.
 *
 * Parsed as UTC. A `DATE` is a plain `YYYY-MM-DD` string and must never be
 * round-tripped through a local-time `Date` — west of UTC that moves the event
 * a day, which is the defect `shared-contracts.md` calls out by name.
 */
const PICKED_DATE_FORMATTERS = {
  /** 1440 and up. */
  full: new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }),
  /** 1024, where the segment has no room for the year. */
  short: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
} as const;

export interface SearchBarValues {
  /** A category slug, or `''` for "any vendor type". Never free text. */
  category: string;
  /** Chosen as a pair with `state`, never typed — see `CitySelect`. */
  city: string;
  state: string;
  date: string;
}

export interface SearchBarProps {
  categories: readonly Category[];
  /** Every city with a published vendor, so City can only ask a real question. */
  cities: readonly VendorCity[];
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
  cities,
  value,
  onSubmit,
  size = 'compact',
  action = 'pill',
  className,
}: SearchBarProps): React.ReactElement {
  const [draft, setDraft] = useState<SearchBarValues>(value);
  const [pastDate, setPastDate] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  /*
   * Guarded: `draft.date` is whatever the URL carried, and an unparseable value
   * would otherwise reach `Intl` and throw `RangeError: Invalid time value`,
   * turning a bad query string into a 500 on a URL anyone can paste.
   */
  const pickedDate = draft.date === '' ? null : new Date(`${draft.date}T00:00:00Z`);
  const formattedDate =
    pickedDate && !Number.isNaN(pickedDate.getTime())
      ? {
          full: PICKED_DATE_FORMATTERS.full.format(pickedDate),
          short: PICKED_DATE_FORMATTERS.short.format(pickedDate),
        }
      : { full: draft.date, short: draft.date };
  const fieldId = useId();

  /*
   * Today, for the date field's floor — the viewer's own day, resolved after
   * mount by the shared hook rather than by this component's own copy of the
   * pattern (#409).
   *
   * The seed is deliberately empty rather than the server's day. There is no
   * server day worth having here: the bar renders on the landing hero and in
   * the search shell, neither of which passes one down, and `isPastDate`
   * against `''` is false for every date — so the first paint offers the whole
   * calendar and the floor appears a tick later, which is what it did before.
   * Feeding `todayDateString()` in at render time instead is what produced a
   * hydration mismatch on the picker's cell classes across a date boundary.
   *
   * It is only the picker's floor. Whether a *submitted* date is past is asked
   * again at submit time against a fresh clock, so a tab left open across
   * midnight cannot smuggle yesterday through.
   */
  const today = useViewerToday('');

  // The URL is the source of truth: a back-navigation has to be reflected here,
  // not overwritten by a stale draft.
  useEffect(() => {
    setDraft(value);
    setPastDate(false);
  }, [value]);

  const isHero = size === 'hero';
  const isIconAction = action === 'icon';
  /*
   * Frames `17` and `25 — loading` put a spinner in the compact bar's control
   * while a search runs. Outside a `SearchStatusProvider` — the landing hero —
   * this is always false, so the hero is untouched.
   */
  const { isSearching } = useSearchStatus();

  /*
   * `.lbl` is 10.5px in the bundle and `01 Landing` takes it unmodified, but
   * both narrow landing frames override it inline to 9.5px — the same size the
   * compact bar already uses everywhere.
   */
  const label = cn(
    'font-semibold tracking-label text-stone-600 uppercase',
    isHero ? 'text-[9.5px] min-[90rem]:text-label' : 'text-[9.5px]',
  );
  /*
   * The hero's value type: 14px at 768, 13.5px at 1024, 15px at 1440.
   *
   * **No weight here.** `14 Landing tablet` sets `font-weight:500` on the
   * vendor-type value and on that span alone — City and Event date stay at 400.
   * An earlier reading of this took the weight for a property of the bar and
   * put it on all three, which is the sort of generalisation a single sample
   * invites: one span carried it, so the rule looked like "the 768 bar is
   * heavier". It is not. `CategorySelect` carries its own 500.
   */
  /*
   * The compact bar's value is 13px/500 in frames `17` and `18`, measured at
   * 1440 during #297's pass; it rendered 13.5px/400. Frame `02`'s header is
   * ruled stale by #57, so `17`/`18` are the authority for this bar.
   *
   * This does **not** contradict the note above. That one is about the 768
   * bar, where a single span carried a 500 and the rule was wrongly read off
   * one sample; this is the 1440 compact header, measured on all three
   * segments. `CategorySelect` still carries its own 500, so it is unchanged
   * by this and stays the reason not to generalise from it.
   */
  const fieldText = isHero
    ? 'text-[14px] lg:text-[13.5px] min-[90rem]:text-md'
    : 'text-[13px] font-medium';
  /*
   * The `field` class this used to hold is gone with the last text input on the
   * bar (#167). All three segments are dropdown triggers now, and each carries
   * its own value type — the ring rule it documented still holds and still
   * lives on the bar itself, in `segment` below.
   */
  /*
   * Below `sm` the three segments stack into a three-row card. They are the
   * query, not a refinement, so they never collapse into the filter sheet — but
   * three flex segments across 390px squeezes each to a few characters, which
   * is worse than a taller control. See design/design-plan/30-responsive.md.
   */
  /*
   * A short hairline at every width: 32px at 1440, 28px at 1024, 29px at 768.
   *
   * `14 Landing tablet` draws no divider element — it puts `border-right: 1px
   * #EFE9E0` on the segments instead. That is rendered as this same span rather
   * than restructured into three borders, because the two are pixel-identical
   * and one element is easier to keep honest than three. It does pick up the
   * frame's lighter colour there.
   *
   * **29px, not the bar's height.** The bar is `align-items:center`, so a
   * border on a segment runs the *segment's* height inside the taller content
   * box — 29px in a 40px box. Two wrong readings of that in a row: `h-full`
   * resolved to 0 against an indefinite container and drew nothing, then
   * `self-stretch` drew the whole 40px box. Both were attempts to derive a
   * height that the frame simply states.
   */
  const divider = cn(
    'shrink-0 bg-stone-200 max-sm:h-px max-sm:w-full sm:w-px sm:bg-stone-300',
    isHero
      ? 'sm:h-7.25 sm:bg-stone-200 lg:h-7 lg:bg-stone-300 min-[90rem]:h-8'
      : 'sm:h-6.5 sm:bg-stone-200',
  );
  /*
   * #89. The halo on the pill says the bar has focus; it cannot say *which*
   * segment has it, so focusing `Vendor type` and focusing `City` rendered
   * pixel-identically and a keyboard user could not tell them apart.
   *
   * #73 law 2 then asked for a per-segment ring at the law's value. #89 had
   * rejected an *outward* one for a reason that still holds — a rectangular
   * ring around one segment breaks out past the pill's edge and reads as a
   * second, misaligned box — so this is an **inset** ring: the law's width and
   * colour, staying inside the bar and following the segment's own
   * `rounded-full`. The tint #89 added stays alongside it; two cues cost
   * nothing and the tint is what reads at a glance.
   */
  const segment = cn(
    'flex min-w-0 flex-col max-sm:w-full max-sm:px-0 max-sm:py-1.5',
    'rounded-full transition-colors duration-(--duration-fast) has-[:focus-visible]:bg-clay-400/10',
    'has-[:focus-visible]:inset-ring-2 has-[:focus-visible]:inset-ring-clay-400/30',
  );

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
          ? /*
              Padding and shadow per frame: `6 6 6 20` at 768, `6 6 6 18` at
              1024, `7 7 7 24` at 1440, and a 26px blur at 768 against 28
              elsewhere.
            */
            'shadow-[0_8px_26px_rgba(35,32,28,.10)] sm:py-1.5 sm:pr-1.5 sm:pl-5 lg:pl-4.5 lg:shadow-lg min-[90rem]:py-1.75 min-[90rem]:pr-1.75 min-[90rem]:pl-6'
          : /*
              A fixed height from `lg`, because the compact bar sits inside a
              header of its own fixed height and the frames measure it: 40px at
              1024 (`25`), 42px at 1440 (`17`, `18`). Below `lg` the bar is not
              in the header at all — `SearchShell` renders it as its own row —
              so it keeps its padding-driven height there.
            */
            'border border-stone-300 shadow-sm sm:py-1 sm:pr-1.25 sm:pl-4.5 lg:h-10 lg:py-0 min-[90rem]:h-[42px]',
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

      {/*
        City is a select over the places that actually have vendors, and it
        carries the state with it (#167). Typed, it could not distinguish the
        two Portlands or the thirty Springfields, and a city nobody works in
        produced an empty grid with nothing to say about why.
      */}
      <CitySelect
        cities={cities}
        city={draft.city}
        state={draft.state}
        onChange={(next) => setDraft((previous) => ({ ...previous, ...next }))}
        size={size}
        id={`${fieldId}-city`}
        labelClassName={label}
        valueClassName={cn(fieldText, isHero && 'lg:mt-0.25 min-[90rem]:mt-0.5')}
        className={cn(
          segment,
          isHero
            ? 'sm:flex-1 sm:pr-3.5 sm:pl-3.5 lg:pr-0 min-[90rem]:pl-4.5'
            : 'sm:flex-[0.9] sm:pl-4',
        )}
      />

      <span aria-hidden="true" className={divider} />

      {/*
        The date is a designed picker, not the browser's (#167, #328).

        What stood here was an elaborate apology for a native `input[type=date]`:
        the edit field made transparent so `mm/dd/yyyy` would not show, a prompt
        laid over it, and the whole thing handed back to the browser on focus.
        The frames draw none of that, and the picker it opened was a different
        control on every platform — nothing the design could specify. Frame `28`
        draws the replacement, and it shares the vendor calendar's cell marks.
      */}
      <DateDropdown
        open={dateOpen}
        onOpenChange={setDateOpen}
        label={isHero ? 'Event date' : 'Date'}
        value={draft.date === '' ? null : draft.date}
        today={today}
        width={isHero ? 'hero' : 'compact'}
        scrim={isHero}
        onChange={(next) => {
          setDraft((previous) => ({ ...previous, date: next ?? '' }));
          setPastDate(false);
        }}
        trigger={
          <button
            type="button"
            aria-label={isHero ? 'Event date' : 'Date'}
            aria-haspopup="dialog"
            aria-expanded={dateOpen}
            /*
              `aria-describedby` and not `aria-invalid`: a `button` does not
              support the second, so it announced nothing. The complaint itself
              carries `role="alert"`, so it is spoken when it appears, and this
              ties it to the control it is about for anyone arriving later.
            */
            aria-describedby={pastDate ? `${fieldId}-date-error` : undefined}
            className={cn(
              segment,
              'text-left',
              /*
                The floor is the "Add a date" prompt. It used to be that prompt
                plus its caret; D25 removed the glyph and these minima were left
                over-reserving by its width, which is harmless — a floor, not a
                fixed width — and is recorded rather than re-derived by eye. The
                rule is unchanged: the width changes, not the words.
              */
              isHero
                ? /* .9 at 768, .8 from 1024. 768 also pads the field on both
                     sides rather than only the left. */
                  'sm:min-w-28 sm:flex-[0.9] sm:pr-3.5 sm:pl-3.5 lg:flex-[0.8] lg:pr-0 min-[90rem]:pl-4.5'
                : 'sm:min-w-26 sm:flex-[0.85] sm:pl-4',
            )}
          >
            {/*
              "Event date" on the hero, "Date" in the compact bar. Frame `02`
              draws the long form, but the five frames that show the compact bar
              in a working state — `17`, `18` and the three at 1024 — all draw
              "Date", and the short form is what leaves the segment room for a
              date. The single frame is the stale one.
            */}
            <span className={label}>{isHero ? 'Event date' : 'Date'}</span>
            <span
              className={cn(
                'flex min-w-0 items-center justify-between gap-2 pr-2.5',
                /* The same baseline ladder as `field` — 0 at 768, 1px at 1024,
                   2px at 1440. */
                isHero && 'lg:mt-0.25 min-[90rem]:mt-0.5',
              )}
            >
              <span
                className={cn(
                  'truncate',
                  fieldText,
                  /* The open state the caret used to carry (D25). */
                  dateOpen
                    ? 'font-semibold text-clay-600'
                    : draft.date === ''
                      ? 'text-stone-600'
                      : 'text-stone-900',
                )}
              >
                {draft.date === '' ? (
                  'Add a date'
                ) : (
                  <>
                    {/*
                      Both spellings are rendered and one is hidden by width,
                      rather than picked in JS: a media query in state would
                      have to be resolved after mount, and the segment would
                      render the wrong one on the server and then change under
                      the reader.
                    */}
                    <span className="min-[90rem]:hidden">{formattedDate.short}</span>
                    <span className="max-[90rem]:hidden">{formattedDate.full}</span>
                  </>
                )}
              </span>
            </span>
          </button>
        }
      />

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
            // 30px at 1024, 32px from 1280 — the circle follows the bar.
            'relative flex size-7.5 shrink-0 items-center justify-center rounded-full bg-clay-400 text-stone-0 transition-colors duration-(--duration-fast) hover:bg-clay-500 min-[90rem]:size-8',
            /*
              `04-laws.md:137`: an icon-only control carries a 44x44 hit area.
              The circle keeps the size the frames draw — #57 settled that it is
              a circle rather than a labelled pill — so the target grows past the
              paint instead of the paint growing. A hit area may exceed its own
              control; what it may not be is 32px.

              Centred on the circle, so what it gains on the left lands on the
              bar's own `ml-1.5` gap rather than on a neighbour. Measured at
              1440, where the circle is 32px: the target's left edge and the
              date field's right edge both sit at 623.7, abutting with 0px
              overlap, and the date field's own edge stays clickable.

              That margin is exact rather than generous, and it is the 32px
              circle that makes it so — (44 - 32) / 2 is precisely the 6px gap.
              Between `lg` and `xl` the circle is 30px, so the target reaches
              7px and covers the date label's last pixel column. One pixel, and
              the law is the harder constraint of the two, so it stands — but it
              is a real overlap and not a claim of clearance at every width.
            */
            "after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
            'ml-1.5 focus-visible:ring-offset-0',
          )}
        >
          {isSearching ? (
            /*
              The control keeps its shape and swaps its glyph while a search is
              in flight — frames `17` and `25`. A ring that vanished would move
              the target under a cursor already aimed at it.
            */
            <Spinner className="size-3.5 border-stone-0/35 border-t-stone-0" />
          ) : (
            /*
              Drawn rather than imported: the frame's magnifier is an 11px ring
              with a 5px stem at 45°, and no icon set in the project matches
              those proportions inside a 32px circle closely enough for the
              parity gate.
            */
            <span
              aria-hidden
              className="relative box-border size-2.75 rounded-full border-[1.7px] border-stone-0"
            >
              <span className="absolute -right-1 -bottom-[3px] h-[1.7px] w-[5px] rotate-45 rounded-[2px] bg-stone-0" />
            </span>
          )}
        </button>
      ) : (
        <button
          type="submit"
          className={cn(
            'shrink-0 rounded-full bg-clay-400 font-semibold text-stone-0 transition-colors duration-(--duration-fast) hover:bg-clay-500 max-sm:mt-3 max-sm:w-full max-sm:py-2.75',
            /*
              Inside a white pill the shared 2px cream offset reads as a gap in
              the bar, so this ring sits directly on the button's edge.

              **Do not "fix" this by restoring the offset.** #296 tried exactly
              that and it inverts the intent, because Tailwind's ring is an
              *outward* box-shadow: with `ring-offset-0` the ring band is
              already painted outside the border box, directly against the
              `clay-400` fill, and that boundary measures **3.18:1** — the one
              edge of this indicator that clears SC 1.4.11. Adding a 2px
              `stone-0` offset inserts the colour that was already there and
              pushes the coloured band two pixels off the button, leaving it
              bounded by cream on *both* sides at **1.52:1**. Measured in
              Chromium by scanning a pixel row outward through the button edge.

              The ring is faint against cream either way, and that is a property
              of `ring-clay-400/30`, not of where the band sits: #73 filed it
              for **#306** — the token measures 1.49:1 where the law wants 3:1,
              and clay needs alpha >= 0.80. Re-grounding the offset here cannot
              fix a token problem, and it costs the one good edge.
            */
            'focus-visible:ring-offset-0',
            isHero
              ? /*
                  13px at `12 24` at 768, 13px at `11 20` at 1024, 14px at
                  `13 28` at 1440 — the pill shrinks with the bar around it
                  rather than staying the 1440 control in a 50px bar.
                */
                'sm:px-6 sm:py-3 sm:text-[13px] lg:px-5 lg:py-2.75 min-[90rem]:px-7 min-[90rem]:py-3.25 min-[90rem]:text-cta'
              : 'sm:ml-1.5 sm:px-5 sm:py-2.5 sm:text-[12.5px]',
          )}
        >
          Search
        </button>
      )}
    </form>
  );
}
