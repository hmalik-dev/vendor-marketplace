import { normaliseForMatch } from '@vendor-marketplace/shared';
import type { DropdownOption } from '@/components/ui/dropdown';

/**
 * Matching for the search-entry comboboxes.
 *
 * `#375` built a filtering combobox for `Vendor type` and a typeahead for
 * `City`, and required that the two must not differ in *how a character is
 * compared* — two bespoke normalisers that drift apart is the failure mode the
 * ticket names, and it shows up as "San José matches but San Jose does not" on
 * one field and not the other.
 *
 * **#384 moved the City half out of this file entirely.** Its suggestions now
 * arrive ranked from `GET /places` rather than being filtered here, because the
 * list is no longer in the browser to filter — that was the preload the user's
 * instruction removed. `rankCityMatches` and its `vendorCount` tie-break went
 * with it: the two tiers it computed are SQL in `places.dao.ts` now, and the
 * shared comparison #375 asked for is `normaliseForMatch` in `packages/shared`,
 * which the API and the seed both call. It is *more* shared than it was, not
 * less — that is what lets the seed write a `search_name` the API can match.
 */

/**
 * Substring anywhere in the label, not prefix-only.
 *
 * The ticket's own example is the reason: `film` has to find `Photo & film`,
 * which a prefix match never would. It replaces the type-ahead *jump* the list
 * shipped with — `42-dropdowns.md` has specified "typing narrows the list in
 * place (not a jump-to-first-letter)" since the 2026-08-30 import, and D14
 * recorded that the code was still on the reversed-away behaviour.
 *
 * **Labels only.** The category rows carry a short description as a hint, and
 * it is deliberately not matched: filtering you cannot see the reason for reads
 * as a bug, and a row surviving on words that are not on screen is exactly
 * that.
 */
export function filterOptions(
  options: readonly DropdownOption[],
  query: string,
): readonly DropdownOption[] {
  const needle = normaliseForMatch(query);

  if (needle === '') {
    return options;
  }

  return options.filter((option) => normaliseForMatch(option.label).includes(needle));
}
