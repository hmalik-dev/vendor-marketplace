import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Vitest runs with the package root as cwd. */
const APP_DIR = join(process.cwd(), 'src/app');

function pages(directory: string, collected: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);

    if (statSync(absolute).isDirectory()) {
      pages(absolute, collected);
    } else if (entry === 'page.tsx') {
      collected.push(relative(APP_DIR, directory).split(sep).join('/'));
    }
  }

  return collected;
}

/** The segment paths (`''` is the root) from a page's own segment up to the root. */
function ancestry(segment: string): string[] {
  const parts = segment === '' ? [] : segment.split('/');
  return parts.map((_, index) => parts.slice(0, parts.length - index).join('/')).concat('');
}

function hasLoading(segment: string): boolean {
  return existsSync(join(APP_DIR, segment, 'loading.tsx'));
}

function coveredBy(segment: string): string | undefined {
  return ancestry(segment).find(hasLoading);
}

/*
 * VEN-673. Every route answers a click with a loading state, or it is named
 * here with the reason it cannot have one. A `loading.tsx` is a Suspense
 * boundary, and Next streams everything inside one after the 200 shell has
 * gone, which a route that must answer with a status cannot survive:
 *
 * - `notFound()` under a boundary is a soft 404 (`loading-boundaries.test.ts`);
 * - `redirect()` / `permanentRedirect()` / a session gate in the page travels as
 *   a meta refresh under HTTP 200 instead of a 307 or 308 (VEN-379);
 * - the console renders whole with JavaScript off, which a streamed `hidden`
 *   node forbids (VEN-654, `admin/boundaries.test.ts`).
 *
 * The list is checked both ways: a route that has a boundary may not be listed,
 * so an exemption cannot outlive its reason, and a route that has none must be.
 * A new route therefore ships with a loader or with a stated reason.
 */
const NO_BOUNDARY: Record<string, string> = {
  '': 'the root is an ancestor of every notFound() route',
  'accept-terms': 'redirects',
  'account/settings': 'gates in the page',
  'account/settings/name': 'gates in the page',
  'account/settings/password': 'gates in the page',
  'bookings/[requestId]': 'notFound() and a session gate',
  'bookings/[requestId]/checkout': 'notFound() and a session gate',
  'bookings/[requestId]/confirmed': 'notFound() and a session gate',
  'forgot-password': 'redirects a signed-in visitor',
  'reset-password': 'redirects a signed-in visitor',
  search: 'permanentRedirect() canonicalises the query (segment-boundaries.test.tsx)',
  'sign-in': 'redirects a signed-in visitor',
  'sign-up': 'redirects a signed-in visitor',
  'sign-up/customer-details': 'gates in the page',
  'sign-up/vendor-details': 'redirects',
  'vendors/[slug]': 'notFound() and permanentRedirect()',
  'vendors/[slug]/request': 'notFound(), permanentRedirect() and a session gate',
  'vendors/apply': 'redirects',
  waitlist: 'redirects',
};

/** The console: no boundary anywhere in it (VEN-654). */
const CONSOLE_PAGES = pages(APP_DIR).filter(
  (segment) => segment === 'admin' || segment.startsWith('admin/'),
);

const ALL_PAGES = pages(APP_DIR).sort();

describe('every route has a loading boundary or a stated reason it cannot', () => {
  it('finds the routes, so it cannot pass vacuously', () => {
    expect(ALL_PAGES.length).toBeGreaterThan(40);
    expect(CONSOLE_PAGES.length).toBeGreaterThan(10);
  });

  it.each(ALL_PAGES.filter((segment) => !CONSOLE_PAGES.includes(segment)))(
    '%j is covered exactly when it is not listed',
    (segment) => {
      const listed = segment in NO_BOUNDARY;

      expect({ segment, covered: coveredBy(segment) !== undefined }).toEqual({
        segment,
        covered: !listed,
      });
    },
  );

  it('lists only routes that exist', () => {
    expect(Object.keys(NO_BOUNDARY).filter((segment) => !ALL_PAGES.includes(segment))).toEqual([]);
  });

  it('has a loader on the static pages that answer no status of their own', () => {
    expect(
      ['cookies', 'for-vendors', 'legal/vendor-agreement', 'privacy', 'suspended', 'terms'].filter(
        (segment) => !hasLoading(segment),
      ),
    ).toEqual([]);
  });
});
