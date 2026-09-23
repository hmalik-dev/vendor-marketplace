import { BRAND_NAME } from '@vendor-marketplace/shared';
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

  it('encodes the value rather than concatenating it', () => {
    expect(searchCanonicalPath({ category: 'a&b=c' })).toBe('/search?category=a%26b%3Dc');
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
