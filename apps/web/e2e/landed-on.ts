/**
 * Whether a browser URL is exactly `path`, ignoring the query string and hash.
 *
 * Compares the parsed pathname rather than building a pattern from the route:
 * a route holding `.`, `?` or `[` would otherwise over-match a different page,
 * and a role-gating assertion that says "not here" would pass on the wrong one.
 */
export function landedOn(url: string, path: string): boolean {
  return new URL(url).pathname === path;
}
