import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_TAGLINE,
  CATEGORY_SEEDS,
} from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import type { SearchParams } from '@/lib/search-params';

/** The root `opengraph-image` card's box and alt text, read by that route too. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };
export const SHARE_IMAGE_ALT = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

/**
 * The share card every page starts from. The root layout sets it without a
 * `url`, because a layout cannot know which page it wraps: it used to say
 * `url: '/'` and `canonical: '/'`, and every page that did not override them
 * told crawlers it was a duplicate of the homepage (VEN-606).
 *
 * `images` names the root card explicitly. Next attaches a file-based image
 * only to pages that inherit the layout's `openGraph`; a page that sets its own
 * (every `selfCanonical` page) would otherwise lose `og:image` and
 * `twitter:image` and share as a blank card.
 */
export const SITE_OPEN_GRAPH = {
  type: 'website',
  siteName: BRAND_NAME,
  title: BRAND_NAME,
  description: BRAND_DESCRIPTION,
  images: [{ url: '/opengraph-image', ...SHARE_IMAGE_SIZE, alt: SHARE_IMAGE_ALT }],
};

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

const LISTED_CATEGORIES = new Set(CATEGORY_SEEDS.map((category) => category.slug));

/**
 * `/search`'s canonical keeps the category and drops every other parameter.
 * The sitemap lists exactly `/search` and one `/search?category=` per
 * category, so those are the pages; a city, a date or a tag is a filtered view
 * of one of them.
 *
 * A slug the sitemap does not list is dropped too: an unknown category renders
 * a 200 empty grid, and self-canonicalising it would hand crawlers an
 * indexable production URL whose text anyone can choose.
 */
export function searchCanonicalPath(params: SearchParams): string {
  const raw = params.category;
  const category = Array.isArray(raw) ? raw[0] : raw;

  return category && LISTED_CATEGORIES.has(category)
    ? `/search?${new URLSearchParams({ category }).toString()}`
    : '/search';
}
