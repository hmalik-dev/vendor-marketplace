import { describe, expect, it } from 'vitest';
import { activeFilterCount, toSearchQuery, type SearchState } from './search-state';

const EMPTY: SearchState = {
  q: '',
  category: '',
  city: '',
  state: '',
  minPriceCents: null,
  maxPriceCents: null,
  date: '',
  minRating: null,
  tags: [],
  sort: 'relevance',
  page: 1,
};

const params = (state: SearchState): URLSearchParams => new URLSearchParams(toSearchQuery(state));

describe('toSearchQuery', () => {
  it('sends only the always-present params when nothing is filtered', () => {
    expect([...params(EMPTY).keys()].sort()).toEqual(['page', 'pageSize', 'sort']);
  });

  it('omits an empty filter rather than sending a blank value', () => {
    const query = params({ ...EMPTY, city: '', q: '' });

    expect(query.has('city')).toBe(false);
    expect(query.has('q')).toBe(false);
  });

  it('carries every filter the rail can set', () => {
    const query = params({
      ...EMPTY,
      q: 'wedding',
      category: 'photography',
      city: 'Austin',
      state: 'TX',
      minPriceCents: 50_000,
      maxPriceCents: 300_000,
      date: '2026-06-14',
      minRating: 4.5,
      sort: 'rating',
      page: 3,
    });

    expect(query.get('q')).toBe('wedding');
    expect(query.get('category')).toBe('photography');
    expect(query.get('city')).toBe('Austin');
    expect(query.get('state')).toBe('TX');
    expect(query.get('minPriceCents')).toBe('50000');
    expect(query.get('maxPriceCents')).toBe('300000');
    expect(query.get('date')).toBe('2026-06-14');
    expect(query.get('minRating')).toBe('4.5');
    expect(query.get('sort')).toBe('rating');
    expect(query.get('page')).toBe('3');
  });

  /*
   * Tags are AND-combined server-side, and each one travels as its own
   * repeated param — a comma-joined string would arrive as a single id.
   */
  it('repeats the tag param once per tag', () => {
    const query = params({ ...EMPTY, tags: ['tag-a', 'tag-b'] });

    expect(query.getAll('tags')).toEqual(['tag-a', 'tag-b']);
  });

  it('sends no tag param at all when none are chosen', () => {
    expect(params(EMPTY).has('tags')).toBe(false);
  });

  it('keeps a zero minimum price, which is a real bound and not an absence', () => {
    expect(params({ ...EMPTY, minPriceCents: 0 }).get('minPriceCents')).toBe('0');
  });
});

describe('activeFilterCount', () => {
  it('counts nothing when no filter is narrowing the results', () => {
    expect(activeFilterCount(EMPTY)).toBe(0);
  });

  it('counts a price range once, however many ends are set', () => {
    expect(activeFilterCount({ ...EMPTY, minPriceCents: 1000 })).toBe(1);
    expect(activeFilterCount({ ...EMPTY, minPriceCents: 1000, maxPriceCents: 9000 })).toBe(1);
  });

  it('counts every tag group as one filter', () => {
    expect(activeFilterCount({ ...EMPTY, tags: ['a', 'b', 'c'] })).toBe(1);
  });

  /* Sort and page change what you see, not which vendors match. */
  it('ignores sort and paging', () => {
    expect(activeFilterCount({ ...EMPTY, sort: 'rating', page: 4 })).toBe(0);
  });

  it('adds up independent filters', () => {
    expect(
      activeFilterCount({ ...EMPTY, category: 'photography', city: 'Austin', date: '2026-06-14' }),
    ).toBe(3);
  });
});
