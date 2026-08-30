/**
 * The calendar cell marks, in one place.
 *
 * Frame `28`'s note on the date picker is explicit: *"The customer-side picker
 * inherits the vendor calendar's marks exactly — one visual language for dates
 * across both sides of the product."* Two copies of a hatch is how that stops
 * being true, so both calendars read the marks from here.
 *
 * The vendor's calendar (`availability-calendar.tsx`) has five states because a
 * vendor distinguishes booked from blocked from pending. A customer choosing a
 * date does not: three of those states mean "you cannot have this day" and one
 * means "someone else is asking about it". The **marks** are the same; which
 * states map onto them is each surface's own business.
 */

/**
 * Unavailable: a 45° hatch, struck through.
 *
 * `stone-200`/`stone-300` rather than the frame's `#EFE9E0`/`#E0D8CA`, and
 * `stone-700` rather than its `#6B6459` — ruled in #301 and kept here. The
 * frame's pairing measures **4.13:1** against the dark stripe, and a numeral's
 * strokes cross both stripes, so "the average clears" was never an answer.
 * `#E0D8CA` is in no token file either.
 */
export const CELL_HATCH =
  'bg-[repeating-linear-gradient(-45deg,var(--color-stone-200)_0_3px,var(--color-stone-300)_3px_6px)]';

/** Unavailable, complete: the hatch plus the strike and its text colour. */
export const CELL_UNAVAILABLE = `text-stone-700 line-through ${CELL_HATCH}`;

/** Held — waiting on someone. Gold, dashed, per `40-states.md`'s semantics. */
export const CELL_HELD =
  'bg-gold-50 font-semibold text-gold-600 border-[1.5px] border-dashed border-gold-400';

/** Today: an ink outline, no fill — it marks the date, it does not claim it. */
export const CELL_TODAY = 'border-[1.5px] border-stone-900 font-semibold text-stone-900';

/** The chosen day: the one solid clay fill on the grid. */
export const CELL_SELECTED = 'bg-clay-400 font-semibold text-stone-0';

/** A day that can be chosen. */
export const CELL_AVAILABLE = 'bg-stone-0 text-stone-900';

/** In the month, but already gone. */
export const CELL_PAST = 'bg-stone-50 text-stone-500';
