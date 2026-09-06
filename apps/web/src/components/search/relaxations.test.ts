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

/**
 * The vendor types the platform has, as the screen reads them off the API's
 * category list. Every case below is about a slug that IS one of these; the
 * unknown-slug case has its own describe at the end.
 */
const KNOWN_SLUGS = ['photography', 'catering'] as const;

describe('relaxations', () => {
  it('offers nothing to loosen when nothing was filtered', () => {
    expect(relaxations(state(), KNOWN_SLUGS)).toEqual([]);
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
      KNOWN_SLUGS,
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
    const [option] = relaxations(
      state({ minPriceCents: 100_000, maxPriceCents: 200_000 }),
      KNOWN_SLUGS,
    );

    expect(option?.patch).toEqual({ minPriceCents: null, maxPriceCents: null });
  });

  /*
   * The pair travels together, here as everywhere else. A patch is **merged**,
   * so clearing `city` alone left `state=IL` in the URL — invisible, because
   * the bar then reads `Anywhere`, and terminal, because the next render sees
   * `city === ''`, offers no relaxation at all, and shows the
   * marketplace-is-empty copy over a grid still filtered to one state.
   *
   * #384 is why this is a regression test rather than a nicety: it made
   * `Springfield, IL` pickable, which put that dead end on the primary path of
   * the flow the ticket exists for.
   */
  it('clears both halves of the city pair, so no orphan state survives the escape', () => {
    const [option] = relaxations(state({ city: 'Springfield', state: 'IL' }), KNOWN_SLUGS);

    expect(option?.label).toBe('Anywhere');
    expect(option?.patch).toEqual({ city: '', state: '' });
  });

  it('leaves nothing to relax once Anywhere has been taken', () => {
    const start = state({ city: 'Springfield', state: 'IL' });
    const [option] = relaxations(start, KNOWN_SLUGS);

    // The state the patch actually produces, not a hand-written one — the
    // defect was that these two disagreed.
    const after = { ...start, ...option?.patch };

    expect(after.state).toBe('');
    expect(relaxations(after, KNOWN_SLUGS)).toEqual([]);
  });

  it('does not offer the vendor type, which is the question rather than a filter', () => {
    const labels = relaxations(
      state({ category: 'photography', date: '2026-06-14' }),
      KNOWN_SLUGS,
    ).map((option) => option.label);

    expect(labels).toEqual(['Any date']);
  });
});

describe('noResultsHeadline', () => {
  it("names the customer's own vendor type", () => {
    expect(
      noResultsHeadline(state({ category: 'photography', date: '2026-06-14' }), KNOWN_SLUGS),
    ).toBe('No photographers match that filter');
  });

  /*
   * "both", not "all two" — English has a word for two. The count template ran
   * at n=2 until #403 and put "No photographers match all two filters" on a
   * public screen.
   */
  it('says both, not all two, when the customer set two filters', () => {
    expect(
      noResultsHeadline(
        state({ category: 'photography', date: '2026-06-14', minRating: 4 }),
        KNOWN_SLUGS,
      ),
    ).toBe('No photographers match both filters');
  });

  /* Frame `18` draws the n=3 sentence, and it keeps the spelled numeral. */
  it('keeps the spelled count from three filters up', () => {
    expect(
      noResultsHeadline(
        state({ category: 'photography', date: '2026-06-14', minRating: 4, city: 'Austin' }),
        KNOWN_SLUGS,
      ),
    ).toBe('No photographers match all three filters');
  });

  it('says the category is simply not listed yet when nothing was filtered', () => {
    expect(noResultsHeadline(state({ category: 'catering' }), KNOWN_SLUGS)).toBe(
      'No caterers listed yet',
    );
  });

  it('falls back to the generic noun without a category', () => {
    expect(noResultsHeadline(state(), KNOWN_SLUGS)).toBe('No vendors listed yet');
  });
});

describe('noResultsDiagnosis', () => {
  it('names the narrowest filter as the likely cause', () => {
    expect(noResultsDiagnosis(state({ date: '2026-06-14', minRating: 4 }), KNOWN_SLUGS)).toBe(
      'The date is the narrowest filter here. Loosen one filter and results come back.',
    );
  });

  it('names the price range when there is no date', () => {
    expect(noResultsDiagnosis(state({ maxPriceCents: 120_000 }), KNOWN_SLUGS)).toBe(
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
    expect(noResultsDiagnosis(state({ tags: ['a-language-tag-id'] }), KNOWN_SLUGS)).toBe(
      'The tag filter is the narrowest filter here. Loosen one filter and results come back.',
    );
  });

  it('names the city when it is the only filter set', () => {
    expect(noResultsDiagnosis(state({ city: 'Marfa' }), KNOWN_SLUGS)).toBe(
      'The city is the narrowest filter here. Loosen one filter and results come back.',
    );
  });

  /*
   * With nothing filtered there is no culprit, and inventing one — "your
   * search is too narrow" over an unfiltered query — would be a lie.
   */
  it('diagnoses nothing when nothing was filtered', () => {
    expect(noResultsDiagnosis(state({ category: 'photography' }), KNOWN_SLUGS)).toBeNull();
  });
});

/**
 * #72's fourth finding: searching a name that matches nothing claimed no
 * vendors were **listed**, blamed two filters the customer never set, and
 * offered no way back. The name filter was simply absent from this module.
 */
describe('a name search that matches nothing', () => {
  const named = state({ name: 'Nonexistent Studio', category: 'photography' });

  it('offers one tap to clear the name', () => {
    expect(relaxations(named, KNOWN_SLUGS)).toEqual([{ label: 'Any name', patch: { name: '' } }]);
  });

  it('leads with the name, the narrowest filter in the product', () => {
    const everything = state({
      name: 'Nonexistent Studio',
      date: '2026-06-14',
      city: 'Austin',
      minRating: 4,
    });

    expect(relaxations(everything, KNOWN_SLUGS)[0]?.label).toBe('Any name');
  });

  it('counts the name as a filter rather than claiming none are listed', () => {
    // The false claim: seventeen photographers are listed; none match this name.
    expect(noResultsHeadline(named, KNOWN_SLUGS)).not.toContain('listed yet');
    expect(noResultsHeadline(named, KNOWN_SLUGS)).toBe('No photographers match that filter');
  });

  it('names the name as the culprit, not the city the customer never set', () => {
    const diagnosis = noResultsDiagnosis(named, KNOWN_SLUGS);

    expect(diagnosis).toContain('The name');
    expect(diagnosis).not.toContain('city');
  });
});

/*
 * #403 acceptance 5. A well-formed slug the platform has no category for rules
 * out every vendor, and with nothing in the relaxation list the headline fell
 * through to "No vendors listed yet" — a false claim about the marketplace,
 * with no way back and a diagnosis naming filters nobody had touched.
 */
describe('a vendor type the platform does not have', () => {
  const unknown = state({ category: 'does-not-exist' });

  it('offers one tap to clear it', () => {
    expect(relaxations(unknown, KNOWN_SLUGS)).toEqual([
      { label: 'Any vendor type', patch: { category: '' } },
    ]);
  });

  it('counts it as a filter rather than claiming none are listed', () => {
    expect(noResultsHeadline(unknown, KNOWN_SLUGS)).toBe('No vendors match that filter');
  });

  it('names the vendor type as the culprit', () => {
    expect(noResultsDiagnosis(unknown, KNOWN_SLUGS)).toBe(
      'The vendor type is the narrowest filter here. Loosen one filter and results come back.',
    );
  });

  /*
   * The other half. "No photographers listed yet" is true and useful when the
   * platform has photography and no photographers, so a known slug must not
   * gain a relaxation — otherwise the fix would have traded one wrong sentence
   * for another.
   */
  it('leaves a known vendor type alone', () => {
    expect(relaxations(state({ category: 'photography' }), KNOWN_SLUGS)).toEqual([]);
    expect(noResultsHeadline(state({ category: 'photography' }), KNOWN_SLUGS)).toBe(
      'No photographers listed yet',
    );
  });

  /* It leads, because a type that names nothing rules out more than a name does. */
  it('leads the list, ahead of every other filter', () => {
    const everything = state({
      category: 'does-not-exist',
      name: 'Nonexistent Studio',
      date: '2026-06-14',
      city: 'Austin',
    });

    expect(relaxations(everything, KNOWN_SLUGS)[0]?.label).toBe('Any vendor type');
  });
});
