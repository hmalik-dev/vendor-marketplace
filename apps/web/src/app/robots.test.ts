import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({ siteOrigin: () => 'https://orla.example.com' }));

const { default: robots } = await import('./robots');

describe('robots', () => {
  afterEach(() => vi.resetModules());

  /*
   * These paths are all behind Clerk, so this is not about secrecy — a crawler
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
