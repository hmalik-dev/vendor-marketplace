import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({ siteOrigin: () => 'https://orla.example.com' }));

const { default: robots } = await import('./robots');

afterEach(() => vi.unstubAllEnvs());

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
  });

  it('points at an absolute sitemap on this origin', () => {
    expect(robots().sitemap).toBe('https://orla.example.com/sitemap.xml');
  });
});
