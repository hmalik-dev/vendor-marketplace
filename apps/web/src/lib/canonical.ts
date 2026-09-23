import { BRAND_DESCRIPTION, BRAND_NAME } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import type { SearchParams } from '@/lib/search-params';

/**
 * The share card every page starts from. The root layout sets it without a
 * `url`, because a layout cannot know which page it wraps: it used to say
 * `url: '/'` and `canonical: '/'`, and every page that did not override them
 * told crawlers it was a duplicate of the homepage (VEN-606).
 */
export const SITE_OPEN_GRAPH = {
  type: 'website',
  siteName: BRAND_NAME,
  title: BRAND_NAME,
  description: BRAND_DESCRIPTION,
} as const;

/**
 * A page's own canonical and `og:url`, both relative to `metadataBase`.
 *
 * Next replaces the layout's `openGraph` whole when a page sets one, so the
 * site card is spread back in rather than lost.
 */
export function selfCanonical(path: string): Pick<Metadata, 'alternates' | 'openGraph'> {
  return {
    alternates: { canonical: path },
    openGraph: { ...SITE_OPEN_GRAPH, url: path },
  };
}

/**
 * `/search`'s canonical keeps the category and drops every other parameter.
 * The sitemap lists exactly `/search` and one `/search?category=` per
 * category, so those are the pages; a city, a date or a tag is a filtered view
 * of one of them.
 */
export function searchCanonicalPath(params: SearchParams): string {
  const raw = params.category;
  const category = Array.isArray(raw) ? raw[0] : raw;

  return category ? `/search?${new URLSearchParams({ category }).toString()}` : '/search';
}
