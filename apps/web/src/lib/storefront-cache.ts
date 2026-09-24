import 'server-only';

/**
 * How long one server instance shares a storefront's public reads between
 * visitors (VEN-610). A vendor's edit showing within a minute is acceptable,
 * and it turns a wave of visits to one shared link into about one API read per
 * minute per read, instead of six per view.
 */
export const STOREFRONT_CACHE_TTL_MS = 60_000;

/**
 * More than a directory of real storefronts needs, and a hard ceiling on what a
 * crawler cycling slugs can make the process hold: a slug nobody owns is cached
 * too (as its `null`), so the keys are attacker-chosen.
 */
const MAX_ENTRIES = 500;

interface Entry {
  expiresAt: number;
  value: Promise<unknown>;
}

const entries = new Map<string, Entry>();

/**
 * Reads `key` through a per-process cache with a **hard** expiry, sharing one
 * in-flight `load` between concurrent callers.
 *
 * In-process rather than Next's Data Cache (`fetch` with `revalidate`), for two
 * reasons found in review. A stale Data Cache entry is served while a refresh
 * runs, and Next writes a refresh only when the API answers 200, so a
 * storefront the API had since taken down (a ban, an unpublish) kept rendering
 * from its stale 200 with no bound at all. And a `revalidate` fetch cannot carry
 * the visitor's address (request headers are part of the cache key), so every
 * miss counted against the web platform's one shared rate-limit bucket, which a
 * crawler cycling dead slugs could drain for everyone. Here a miss runs in the
 * request of the visitor who caused it, under their own address.
 *
 * Only what the reads share may go through this: nothing that depends on who is
 * asking. A rejected `load` is forgotten at once, so an outage or a timeout is
 * never cached — only an answer is.
 */
export function readShared<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);

  if (hit && hit.expiresAt > now) {
    return hit.value as Promise<T>;
  }

  entries.delete(key);
  evict(now);

  const value = load();
  const entry: Entry = { expiresAt: now + STOREFRONT_CACHE_TTL_MS, value };
  entries.set(key, entry);

  value.catch(() => {
    // Only forget this attempt: a newer entry under the key is not ours to drop.
    if (entries.get(key) === entry) {
      entries.delete(key);
    }
  });

  return value;
}

/** Drops what has expired, then the oldest entries, until there is room for one more. */
function evict(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) {
      entries.delete(key);
    }
  }

  for (const key of entries.keys()) {
    if (entries.size < MAX_ENTRIES) {
      return;
    }
    entries.delete(key);
  }
}

/** Test seam: the cache is module state, so a suite that varies the answer clears it. */
export function resetStorefrontCache(): void {
  entries.clear();
}
