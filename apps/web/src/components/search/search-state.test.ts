import { describe, expect, it } from 'vitest';
import { activeRefineCount, toSearchQuery, hasQuery, type SearchState } from './search-state';

const EMPTY: SearchState = {
  name: '',
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
    const query = params({ ...EMPTY, city: '', name: '' });

    expect(query.has('city')).toBe(false);
    expect(query.has('name')).toBe(false);
  });

  /*
   * The free-text `q` was removed from the contract by decision D6. The query
   * is category + city + date; `name` is the separate referral affordance.
   */
  it('never sends the retired free-text q param', () => {
    const query = params({ ...EMPTY, category: 'photography', name: 'June Harlow' });

    expect(query.has('q')).toBe(false);
    expect(query.get('name')).toBe('June Harlow');
  });

  it('carries every value the query bar and the Refine bar can set', () => {
    const query = params({
      ...EMPTY,
      name: 'June Harlow',
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

    expect(query.get('name')).toBe('June Harlow');
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

  it('sends a page size that fills two full rows of four', () => {
    expect(params(EMPTY).get('pageSize')).toBe('20');
  });
});

describe('activeRefineCount', () => {
  it('counts nothing when no refinement is narrowing the results', () => {
    expect(activeRefineCount(EMPTY)).toBe(0);
  });

  it('counts a price range once, however many ends are set', () => {
    expect(activeRefineCount({ ...EMPTY, minPriceCents: 1000 })).toBe(1);
    expect(activeRefineCount({ ...EMPTY, minPriceCents: 1000, maxPriceCents: 9000 })).toBe(1);
  });

  it('counts every tag group as one filter', () => {
    expect(activeRefineCount({ ...EMPTY, tags: ['a', 'b', 'c'] })).toBe(1);
  });

  /* Sort and page change what you see, not which vendors match. */
  it('ignores sort and paging', () => {
    expect(activeRefineCount({ ...EMPTY, sort: 'rating', page: 4 })).toBe(0);
  });

  /*
   * The query is not a refinement. Category, city and date belong to the search
   * bar, which owns them and shows them; counting them in the Refine total
   * would be a second representation of one state, and the date must never
   * appear as a filter chip at all.
   */
  it('never counts the query — category, city and date belong to the search bar', () => {
    expect(
      activeRefineCount({ ...EMPTY, category: 'photography', city: 'Austin', date: '2026-06-14' }),
    ).toBe(0);
  });

  it('never counts name search, which is neither query nor refinement', () => {
    expect(activeRefineCount({ ...EMPTY, name: 'June Harlow' })).toBe(0);
  });

  it('adds up independent refinements', () => {
    expect(activeRefineCount({ ...EMPTY, minRating: 4, tags: ['a'], minPriceCents: 1000 })).toBe(3);
  });
});

describe('hasQuery', () => {
  it('is false when the customer has asked nothing yet', () => {
    expect(hasQuery(EMPTY)).toBe(false);
  });

  it('is true once any of the three query values is set', () => {
    expect(hasQuery({ ...EMPTY, category: 'photography' })).toBe(true);
    expect(hasQuery({ ...EMPTY, city: 'Austin' })).toBe(true);
    expect(hasQuery({ ...EMPTY, date: '2026-06-14' })).toBe(true);
  });

  it('is true for a name search, which is also a question', () => {
    expect(hasQuery({ ...EMPTY, name: 'June Harlow' })).toBe(true);
  });
});
