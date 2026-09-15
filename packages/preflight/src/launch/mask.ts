/** `sk_live_`, `sk_test_`, `re_` — the part of a key that names what it is, not what it unlocks. */
const KEY_PREFIX = /^[a-z]+_(?:(?:live|test)_)?/i;
/** Below this many hidden characters, even the last four give too much away. */
const MIN_HIDDEN = 8;
const VISIBLE_SUFFIX = 4;

/** Reduces a secret to its prefix and last four characters, e.g. `sk_live_…1a2b`. */
export function mask(value: string): string {
  const prefix = KEY_PREFIX.exec(value)?.[0] ?? '';
  const rest = value.slice(prefix.length);

  return rest.length > MIN_HIDDEN ? `${prefix}…${rest.slice(-VISIBLE_SUFFIX)}` : `${prefix}…`;
}
