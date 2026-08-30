import { createHash } from 'node:crypto';

/**
 * Deterministic primitives shared by every fabricating seed.
 *
 * A seed that disagrees with itself between runs is useless for the two things
 * these seeds exist for: reproducible marketing screenshots, and Playwright
 * suites that select on a known id. `Math.random` and `randomUUID` are
 * therefore both off the table, and the replacements live here rather than
 * privately inside one seed so a second seed cannot drift from the first.
 */

/**
 * A small deterministic PRNG (mulberry32). The seed must produce identical
 * data on every run and on every machine, so `Math.random` is not an option:
 * two runs that disagree would make a screenshot impossible to reproduce.
 */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit FNV-1a hash of a string, so each vendor's stream differs. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A stable UUID for a seeded row, derived from a namespace and a key.
 *
 * Every demo row takes its primary key from here rather than from the column
 * default, which buys two things. Idempotency stops depending on a natural
 * unique index — the seed upserts on `id`, so re-running updates the row it
 * wrote last time instead of racing a partial index. And a Playwright suite can
 * navigate straight to `/vendors/<id>` without first scraping it out of a list,
 * which is what makes a suite survive a copy change.
 *
 * SHA-1 over `namespace:key`, truncated to 16 bytes, with the RFC 4122 version
 * and variant bits forced. That is the version-5 construction with a plain
 * string standing in for the namespace UUID: well formed, and stable for as
 * long as the namespace and key are, which is all the seed needs.
 */
export function deterministicUuid(namespace: string, key: string): string {
  const bytes = createHash('sha1').update(`${namespace}:${key}`).digest().subarray(0, 16);

  // Version 5 in the high nibble of byte 6, RFC 4122 variant in byte 8.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Picks one item from a list using a seeded stream.
 *
 * Lives here beside `makeRandom` rather than privately in one seed, because a
 * private copy is how the next seed ends up with a fourth one.
 */
export function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];

  if (item === undefined) {
    throw new Error('pick: cannot choose from an empty list');
  }

  return item;
}
