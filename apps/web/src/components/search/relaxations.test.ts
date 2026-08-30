import { describe, expect, it } from 'vitest';
import { noResultsDiagnosis, noResultsHeadline, relaxations } from './relaxations';
import type { SearchState } from './search-state';

function state(overrides: Partial<SearchState> = {}): SearchState {
  return {
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
    ...overrides,
  };
}

describe('relaxations', () => {
  it('offers nothing to loosen when nothing was filtered', () => {
    expect(relaxations(state())).toEqual([]);
  });

  it('leads with the date, which rules out every already-booked vendor', () => {
    const options = relaxations(
      state({
        date: '2026-06-14',
        minPriceCents: 100_000,
        minRating: 4,
        tags: ['a'],
        city: 'Marfa',
      }),
    );

    expect(options.map((option) => option.label)).toEqual([
      'Any date',
      'Any price',
      'Any rating',
      'Any tag',
      'Anywhere',
    ]);
  });

  it('loosens exactly one value per option, so the change is visible', () => {
    const [option] = relaxations(state({ minPriceCents: 100_000, maxPriceCents: 200_000 }));

    expect(option?.patch).toEqual({ minPriceCents: null, maxPriceCents: null });
  });

  it('does not offer the vendor type, which is the question rather than a filter', () => {
    const labels = relaxations(state({ category: 'photography', date: '2026-06-14' })).map(
      (option) => option.label,
    );

    expect(labels).toEqual(['Any date']);
  });
});

describe('noResultsHeadline', () => {
  it("names the customer's own vendor type", () => {
    expect(noResultsHeadline(state({ category: 'photography', date: '2026-06-14' }))).toBe(
      'No photographers match that filter',
    );
  });

  it('counts the filters actually set rather than claiming all three', () => {
    expect(
      noResultsHeadline(state({ category: 'photography', date: '2026-06-14', minRating: 4 })),
    ).toBe('No photographers match all two filters');
  });

  it('says the category is simply not listed yet when nothing was filtered', () => {
    expect(noResultsHeadline(state({ category: 'catering' }))).toBe('No caterers listed yet');
  });

  it('falls back to the generic noun without a category', () => {
    expect(noResultsHeadline(state())).toBe('No vendors listed yet');
  });
});

describe('noResultsDiagnosis', () => {
  it('names the narrowest filter as the likely cause', () => {
    expect(noResultsDiagnosis(state({ date: '2026-06-14', minRating: 4 }))).toBe(
      'The date is the narrowest filter here. Loosen one filter and results come back.',
    );
  });

  it('names the price range when there is no date', () => {
    expect(noResultsDiagnosis(state({ maxPriceCents: 120_000 }))).toBe(
      'The price range is the narrowest filter here. Loosen one filter and results come back.',
    );
  });

  /*
   * The branch that shipped the wrong word. Until #329 this read "The style
   * filter", naming a filter the product had removed — and it survived the
   * removal precisely because every other branch here was pinned by a test and
   * this one was not. The chip label at the top of the file was caught by its
   * own test in the same pass; this sentence was not.
   *
   * Rating is set alongside the tags on purpose: `relaxations` orders date,
   * price, rating, tags, city, so the tag branch is only reachable as *first*
   * when the three above it are unset. A test that set tags alone would pass
   * against a diagnosis that never looked at tags at all.
   */
  it('names the tag filter, not any one of the groups it spans', () => {
    expect(noResultsDiagnosis(state({ tags: ['a-language-tag-id'] }))).toBe(
      'The tag filter is the narrowest filter here. Loosen one filter and results come back.',
    );
  });

  it('names the city when it is the only filter set', () => {
    expect(noResultsDiagnosis(state({ city: 'Marfa' }))).toBe(
      'The city is the narrowest filter here. Loosen one filter and results come back.',
    );
  });

  /*
   * With nothing filtered there is no culprit, and inventing one — "your
   * search is too narrow" over an unfiltered query — would be a lie.
   */
  it('diagnoses nothing when nothing was filtered', () => {
    expect(noResultsDiagnosis(state({ category: 'photography' }))).toBeNull();
  });
});
