import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { escapeRegExp } from '@/testing/source-scan';

vi.mock('@/config/env', () => ({ siteOrigin: () => 'https://orla.example.com' }));

const { default: robots } = await import('./robots');

afterEach(() => vi.unstubAllEnvs());

const APP_ROOT = join(process.cwd(), 'src/app');

/** The URL of every page or layout under `src/app` whose metadata says `index: false`. */
function noindexRoutes(directory = APP_ROOT): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return noindexRoutes(path);
    }
    if (
      !/^(page|layout)\.tsx$/.test(entry) ||
      !/\bindex:\s*false\b/.test(readFileSync(path, 'utf8'))
    ) {
      return [];
    }
    const segments = relative(APP_ROOT, directory)
      .split(sep)
      .filter((segment) => segment && !/^\(.*\)$/.test(segment));
    return [`/${segments.join('/')}`];
  });
}

function disallowedPaths(): string[] {
  const rules = robots().rules;
  const disallow = (Array.isArray(rules) ? rules[0]?.disallow : rules.disallow) ?? [];
  return Array.isArray(disallow) ? disallow : [disallow];
}

/** Whether a crawler reads `path` as disallowed: a prefix match where `*` is any run (RFC 9309). */
function isDisallowed(path: string): boolean {
  return disallowedPaths().some((rule) =>
    new RegExp(`^${rule.split('*').map(escapeRegExp).join('.*')}`).test(path),
  );
}

/*
 * VEN-606: staging answered `Allow: /` and advertised its sitemap, so a crawler
 * that found the branch alias indexed a second copy of the marketplace. Only
 * production may be indexed, and a tier nobody named is not production.
 */
describe.each([
  ['staging', 'staging'],
  ['local', 'local'],
  ['unset', undefined],
])('robots on a %s tier', (_label, tier) => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', tier));

  it('disallows everything and advertises no sitemap', () => {
    expect(robots()).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] });
  });
});

describe('robots in production', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'production'));
  afterEach(() => vi.resetModules());

  /*
   * These paths are all behind sign-in, so this is not about secrecy — a crawler
   * following them only ever reaches a sign-in redirect, and a marketplace
   * whose growth depends on vendor profiles ranking cannot spend its crawl
   * budget there.
   */
  it('disallows every signed-in surface', () => {
    const disallow = robots().rules;
    const rule = Array.isArray(disallow) ? disallow[0] : disallow;

    for (const path of ['/vendor/', '/customer/', '/dashboard']) {
      expect(rule?.disallow).toContain(path);
    }
  });

  /*
   * VEN-694: `/bookings`, `/messages` and `/account` were signed-in-only and
   * `noindex`, yet missing here, because the list was written by hand. The
   * expectation is read from the routes themselves, so a new gated screen that
   * marks itself `index: false` cannot be forgotten.
   */
  it('disallows every route that marks itself noindex', () => {
    const uncovered = noindexRoutes().filter((route) => !isDisallowed(route));

    expect(uncovered).toEqual([]);
  });

  // A walk that finds nothing would pass the check above vacuously.
  it('reads the gated routes from the tree', () => {
    expect(noindexRoutes()).toEqual(
      expect.arrayContaining(['/admin', '/bookings', '/messages', '/account/settings']),
    );
  });

  it('allows the public surfaces', () => {
    const rule = robots().rules;

    expect(Array.isArray(rule) ? rule[0]?.allow : rule.allow).toBe('/');
  });

  it('never disallows a vendor profile or a search', () => {
    const rule = robots().rules;
    const disallow = (Array.isArray(rule) ? rule[0]?.disallow : rule.disallow) ?? [];
    const paths = Array.isArray(disallow) ? disallow : [disallow];

    // `/vendor/` is the signed-in editor; `/vendors/` is the public profile.
    // One trailing character separates the growth surface from the private one.
    expect(paths).not.toContain('/vendors/');
    expect(paths).not.toContain('/search');
    // `/vendors/*/request` sits under the public profile, so check the URLs themselves.
    for (const url of ['/', '/vendors/acme-events', '/search?city=austin']) {
      expect(isDisallowed(url), url).toBe(false);
    }
  });

  it('points at an absolute sitemap on this origin', () => {
    expect(robots().sitemap).toBe('https://orla.example.com/sitemap.xml');
  });
});
