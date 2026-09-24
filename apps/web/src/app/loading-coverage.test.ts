import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
  'account/settings/close': 'notFound() and a session gate',
  'account/settings/name': 'gates in the page',
  'account/settings/password': 'gates in the page',
  'account/settings/sessions': 'gates in the page',
  'for-vendors': 'redirects a signed-in vendor',
  'forgot-password': 'redirects a signed-in visitor',
  'reset-password': 'redirects a signed-in visitor',
  'sign-in': 'redirects a signed-in visitor',
  'sign-up': 'redirects a signed-in visitor',
  'sign-up/customer-details': 'gates in the page',
  'sign-up/vendor-details': 'redirects',
  'vendors/apply': 'redirects',
  waitlist: 'redirects',
};

/** The console: no boundary anywhere in it (VEN-654). */
const CONSOLE_PAGES = pages(APP_DIR).filter(
  (segment) => segment === 'admin' || segment.startsWith('admin/'),
);

const ALL_PAGES = pages(APP_DIR).sort();

/** The public funnel (VEN-715): search, the vendor profile and request, and a booking. */
const FUNNEL = /^(?:search|vendors\/\[slug\]|bookings\/\[requestId\])(?:\/|$)/;

/** The calls that set a response status or gate a session; none may run under a boundary. */
const STATUS_CALLS = /\b(?:notFound|redirect|permanentRedirect|requireRole|requireCurrentUser)\(/g;

/**
 * Pages under a boundary that may still call `redirect(`, and how many times.
 * The count is checked exactly, so an entry cannot outlive its call.
 *
 * Checkout (VEN-637): a request that turns paid between the gate and the POST
 * that opens checkout. Only that POST can tell, and it mints a payment intent,
 * so it cannot run in the layout above the boundary (a link prefetch renders
 * layouts). The customer lands on their confirmation either way; the price of
 * the streamed redirect is a 200 in place of a 307, on a race window.
 */
const STREAMED_REDIRECTS: Record<string, number> = {
  'bookings/[requestId]/checkout/(gate)': 1,
};

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

  it('names only pages that exist as streamed-redirect exemptions', () => {
    expect(
      Object.keys(STREAMED_REDIRECTS).filter((segment) => !ALL_PAGES.includes(segment)),
    ).toEqual([]);
  });

  it('lists only routes that exist', () => {
    expect(Object.keys(NO_BOUNDARY).filter((segment) => !ALL_PAGES.includes(segment))).toEqual([]);
  });

  it('has a loader on the static pages that answer no status of their own', () => {
    expect(
      [
        'account/closed',
        'cookies',
        'legal/vendor-agreement',
        'privacy',
        'suspended',
        'terms',
      ].filter((segment) => !hasLoading(segment)),
    ).toEqual([]);
  });

  /*
   * VEN-715. The public funnel keeps its 404, 308 and 307 under a loader because
   * those decisions were moved out of the pages into layouts (or `middleware.ts`
   * for `/search`), which render above the boundary. A page beneath a boundary
   * that calls any of them again would answer 200 and stream the refusal.
   */
  it.each(ALL_PAGES.filter((segment) => FUNNEL.test(segment)))(
    '%j has a boundary and answers no status from inside it',
    (segment) => {
      expect(coveredBy(segment)).toBeDefined();

      const source = readFileSync(join(APP_DIR, segment, 'page.tsx'), 'utf8');

      expect(source.match(STATUS_CALLS) ?? []).toEqual(
        Array<string>(STREAMED_REDIRECTS[segment] ?? 0).fill('redirect('),
      );
    },
  );
});
