/**
 * The vendor-type field cannot hold an unrecognised value — it resolves to a
 * seeded category or it stays empty (decision D6). That makes the no-match
 * state load-bearing: a customer who typed "wedding photographer near me" has
 * to be handed the category they meant, not an empty list.
 *
 * See design/design-plan/11-search.md.
 */

/** How many near-misses the no-match state offers. */
export const CLOSEST_CATEGORY_COUNT = 3;

/** Below this, a suggestion is noise rather than a near-miss. */
const MINIMUM_SCORE = 0.34;

/** Only the fields the ranking reads, so seeds and API rows both satisfy it. */
export interface RankableCategory {
  name: string;
  slug: string;
}

/**
 * Longest run of characters shared by both strings, as a fraction of the
 * shorter one. Cheap, no dependency, and it handles the two cases that matter:
 * a fragment of the name, and a name buried in a longer phrase.
 */
function longestCommonRun(a: string, b: string): number {
  if (a === '' || b === '') {
    return 0;
  }

  let best = 0;
  // Rolling two-row LCS-of-substrings; the full matrix is never needed.
  let previous = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        const run = (previous[j - 1] ?? 0) + 1;
        current[j] = run;
        if (run > best) {
          best = run;
        }
      }
    }
    previous = current;
  }

  return best / Math.min(a.length, b.length);
}

function score(category: RankableCategory, needle: string): number {
  const name = category.name.toLowerCase();

  if (name === needle) {
    return 1;
  }
  if (name.startsWith(needle) || needle.startsWith(name)) {
    return 0.95;
  }
  // A phrase containing the whole category name — "wedding photographer" — is a
  // stronger signal than a shared fragment, so it outranks the run score.
  if (needle.includes(name) || name.includes(needle)) {
    return 0.9;
  }

  return longestCommonRun(name, needle);
}

/**
 * The categories closest to what the customer typed, best first. Empty when
 * the input is blank (the full list is already on screen) or when nothing is
 * near enough to be a real suggestion.
 */
export function closestCategories<T extends RankableCategory>(
  categories: readonly T[],
  input: string,
): T[] {
  const needle = input.trim().toLowerCase();

  if (needle === '') {
    return [];
  }

  return categories
    .map((category) => ({ category, value: score(category, needle) }))
    .filter((scored) => scored.value >= MINIMUM_SCORE)
    .sort((a, b) => b.value - a.value || a.category.name.localeCompare(b.category.name))
    .slice(0, CLOSEST_CATEGORY_COUNT)
    .map((scored) => scored.category);
}
