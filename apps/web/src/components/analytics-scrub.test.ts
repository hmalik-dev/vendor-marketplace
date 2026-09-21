import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DYNAMIC_ROUTE_POLICY, scrubAnalyticsEvent } from './analytics-scrub';

const APP_DIR = join(__dirname, '..', 'app');
const LAYOUT = join(APP_DIR, 'layout.tsx');
const UUID = '8f2c1e64-5b7a-4d3e-9a10-2c4f6e8a0b12';

const scrub = (url: string): string | null =>
  scrubAnalyticsEvent({ type: 'pageview', url })?.url ?? null;

/** Every directory under `dir` named `[param]`, as a route: groups removed. */
function dynamicRoutes(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\[.+\]$/.test(entry.name))
    .map(
      (entry) =>
        `/${relative(dir, join(entry.parentPath, entry.name))
          .split(sep)
          .filter((segment) => !/^\(.+\)$/.test(segment))
          .join('/')}`,
    )
    .sort();
}

const unclassified = (dir: string): string[] =>
  dynamicRoutes(dir).filter((route) => !(route in DYNAMIC_ROUTE_POLICY));

describe('scrubAnalyticsEvent', () => {
  it.each([
    '/admin',
    `/admin/users/${UUID}`,
    `/admin/cases/${UUID}?tab=x`,
    `/ADMIN/users/${UUID}`,
    `//admin/users/${UUID}`,
    '/api/auth/callback/x',
  ])('drops %s', (path) => {
    expect(scrubAnalyticsEvent({ type: 'pageview', url: path })).toBeNull();
    expect(scrubAnalyticsEvent({ type: 'pageview', url: `https://orla.test${path}` })).toBeNull();
  });

  it.each([
    [`/bookings/${UUID}?ref=abc#top`, '/bookings/[requestId]'],
    [`/bookings/${UUID}/checkout?x=1`, '/bookings/[requestId]/checkout'],
    ['/vendors/some-slug?utm=1', '/vendors/some-slug'],
    ['/search?category=photography&city=austin', '/search'],
    ['/', '/'],
    ['/bookings', '/bookings'],
    [`/bookings/${UUID}/`, '/bookings/[requestId]'],
    ['/search/', '/search'],
    ['/administrators', '/administrators'],
  ])('reports %s as %s', (input, expected) => {
    expect(scrub(input)).toBe(expected);
  });

  it('keeps the origin of an absolute URL and only rewrites the path', () => {
    expect(scrub(`https://orla.test/bookings/${UUID}?a=b#c`)).toBe(
      'https://orla.test/bookings/[requestId]',
    );
    expect(scrub('https://orla.test/search?category=x')).toBe('https://orla.test/search');
  });
});

describe('dynamic route classification', () => {
  it('classifies every dynamic route under apps/web/src/app', () => {
    const routes = dynamicRoutes(APP_DIR);
    expect(routes).toContain('/bookings/[requestId]');
    expect(unclassified(APP_DIR)).toEqual([]);
  });

  it('lists no policy for a route that no longer exists', () => {
    expect(Object.keys(DYNAMIC_ROUTE_POLICY).sort()).toEqual(dynamicRoutes(APP_DIR));
  });

  it('names a route that is not classified', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'analytics-routes-'));
    try {
      mkdirSync(join(fixture, 'vendors', '[slug]'), { recursive: true });
      mkdirSync(join(fixture, 'reports', '(group)', '[x]'), { recursive: true });

      expect(unclassified(fixture)).toEqual(['/reports/[x]']);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});

describe('root layout', () => {
  it('renders the scrubbing wrapper and no bare <Analytics />', () => {
    const source = readFileSync(LAYOUT, 'utf8');
    expect(source).toContain('<WebAnalytics />');
    expect(source).not.toMatch(/<Analytics[\s/>]/);
  });
});
