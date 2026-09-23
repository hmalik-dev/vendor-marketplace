import { BRAND_NAME, CATEGORY_SEEDS } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { SITE_OPEN_GRAPH, searchCanonicalPath, selfCanonical } from './canonical';

describe('searchCanonicalPath', () => {
  it('is bare /search with no category', () => {
    expect(searchCanonicalPath({})).toBe('/search');
    expect(searchCanonicalPath({ category: '' })).toBe('/search');
  });

  it('keeps the category and drops every other parameter', () => {
    expect(
      searchCanonicalPath({ category: 'photography', city: 'Austin', date: '2026-10-01' }),
    ).toBe('/search?category=photography');
    expect(searchCanonicalPath({ city: 'Austin', tags: ['outdoor', 'film'] })).toBe('/search');
  });

  it('takes the first of a repeated category, the one search itself reads', () => {
    expect(searchCanonicalPath({ category: ['catering', 'decor'] })).toBe(
      '/search?category=catering',
    );
  });

  it('drops a category the sitemap does not list, so crawlers get no chosen text', () => {
    expect(searchCanonicalPath({ category: 'cheap-spam-phrase' })).toBe('/search');
    expect(searchCanonicalPath({ category: 'a&b=c' })).toBe('/search');
  });

  it('keeps every category the sitemap lists', () => {
    for (const { slug } of CATEGORY_SEEDS) {
      expect(searchCanonicalPath({ category: slug })).toBe(`/search?category=${slug}`);
    }
  });
});

describe('selfCanonical', () => {
  it('sets the canonical and og:url to the same path and keeps the site card', () => {
    expect(selfCanonical('/terms')).toEqual({
      alternates: { canonical: '/terms' },
      openGraph: { ...SITE_OPEN_GRAPH, url: '/terms' },
    });
    expect(SITE_OPEN_GRAPH.siteName).toBe(BRAND_NAME);
  });
});
