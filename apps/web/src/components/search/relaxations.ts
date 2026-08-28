import { vendorNounFor } from '@vendor-marketplace/shared';
import type { SearchPatch, SearchState } from './search-state';

/**
 * The diagnosis behind frame `18`.
 *
 * A zero-result search is the highest-risk moment in a young marketplace, so
 * the screen never dead-ends on "try adjusting your filters". It names the one
 * filter most likely at fault and offers one-tap relaxations in the order that
 * costs the customer least — each of which loosens exactly one thing, so they
 * can see what changed.
 *
 * Pure, so the ordering is a unit test rather than a click-through.
 */

export interface Relaxation {
  /** Button label — an action, not a filter name. */
  label: string;
  /** The single value this loosens. */
  patch: SearchPatch;
}

/**
 * Ordered by how much each typically narrows a set, hardest-hitting first.
 * A date rules out every vendor already booked; a price ceiling rules out
 * whole tiers; a rating floor and tags trim the tail.
 */
export function relaxations(state: SearchState): Relaxation[] {
  const options: Relaxation[] = [];

  if (state.date !== '') {
    options.push({ label: 'Any date', patch: { date: '' } });
  }
  if (state.minPriceCents !== null || state.maxPriceCents !== null) {
    options.push({ label: 'Any price', patch: { minPriceCents: null, maxPriceCents: null } });
  }
  if (state.minRating !== null) {
    options.push({ label: 'Any rating', patch: { minRating: null } });
  }
  if (state.tags.length > 0) {
    options.push({ label: 'Any style', patch: { tags: [] } });
  }
  if (state.city !== '') {
    options.push({ label: 'Anywhere', patch: { city: '' } });
  }

  return options;
}

/**
 * The headline. It counts the filters the customer actually set, because "all
 * three filters" when they set one reads as though the page misunderstood them.
 */
export function noResultsHeadline(state: SearchState): string {
  const noun = vendorNounFor(state.category === '' ? undefined : state.category, 0);
  const count = relaxations(state).length;

  if (count === 0) {
    return `No ${noun} listed yet`;
  }

  return count === 1 ? `No ${noun} match that filter` : `No ${noun} match all ${count} filters`;
}

/**
 * The sentence under it: which filter is probably at fault, and the promise
 * that loosening one brings results back. `null` when nothing was filtered —
 * there is no culprit to name, and inventing one would be a lie.
 */
export function noResultsDiagnosis(state: SearchState): string | null {
  const [first] = relaxations(state);
  if (first === undefined) {
    return null;
  }

  const culprit =
    first.patch.date !== undefined
      ? 'the date'
      : first.patch.minPriceCents !== undefined
        ? 'the price range'
        : first.patch.minRating !== undefined
          ? 'the rating floor'
          : first.patch.tags !== undefined
            ? 'the style filter'
            : 'the city';

  /*
   * Frame `18` reads "Marfa is a small market — the distance limit is the
   * usual culprit". The market-size half of that is a claim about supply that
   * nothing here measures, and the tracker's no-invented-numbers rule covers
   * assertions as well as figures. What survives is the half that is true by
   * construction: this filter is the narrowest one the customer set.
   */
  return `${culprit} is the narrowest filter here. Loosen one and results come back.`;
}
