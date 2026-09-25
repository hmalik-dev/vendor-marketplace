/**
 * The legal or statistical class the Gazetteer appends to every name —
 * `Abbeville city`, `Abanda CDP`, `Sitka city and borough`. It is a
 * classification, not part of what anyone calls the place, so it comes off.
 *
 * The `+` matters: several stack, so `Athens-Clarke County unified government
 * (balance)` has to shed `government` and then `balance` in one pass.
 *
 * No two alternatives may read the same text. `city and borough` used to be
 * listed beside `city` and `and borough`, so a run of it split into
 * exponentially many parses when the match failed; `city` then `and borough`
 * strips exactly the same words.
 */
export const PLACE_CLASS_SUFFIX =
  /(?:\s+(?:city|town|village|borough|municipality|CDP|comunidad|zona urbana|consolidated government|metro government|metropolitan government|unified government|corporation|plantation|charter township|township|and borough|balance))+$/i;

export function stripPlaceClass(raw: string): string {
  return raw
    .replace(/\s*\((?:balance|part)\)\s*$/i, '')
    .replace(PLACE_CLASS_SUFFIX, '')
    .trim();
}
