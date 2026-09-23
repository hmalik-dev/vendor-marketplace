import type { Metadata } from 'next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { siteOrigin } from '@/config/env';

/*
 * VEN-606, acceptance 3: every URL the production sitemap offers a crawler
 * declares itself canonical. The root layout used to set `canonical: '/'` for
 * the whole app, so `/search`, each `/search?category=` the sitemap lists and
 * the legal pages all told a crawler they were duplicates of the homepage —
 * the sitemap and the pages it named contradicted each other.
 *
 * The root layout now declares neither, so each page's own metadata is the
 * whole answer: that is what is read here, from the real modules. The layout
 * is not imported — its stylesheet cannot be loaded under Vitest — and
 * `metadataBase` is the `siteOrigin()` it sets.
 */

const VENDOR_SLUG = 'june-harlow';

vi.mock('@/lib/api-client', () => ({
  apiRequest: () =>
    Promise.resolve({
      items: [{ slug: VENDOR_SLUG }],
      total: 1,
      page: 1,
      pageSize: 100,
      facets: { categories: [] },
    }),
}));

vi.mock('@/lib/vendor-data', async (actual) => ({
  ...(await actual<typeof import('@/lib/vendor-data')>()),
  getPublicVendorProfile: (slug: string) =>
    Promise.resolve({ slug, businessName: 'June Harlow', bio: null, city: null, state: null }),
}));

vi.mock('@/lib/auth/server', () => ({ getServerSession: () => Promise.resolve(null) }));

interface PageModule {
  metadata?: Metadata;
  generateMetadata?: (props: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string>>;
  }) => Promise<Metadata>;
}

/** The page module that answers a sitemap path. An unmapped path fails the test. */
function pageFor(pathname: string): Promise<PageModule> {
  if (pathname.startsWith('/vendors/')) {
    return import('./vendors/[slug]/page');
  }

  const pages: Record<string, () => Promise<PageModule>> = {
    '/': () => import('./page'),
    '/search': () => import('./search/page'),
    '/terms': () => import('./terms/page'),
    '/privacy': () => import('./privacy/page'),
    '/cookies': () => import('./cookies/page'),
    '/legal/vendor-agreement': () => import('./legal/vendor-agreement/page'),
  };
  const load = pages[pathname];

  if (!load) {
    throw new Error(`No page module mapped for sitemap path ${pathname}`);
  }

  return load();
}

async function resolvedMetadata(url: URL): Promise<Metadata> {
  const page = await pageFor(url.pathname);

  return (
    page.metadata ??
    (await page.generateMetadata?.({
      params: Promise.resolve({ slug: url.pathname.split('/').at(-1) ?? '' }),
      searchParams: Promise.resolve(Object.fromEntries(url.searchParams)),
    })) ??
    {}
  );
}

/** A metadata URL field made absolute, the way Next renders it. */
function absolute(value: unknown, base: URL | string | null | undefined): string | undefined {
  if (typeof value !== 'string' && !(value instanceof URL)) {
    return undefined;
  }

  return new URL(value, base ?? undefined).href;
}

describe('every production sitemap URL is its own canonical', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'production'));
  afterEach(() => vi.unstubAllEnvs());

  it('declares a self-referencing canonical and og:url on each <loc>', async () => {
    const { default: sitemap } = await import('./sitemap');
    const urls = (await sitemap()).map((entry) => new URL(entry.url));

    // The shape the sitemap must still have, so the loop below covers it.
    expect(urls.some((url) => url.pathname === '/search' && url.search === '')).toBe(true);
    expect(urls.some((url) => url.searchParams.has('category'))).toBe(true);
    expect(urls.some((url) => url.pathname === `/vendors/${VENDOR_SLUG}`)).toBe(true);

    const mismatches: string[] = [];

    for (const url of urls) {
      const page = await resolvedMetadata(url);
      const base = page.metadataBase ?? siteOrigin();
      const canonical = absolute(page.alternates?.canonical, base);
      const openGraph = page.openGraph;
      const ogUrl = absolute(openGraph?.url, base);

      if (canonical !== url.href) {
        mismatches.push(`${url.href} canonical=${canonical ?? 'none'}`);
      }
      if (ogUrl !== url.href) {
        mismatches.push(`${url.href} og:url=${ogUrl ?? 'none'}`);
      }
      // A page that sets its own `openGraph` drops the file-based card unless
      // it names an image, so each must carry one. `/` is the exception: it
      // is the segment `opengraph-image.tsx` lives in, so Next attaches the
      // card there whatever the page sets.
      if (url.pathname !== '/' && !openGraph?.images) {
        mismatches.push(`${url.href} og:image=none`);
      }
    }

    expect(mismatches).toEqual([]);
  });
});
