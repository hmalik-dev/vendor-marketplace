import { MAX_PACKAGE_PRICE_CENTS } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import {
  activeRefineCount,
  applicableTagSelection,
  clearedParamsLine,
  droppedTagGroupsLine,
  parseSearchState,
  searchParsers,
  toSearchQuery,
  hasQuery,
  unusableSearchParams,
  type DroppedSearchField,
  type ParsedSearchState,
  type SearchState,
} from './search-state';

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

/**
 * The screen's boundary as the hook applies it: `nuqs` parses the URL, then
 * `parseSearchState` judges what survived *and* what the URL asked for.
 */
function parseUrl(query: Record<string, string>): ParsedSearchState {
  const params = new URLSearchParams(query);
  const raw: SearchState = { ...EMPTY };

  for (const field of Object.keys(query) as DroppedSearchField[]) {
    const parsed = searchParsers[field].parse(query[field] as string);
    if (parsed !== null) {
      Object.assign(raw, { [field]: parsed });
    }
  }

  return parseSearchState(raw, params);
}

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

/*
 * The table IS the test. Every row is a URL a person can paste into Slack, and
 * every one of them returned HTTP 500 before this boundary existed — an
 * unparseable date reached `Intl.DateTimeFormat.format`, and a price above
 * `int4` reached Postgres. A single-example test does not cover this class.
 */
describe('parseSearchState', () => {
  it.each([
    ['?date=not-a-date', { date: 'not-a-date' }, 'date'],
    ['?date=2026-13-45', { date: '2026-13-45' }, 'date'],
    ['?date=0000-00-00', { date: '0000-00-00' }, 'date'],
    [
      '?date=2026-08-28T12:00:00Z — a plausible ISO timestamp',
      { date: '2026-08-28T12:00:00Z' },
      'date',
    ],
    [
      '?minPriceCents=2147483648 — one past int4',
      { minPriceCents: 2_147_483_648 },
      'minPriceCents',
    ],
    [
      '?minPriceCents above the package cap',
      { minPriceCents: MAX_PACKAGE_PRICE_CENTS + 1 },
      'minPriceCents',
    ],
    ['?maxPriceCents below zero', { maxPriceCents: -500 }, 'maxPriceCents'],
    ['?minRating=9 — above the five-star ceiling', { minRating: 9 }, 'minRating'],
    ['?page=0 — pages are one-based', { page: 0 }, 'page'],
    ['?category=NOT A SLUG', { category: 'NOT A SLUG' }, 'category'],
    ['?city= a 300-character paste', { city: 'A'.repeat(300) }, 'city'],
  ] as const)('clears %s and keeps the rest of the query', (_url, hostile, field) => {
    const { state, dropped } = parseSearchState({ ...EMPTY, city: 'Austin', ...hostile });

    expect(dropped).toContain(field);
    expect(state[field]).toEqual(EMPTY[field]);
    // The question the customer asked survives the param that could not be used.
    if (field !== 'city') {
      expect(state.city).toBe('Austin');
    }
  });

  it('keeps every value a well-formed URL carries', () => {
    const valid: SearchState = {
      ...EMPTY,
      category: 'photography',
      city: 'Austin',
      date: '2026-06-14',
      minPriceCents: 50_000,
      maxPriceCents: MAX_PACKAGE_PRICE_CENTS,
      minRating: 4.5,
      page: 3,
    };

    expect(parseSearchState(valid)).toEqual({ state: valid, dropped: [] });
  });

  it('clears both ends of a range whose floor is above its ceiling', () => {
    const { state, dropped } = parseSearchState({
      ...EMPTY,
      minPriceCents: 900_000,
      maxPriceCents: 100_000,
    });

    expect(state.minPriceCents).toBeNull();
    expect(state.maxPriceCents).toBeNull();
    expect(dropped).toEqual(['minPriceCents', 'maxPriceCents']);
  });

  /*
   * "Today" is the viewer's local day and the server rendering this screen
   * cannot know it, so a past date is judged by the client-only effect in the
   * shell. Clearing it here would render one answer on the server and another
   * after hydration.
   */
  it('leaves an already-past date alone, because that is not its judgement to make', () => {
    const { state, dropped } = parseSearchState({ ...EMPTY, date: '2020-01-01' });

    expect(state.date).toBe('2020-01-01');
    expect(dropped).toEqual([]);
  });
});

describe('clearedParamsLine', () => {
  it('says nothing when the URL was entirely usable', () => {
    expect(clearedParamsLine([])).toBeNull();
  });

  it('names the one param it cleared, in the customer’s words', () => {
    expect(clearedParamsLine(['date'])).toBe(
      "That date isn't one we can use, so it was cleared — the rest of your search still applies.",
    );
  });

  it('names both ends of a price range once, not twice', () => {
    expect(clearedParamsLine(['minPriceCents', 'maxPriceCents'])).toBe(
      "That price range isn't one we can use, so it was cleared — the rest of your search still applies.",
    );
  });

  it('lists several cleared params in one line', () => {
    expect(clearedParamsLine(['date', 'minRating'])).toBe(
      "The date and rating aren't ones we can use, so they were cleared — the rest of your search still applies.",
    );
  });

  it('never names a URL parameter key', () => {
    expect(clearedParamsLine(['minPriceCents'])).not.toContain('minPriceCents');
  });
});

/*
 * #403 acceptance 3. The two bounds are refused apart, so they are named apart:
 * a ceiling above the cap with a floor the API accepted announced "that price
 * range … was cleared" while the floor was still in the URL, still in the
 * request and still drawing its chip.
 */
describe('clearedParamsLine — a half-rejected price range', () => {
  it('names the maximum when only the ceiling was dropped', () => {
    expect(clearedParamsLine(['maxPriceCents'])).toBe(
      "That maximum price isn't one we can use, so it was cleared — the rest of your search still applies.",
    );
  });

  it('names the minimum when only the floor was dropped', () => {
    expect(clearedParamsLine(['minPriceCents'])).toBe(
      "That minimum price isn't one we can use, so it was cleared — the rest of your search still applies.",
    );
  });

  it('does not call one bound a range', () => {
    expect(clearedParamsLine(['maxPriceCents'])).not.toContain('price range');
  });
});

/*
 * #403 acceptance 7. `nuqs` answers `null` for a value its parser cannot read
 * and the parser's default then stands in, which is right for the value and
 * silent about the ask: `?page=abc` and `?sort=evil` rendered defaults with no
 * word, while `?page=2147483648` was announced as cleared. Which half a bad
 * param landed in depended on whether it happened to survive as far as the
 * schema, and the screen's own rule is that it names every param it drops.
 */
describe('unusableSearchParams', () => {
  const of = (query: string): DroppedSearchField[] =>
    unusableSearchParams(new URLSearchParams(query));

  it('reports a non-numeric page', () => {
    expect(of('page=abc')).toEqual(['page']);
  });

  it('reports an unknown sort', () => {
    expect(of('sort=evil')).toEqual(['sort']);
  });

  it('reports a non-numeric price bound', () => {
    expect(of('minPriceCents=abc&maxPriceCents=xyz')).toEqual(['minPriceCents', 'maxPriceCents']);
  });

  it('reports a non-numeric rating', () => {
    expect(of('minRating=good')).toEqual(['minRating']);
  });

  it('says nothing about params it could read', () => {
    expect(of('page=2&sort=price_asc&minPriceCents=1000&category=photography')).toEqual([]);
  });

  /*
   * An empty value asks nothing, rather than asking something unreadable.
   * Complaining about it would be inventing a complaint.
   */
  it('ignores a param present but empty', () => {
    expect(of('sort=&page=&minRating=')).toEqual([]);
  });

  it('says nothing when the URL carries no params at all', () => {
    expect(of('')).toEqual([]);
  });

  /*
   * The whole point of finding them: the sentence. `?page=abc&sort=evil` said
   * nothing at all before, and the combined bad URL listed every other dropped
   * param while omitting the sort it had also replaced.
   */
  it('feeds the same sentence every other cleared param uses', () => {
    expect(clearedParamsLine(of('page=abc&sort=evil'))).toBe(
      "The sort order and page aren't ones we can use, so they were cleared — the rest of your search still applies.",
    );
  });
});

/*
 * The two gates together, because neither is exhaustive alone and nothing else
 * says so.
 *
 * `unusableSearchParams` catches the params whose `nuqs` parser answers `null`
 * and lets a default stand in — `page`, `sort`, the price bounds, the rating —
 * because those are the ones whose ask is erased before the schema can judge
 * it. Every other param is a string all the way to `searchStateSchema`, which
 * judges it there. The split is not arbitrary, but it is also not visible, and
 * a param added with a parser that cannot fail would otherwise drop out of the
 * notice with no lint error and no failing test.
 *
 * So: one hostile value per param, asserting each is named.
 */
describe('every search param is announced when the URL asks something unusable', () => {
  const HOSTILE: Record<DroppedSearchField, string> = {
    // Longer than MAX_BUSINESS_NAME_LENGTH.
    name: 'n'.repeat(500),
    category: 'Not A Slug!',
    city: 'c'.repeat(500),
    state: 's'.repeat(500),
    minPriceCents: 'abc',
    maxPriceCents: 'abc',
    date: '2026-13-45',
    minRating: 'excellent',
    tags: 'not-a-uuid',
    sort: 'evil',
    page: 'abc',
  };

  it.each(Object.keys(HOSTILE) as DroppedSearchField[])('names %s', (field) => {
    const { dropped } = parseUrl({ [field]: HOSTILE[field] });

    expect(dropped).toContain(field);
    expect(clearedParamsLine(dropped)).toContain("isn't one we can use");
  });

  /*
   * And every one of them is *cleared*, not merely named. Announced-but-applied
   * is the exact contradiction #403 exists to remove, so the two sets have to
   * be one set — `parseSearchState` owns both halves for that reason.
   */
  it.each(Object.keys(HOSTILE) as DroppedSearchField[])('clears %s as well', (field) => {
    const { state } = parseUrl({ [field]: HOSTILE[field] });

    expect(state[field]).toEqual(EMPTY[field]);
  });
});

/*
 * `nuqs`'s numeric parsers are `parseInt`/`parseFloat`: they read a leading
 * number and discard the rest, so only a value with no leading digits at all
 * answers `null`. Measured against `nuqs@2.10.1`:
 *
 *   parseAsInteger.parse('12abc') -> 12     parseAsInteger.parse('0x10') -> 16
 *   parseAsInteger.parse('1e3')   -> 1      parseAsFloat.parse('4.5xyz') -> 4.5
 *
 * Each of those was silently obeyed: `?minPriceCents=12abc` drew a $0.12 floor,
 * sent `minPriceCents=12`, dropped every unpriced vendor from the grid, and
 * said nothing. `?page=2abc` served page 2 — a non-numeric page, which is the
 * literal wording of this ticket's acceptance criterion.
 */
describe('a param that is only partly a number', () => {
  it.each([
    ['minPriceCents', '12abc'],
    ['minPriceCents', '0x10'],
    ['minPriceCents', '1e3'],
    ['maxPriceCents', '900zzz'],
    ['page', '2abc'],
    ['minRating', '4.5xyz'],
  ] as const)('names and clears %s=%s', (field, value) => {
    const { state, dropped } = parseUrl({ [field]: value });

    expect(dropped).toContain(field);
    expect(state[field]).toEqual(EMPTY[field]);
  });

  /* The well-formed forms the app itself writes must not be swept up with them. */
  it.each([
    ['minPriceCents', '120000'],
    ['maxPriceCents', '0'],
    ['page', '3'],
    ['page', '01'],
    ['minRating', '4.5'],
    ['minRating', '4'],
  ] as const)('leaves %s=%s alone', (field, value) => {
    const { dropped } = parseUrl({ [field]: value });

    expect(dropped).not.toContain(field);
  });

  /*
   * `?page=01` is the case a round-trip check would get wrong: `parseInt` reads
   * 1, `String(1)` is `'1'`, and comparing the two would announce the param as
   * cleared while honouring it — the same untruth one step over. It is judged
   * on its shape instead, so it is honoured silently.
   */
  it('honours a zero-padded page rather than complaining about it', () => {
    expect(parseUrl({ page: '01' }).state.page).toBe(1);
  });
});

/*
 * #418. A tag id in the URL says nothing about which group it belongs to, so
 * this is the one filter the schema in this file cannot judge: it takes the tag
 * list the screen already holds and reports what the chosen category cannot
 * offer, so the shell can drop it *before* the request and say so afterwards.
 */
describe('applicableTagSelection', () => {
  const ENGLISH = 'a1111111-1111-4111-8111-111111111111';
  const SOUTH_ASIAN = 'a2222222-2222-4222-8222-222222222222';
  const HALAL = 'a3333333-3333-4333-8333-333333333333';
  const KOSHER = 'a4444444-4444-4444-8444-444444444444';

  const KNOWN = [
    { id: ENGLISH, category: 'language' },
    { id: SOUTH_ASIAN, category: 'cultural' },
    { id: HALAL, category: 'dietary' },
    { id: KOSHER, category: 'dietary' },
  ] as const;

  it('drops a dietary tag on a photography search and names the group', () => {
    expect(applicableTagSelection('photography', [ENGLISH, HALAL], KNOWN)).toEqual({
      kept: [ENGLISH],
      droppedGroups: ['dietary'],
    });
  });

  it('names a group once however many of its tags were chosen', () => {
    expect(applicableTagSelection('photography', [HALAL, KOSHER], KNOWN)).toEqual({
      kept: [],
      droppedGroups: ['dietary'],
    });
  });

  it('keeps a dietary tag on a catering search', () => {
    expect(applicableTagSelection('catering', [ENGLISH, HALAL], KNOWN)).toEqual({
      kept: [ENGLISH, HALAL],
      droppedGroups: [],
    });
  });

  it('keeps everything when no category is chosen', () => {
    expect(applicableTagSelection('', [HALAL], KNOWN)).toEqual({
      kept: [HALAL],
      droppedGroups: [],
    });
  });

  /*
   * An id we cannot classify has told us nothing, and dropping a filter on a
   * guess is the failure this ticket is about pointing the other way. The API
   * answers an unknown tag id with an empty grid, which is a truthful answer.
   */
  it('leaves an id it cannot classify alone rather than guessing it away', () => {
    expect(
      applicableTagSelection('photography', ['b0000000-0000-4000-8000-000000000000'], KNOWN),
    ).toEqual({
      kept: ['b0000000-0000-4000-8000-000000000000'],
      droppedGroups: [],
    });
  });

  it('preserves the order of the ids it keeps', () => {
    expect(
      applicableTagSelection('photography', [SOUTH_ASIAN, HALAL, ENGLISH], KNOWN).kept,
    ).toEqual([SOUTH_ASIAN, ENGLISH]);
  });
});

describe('droppedTagGroupsLine', () => {
  it('says which filter went and which vendors it does not apply to', () => {
    expect(droppedTagGroupsLine(['dietary'], 'photography')).toBe(
      'Dietary filters don’t apply to photographers, so they were cleared — the rest of your search still applies.',
    );
  });

  it('names two groups as a pair rather than stacking two sentences', () => {
    expect(droppedTagGroupsLine(['cultural', 'dietary'], 'photography')).toBe(
      'Cultural and Dietary filters don’t apply to photographers, so they were cleared — the rest of your search still applies.',
    );
  });

  it('says nothing when nothing was dropped', () => {
    expect(droppedTagGroupsLine([], 'photography')).toBeNull();
  });
});
