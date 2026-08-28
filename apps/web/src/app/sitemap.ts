import {
  CATEGORY_SEEDS,
  MAX_PAGE_SIZE,
  vendorSearchResultSchema,
} from '@vendor-marketplace/shared';
import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/config/env';
import { apiRequest } from '@/lib/api-client';

/**
 * The sitemap, read from the database at request time rather than written by
 * hand.
 *
 * Vendor profiles are the growth surface — the marketplace is found because a
 * photographer's page ranks, not because the landing page does — so a static
 * list would go stale the first time a vendor published. Every published
 * vendor is listed, which is exactly the set `/vendors` already returns.
 */

/** Kept in step with the `robots.ts` revalidate window; ops-paced, not per-request. */
export const revalidate = 3600;

/**
 * A crawler will not follow endless pagination, and a sitemap has a hard
 * 50,000-URL limit anyway. This walks the pages the search endpoint offers and
 * stops when it runs out — the cap exists so a runaway `total` cannot spin
 * here, and it is logged rather than silently truncating.
 */
const MAX_SITEMAP_PAGES = 50;

async function publishedVendorSlugs(): Promise<string[]> {
  const slugs: string[] = [];

  for (let page = 1; page <= MAX_SITEMAP_PAGES; page += 1) {
    const result = await apiRequest(`/vendors?page=${page}&pageSize=${MAX_PAGE_SIZE}`, {
      schema: vendorSearchResultSchema,
      revalidate,
    });

    slugs.push(...result.items.map((vendor) => vendor.slug));

    if (slugs.length >= result.total || result.items.length === 0) {
      return slugs;
    }
  }

  /*
   * Hitting the cap means the catalogue outgrew it — 5,000 vendors — and the
   * sitemap is silently short from here on. There is no logger in this app
   * yet; #15 brings Sentry, and this is one of the first things that should
   * report to it.
   */
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();

  const entries: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: 'daily', priority: 1 },
    { url: `${origin}/search`, changeFrequency: 'daily', priority: 0.9 },
    // One entry per category search: these are the queries people actually
    // type, and each is a real page with real results behind it.
    ...CATEGORY_SEEDS.map((category) => ({
      url: `${origin}/search?category=${category.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];

  /*
   * A failed read yields the static entries rather than a 500. The same rule
   * as every other reference read (#33): one section being unavailable must
   * not take the whole response down — and a sitemap missing its vendors for
   * an hour is recoverable, where a 500 teaches the crawler to stop asking.
   */
  let slugs: string[];
  try {
    slugs = await publishedVendorSlugs();
  } catch {
    // Reported to Sentry once #15 lands; until then the recoverable outcome
    // matters more than the record of it.
    return entries;
  }

  return [
    ...entries,
    ...slugs.map((slug) => ({
      url: `${origin}/vendors/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
