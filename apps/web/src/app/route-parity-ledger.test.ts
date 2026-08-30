import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * #319. Parity is unprovable on a route with no frame, and nothing forced the
 * design ledger to keep up with `apps/web/src/app` — four routes landed
 * between the 2026-08-28 mapping and #306's 2026-08-30 ruling and nobody
 * noticed, taking the unframed count from five to nine. This file is the
 * guard `#306` filed for: it reads the two documents by hand, at test time,
 * rather than keeping its own shadow list — a shadow list would pass the
 * exact silent-arrival case this exists to catch.
 *
 * Two documents, two jobs:
 *  - `.claude/plans/parity-sweep-ledger.md` maps *frames* to the live routes
 *    that render them (`| # | Frame | Live route | ... |`).
 *  - `design/design-plan/00-README.md` records every route #306 ruled on
 *    that has no frame — either exempt, or acknowledged and still needing
 *    one — each with a reason.
 *
 * A route is accounted for iff it is drawn by some frame OR it has a row in
 * the README ruling table. Only "present nowhere" fails.
 */

const REPO_ROOT = join(process.cwd(), '..', '..');
const APP_DIR = join(process.cwd(), 'src/app');

// ---------------------------------------------------------------------------
// Enumerate the live routes.
// ---------------------------------------------------------------------------

interface RouteFile {
  /** Path relative to `src/app`, e.g. `vendors/[slug]/page.tsx`. */
  path: string;
}

function walk(directory: string, collected: RouteFile[] = []): RouteFile[] {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);

    if (statSync(absolute).isDirectory()) {
      walk(absolute, collected);
      continue;
    }

    collected.push({ path: absolute.slice(APP_DIR.length + 1) });
  }

  return collected;
}

const PAGE_FILES = walk(APP_DIR).filter(
  (file) => file.path === 'page.tsx' || file.path.endsWith(`${sep}page.tsx`),
);

/**
 * A Next.js file-system path to the URL pattern it serves: route groups
 * `(name)` are zero-width, dynamic segments `[slug]` are kept literally, and
 * a trailing catch-all (`[...x]` / `[[...x]]`) is dropped rather than kept —
 * both documents talk about the mount point (`/sign-in`), never about
 * Clerk's own nested paths underneath it.
 */
export function toRoutePattern(filePath: string): string {
  let segments = filePath
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment));

  while (segments.length > 0 && /^\[{1,2}\.\.\./.test(segments[segments.length - 1] as string)) {
    segments = segments.slice(0, -1);
  }

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

/**
 * One page.tsx per dynamic pattern is all Next's file-system router allows,
 * so the walk above already collapses `[slug]` to one entry — but the
 * `Set` still de-duplicates explicitly, so the guarantee is asserted rather
 * than assumed (acceptance: dynamic segments resolve to one entry each).
 */
const ROUTE_PATTERNS = [...new Set(PAGE_FILES.map((file) => toRoutePattern(file.path)))].sort();

// ---------------------------------------------------------------------------
// Turn a route pattern into a matcher for a literal path string.
// ---------------------------------------------------------------------------

/** `/vendors/[slug]/request` -> `/^\/vendors\/[^/]+\/request\/?$/`. */
export function patternToRegex(pattern: string): RegExp {
  const parts = pattern.split('/').filter(Boolean);

  if (parts.length === 0) {
    return /^\/?$/;
  }

  const body = parts
    .map((part) => (/^\[.+\]$/.test(part) ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');

  return new RegExp(`^/${body}/?$`);
}

// ---------------------------------------------------------------------------
// Read the two ledger documents.
// ---------------------------------------------------------------------------

const SWEEP_LEDGER_PATH = join(REPO_ROOT, '.claude', 'plans', 'parity-sweep-ledger.md');
const README_PATH = join(REPO_ROOT, 'design', 'design-plan', '00-README.md');

const sweepLedger = readFileSync(SWEEP_LEDGER_PATH, 'utf8');
const readme = readFileSync(README_PATH, 'utf8');

/**
 * The `Live route` column of the frame table, as literal path strings — a
 * mix of exact paths (`/search`) and one concrete instance of a dynamic
 * route (`/vendors/june-harlow/request`); either is fine, because matching
 * happens by regex from the enumerated pattern's side. Rows with no route at
 * all (`blocked by #68`, `derive from base screen`, `NO ROUTE — #15`, …)
 * have no leading `/` and are dropped.
 *
 * Scoped to the frame table itself (between its header row and the next `##`
 * heading) so a code-path literal inside the findings log below it — e.g.
 * `` `POST /booking-requests` `` — is never mistaken for a routed screen.
 */
export function extractFramedLiterals(markdown: string): string[] {
  const tableStart = markdown.indexOf('| # | Frame | Live route |');
  expect(tableStart, 'the frame table header moved or was renamed').toBeGreaterThan(-1);

  const tableEnd = markdown.indexOf('\n## ', tableStart);
  const table =
    tableStart === -1 ? '' : markdown.slice(tableStart, tableEnd === -1 ? undefined : tableEnd);

  return [...table.matchAll(/`(\/[^`]*)`/g)]
    .map((match) => (match[1] as string).split(/[\s?]/)[0] as string)
    .filter(Boolean);
}

/**
 * The "Routes with no frame" ruling table: route pattern -> its ruling text
 * (Exempt / Framed / Needs a frame — anything non-empty is a recorded
 * decision; "undecided" is the one outcome the table's own heading forbids).
 */
export function extractRulingTable(markdown: string): Map<string, string> {
  const headingIndex = markdown.indexOf('## Routes with no frame');
  expect(headingIndex, 'the ruling table heading moved or was renamed').toBeGreaterThan(-1);

  const tableStart = markdown.indexOf('| Route', headingIndex);
  expect(tableStart, 'no ruling table found under the heading').toBeGreaterThan(-1);

  const tableEnd = markdown.indexOf('\n\n', tableStart);
  const table = markdown.slice(tableStart, tableEnd === -1 ? undefined : tableEnd);

  const rulings = new Map<string, string>();

  // Row 0 is the header, row 1 the `---` separator.
  for (const row of table.split('\n').slice(2)) {
    const cells = row
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;

    const route = /^`(.+)`$/.exec(cells[0] as string)?.[1];
    const ruling = cells.slice(1).join(' ').trim();
    if (route && ruling) {
      rulings.set(route, ruling);
    }
  }

  return rulings;
}

const FRAMED_LITERALS = extractFramedLiterals(sweepLedger);
const RULED_ROUTES = extractRulingTable(readme);

// ---------------------------------------------------------------------------
// The guard itself.
// ---------------------------------------------------------------------------

/** Routes matching neither a drawn frame nor a recorded ruling. */
export function findUnaccountedRoutes(
  patterns: readonly string[],
  framedLiterals: readonly string[],
  ruledRoutes: ReadonlyMap<string, string>,
): string[] {
  return patterns.filter((pattern) => {
    const regex = patternToRegex(pattern);
    const framed = framedLiterals.some((literal) => regex.test(literal));
    const ruled = (ruledRoutes.get(pattern)?.length ?? 0) > 0;

    return !framed && !ruled;
  });
}

describe('every live route has a frame or a recorded exemption (#319)', () => {
  /*
   * A glob that matches nothing would make every assertion below pass
   * vacuously — this is the guard the acceptance criteria explicitly asks
   * for, so a broken enumeration is caught here rather than passing forever.
   * 21 routes exist today; a wide floor leaves room to grow without this
   * needing to be touched, while still catching "found zero" or "found one".
   */
  it('finds a plausible number of routes, so it cannot pass on an empty scan', () => {
    expect(ROUTE_PATTERNS.length).toBeGreaterThanOrEqual(15);
    expect(ROUTE_PATTERNS.length).toBeLessThan(200);
  });

  it('reads a non-empty frame table and a non-empty ruling table', () => {
    expect(FRAMED_LITERALS.length).toBeGreaterThan(10);
    expect(RULED_ROUTES.size).toBeGreaterThan(0);
  });

  it('collapses each dynamic pattern to one entry, not one per file', () => {
    const raw = PAGE_FILES.map((file) => toRoutePattern(file.path));
    expect(new Set(raw).size).toBe(raw.length);
    expect(ROUTE_PATTERNS).toContain('/vendors/[slug]');
    expect(ROUTE_PATTERNS).toContain('/bookings/[requestId]');
  });

  it('accounts for every enumerated route somewhere in the ledger', () => {
    const unaccounted = findUnaccountedRoutes(ROUTE_PATTERNS, FRAMED_LITERALS, RULED_ROUTES);

    expect(
      unaccounted,
      `these routes appear in apps/web/src/app but have neither a frame in ` +
        `${SWEEP_LEDGER_PATH} nor a recorded exemption in ${README_PATH}: ` +
        unaccounted.join(', '),
    ).toEqual([]);
  });

  /*
   * `/vendor/portfolio` used to be exactly this failure mode from the other
   * direction: framed (rows 36-37 of the sweep ledger, by `24 Image upload`
   * and `25 Upload failures`) while a stale static finding (`S-2`) still
   * called it unframed. Both cannot be true; pinning the resolved side here
   * means a regression — the literal going missing from the frame table
   * again — fails loudly instead of quietly un-fixing itself.
   */
  it('resolves the /vendor/portfolio frame mapping (no longer a contradiction)', () => {
    const regex = patternToRegex('/vendor/portfolio');
    expect(FRAMED_LITERALS.some((literal) => regex.test(literal))).toBe(true);
    expect(sweepLedger).toMatch(/24 Image upload \| `\/vendor\/portfolio`/);
    expect(sweepLedger).toMatch(/25 Upload failures \| `\/vendor\/portfolio`/);
  });
});

describe('the matcher itself catches an unrecorded route (#319 acceptance: proves the failure case)', () => {
  /*
   * A synthetic route rather than a fixture page: the acceptance criteria
   * offers either, and a real broken route left in `apps/web/src/app` would
   * be exactly the kind of dead surface #319 exists to prevent shipping.
   * This exercises the same `findUnaccountedRoutes` the guard above calls,
   * against the real ledger data, with one route appended that exists in
   * neither document.
   */
  const FAKE_ROUTE = '/definitely/not-a-real-route-2026';

  it('flags a route with neither a frame nor a recorded exemption', () => {
    const unaccounted = findUnaccountedRoutes(
      [...ROUTE_PATTERNS, FAKE_ROUTE],
      FRAMED_LITERALS,
      RULED_ROUTES,
    );

    expect(unaccounted).toContain(FAKE_ROUTE);
  });

  it('flags only the synthetic route — every real one still passes', () => {
    const unaccounted = findUnaccountedRoutes(
      [...ROUTE_PATTERNS, FAKE_ROUTE],
      FRAMED_LITERALS,
      RULED_ROUTES,
    );

    expect(unaccounted).toEqual([FAKE_ROUTE]);
  });

  it('would not have been fooled by the four routes that arrived silently', () => {
    // #308, #307, #9 — named in the ticket as the ones nothing noticed.
    const landed = [
      '/bookings/[requestId]',
      '/vendor/bookings',
      '/vendor/payments',
      '/vendor/payments/return',
    ];

    for (const pattern of landed) {
      expect(ROUTE_PATTERNS).toContain(pattern);
      expect(RULED_ROUTES.has(pattern)).toBe(true);
    }
  });
});

describe('patternToRegex', () => {
  it('matches any single segment for a dynamic route, and nothing longer or shorter', () => {
    const regex = patternToRegex('/vendors/[slug]');

    expect(regex.test('/vendors/june-harlow')).toBe(true);
    expect(regex.test('/vendors/does-not-exist')).toBe(true);
    expect(regex.test('/vendors/june-harlow/request')).toBe(false);
    expect(regex.test('/vendors')).toBe(false);
  });

  it('matches the literal root', () => {
    expect(patternToRegex('/').test('/')).toBe(true);
    expect(patternToRegex('/').test('/search')).toBe(false);
  });

  it('does not let one dynamic route swallow a sibling', () => {
    const bookingDetail = patternToRegex('/bookings/[requestId]');
    expect(bookingDetail.test('/bookings/[requestId]/checkout')).toBe(false);
  });
});
