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
      state({ date: '2026-06-14', minPriceCents: 100_000, minRating: 4, tags: ['a'], city: 'Marfa' }),
    );

    expect(options.map((option) => option.label)).toEqual([
      'Any date',
      'Any price',
      'Any rating',
      'Any style',
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
    ).toBe('No photographers match all 2 filters');
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
      'the date is the narrowest filter here. Loosen one and results come back.',
    );
  });

  it('names the price range when there is no date', () => {
    expect(noResultsDiagnosis(state({ maxPriceCents: 120_000 }))).toBe(
      'the price range is the narrowest filter here. Loosen one and results come back.',
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
