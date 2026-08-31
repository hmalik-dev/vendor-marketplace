import type { DropdownOption } from '@/components/ui/dropdown';

/**
 * Matching for the two search-entry comboboxes, in one place.
 *
 * `#375` builds a filtering combobox for `Vendor type` and a typeahead for
 * `City`. They differ in what they match and how they rank, and they must not
 * differ in *how a character is compared* — two bespoke normalisers that drift
 * apart is the failure mode the ticket names, and it shows up as "San José
 * matches but San Jose does not" on one field and not the other.
 */

/**
 * Case- and diacritic-insensitive, whitespace-collapsed.
 *
 * `NFD` splits an accented character into its base letter plus a combining
 * mark, and the range strips the marks — so `José` becomes `jose` and matches
 * a customer who typed either spelling. Both sides go through this, which is
 * what makes it symmetric: `San Jose` finds `San José` **and** the reverse.
 */
export function normaliseForMatch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

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

/**
 * The city typeahead's ranking, which the category field does not need.
 *
 * Three tiers, in the ticket's order: **exact prefix matches first, then
 * substring matches, then by `vendorCount` descending**. The count tiebreak is
 * why `Portland, OR` leads `Portland, ME` for a customer typing `portl` — both
 * are real places and neither is wrong, so the one more people can actually
 * book comes first.
 *
 * The comma is what makes `Austin, TX` work: without it a typed comma matches
 * nothing, because the needle spans the label's own separator. With it the
 * state code is matched too, which is the only way a customer distinguishes two
 * cities of the same name by typing.
 */
export function rankCityMatches(
  options: readonly DropdownOption[],
  query: string,
  counts: ReadonlyMap<string, number>,
): readonly DropdownOption[] {
  const needle = normaliseForMatch(query);

  if (needle === '') {
    return [];
  }

  const scored: { option: DropdownOption; tier: number; count: number }[] = [];

  for (const option of options) {
    const label = normaliseForMatch(option.label);
    /*
     * The city half alone, so `aus` is a *prefix* match for `Austin, TX` rather
     * than merely a substring of the whole label. Without this every match is
     * tier 1 and the ordering the ticket asks for never happens.
     */
    const cityOnly = label.split(',')[0] ?? label;

    if (cityOnly.startsWith(needle) || label.startsWith(needle)) {
      scored.push({ option, tier: 0, count: counts.get(option.value) ?? 0 });
      continue;
    }

    if (label.includes(needle)) {
      scored.push({ option, tier: 1, count: counts.get(option.value) ?? 0 });
    }
  }

  return scored
    .sort((left, right) => left.tier - right.tier || right.count - left.count)
    .map((entry) => entry.option);
}
