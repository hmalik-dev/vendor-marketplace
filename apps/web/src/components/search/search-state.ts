'use client';

import {
  calendarDateSchema,
  DEFAULT_PAGE_SIZE,
  MAX_BUSINESS_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PACKAGE_PRICE_CENTS,
  paginationQuerySchema,
  REVIEW_RATING_MAX,
  slugSchema,
  uuidSchema,
  VENDOR_SORT_OPTIONS,
  type VendorSortOption,
} from '@vendor-marketplace/shared';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { z } from 'zod';
import {
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';

/**
 * Search state lives in the URL, so a search is shareable and the back button
 * works. `nuqs` keeps the params and the React state in one place; the defaults
 * here are what "no value" looks like, and a param at its default is omitted
 * from the URL rather than written out.
 *
 * Two kinds of value live here and they are not interchangeable:
 *
 * - **The query** — `category`, `city`, `date`. Three enumerable values owned
 *   by the search bar. There is no free-text query on the main path; the
 *   retired `q` param is gone (decision D6).
 * - **Refinements** — price, rating, tags. Owned by the Refine bar.
 *
 * `name` is neither: it is the referral affordance behind "Search by name",
 * matched against the business name alone.
 *
 * See design/design-plan/11-search.md.
 */
export const searchParsers = {
  name: parseAsString.withDefault(''),
  category: parseAsString.withDefault(''),
  city: parseAsString.withDefault(''),
  state: parseAsString.withDefault(''),
  minPriceCents: parseAsInteger,
  maxPriceCents: parseAsInteger,
  date: parseAsString.withDefault(''),
  minRating: parseAsFloat,
  tags: parseAsArrayOf(parseAsString).withDefault([]),
  sort: parseAsStringLiteral(VENDOR_SORT_OPTIONS).withDefault('relevance'),
  page: parseAsInteger.withDefault(1),
} as const;

export interface SearchState {
  name: string;
  category: string;
  city: string;
  state: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  date: string;
  minRating: number | null;
  tags: string[];
  sort: VendorSortOption;
  page: number;
}

export type SearchPatch = Partial<SearchState>;

/**
 * The screen's boundary schema — one field per URL param, and the only place
 * that decides what a param is allowed to be.
 *
 * `nuqs` reads the URL; it does not validate it. `?date=not-a-date` and
 * `?date=2026-13-45` both arrived here as plain strings, reached
 * `new Date(...)` and then an `Intl` formatter, which throws
 * `RangeError: Invalid time value` — HTTP 500 for a URL anyone can paste into
 * Slack. `?minPriceCents=2147483648` passed straight through to the API and
 * overflowed `int4`. Every bound below is the API's own bound, read from the
 * same constants, so a value that clears this one is not refused downstream
 * for being out of range.
 *
 * `date` is the one deliberate gap: the API additionally refuses a date that
 * is past everywhere on Earth, which this schema allows through because
 * "today" is the viewer's local day. The client-only effect in the shell
 * clears that one and says so.
 *
 * See `.claude/rules/web-route-boundaries.md`.
 */
const searchStateSchema = z.object({
  name: z.string().max(MAX_BUSINESS_NAME_LENGTH),
  category: z.union([z.literal(''), slugSchema]),
  city: z.string().max(MAX_NAME_LENGTH),
  state: z.string().max(MAX_NAME_LENGTH),
  minPriceCents: z.number().int().min(0).max(MAX_PACKAGE_PRICE_CENTS).nullable(),
  maxPriceCents: z.number().int().min(0).max(MAX_PACKAGE_PRICE_CENTS).nullable(),
  date: z.union([z.literal(''), calendarDateSchema]),
  minRating: z.number().min(0).max(REVIEW_RATING_MAX).nullable(),
  // Tag ids, matching the API's own field. Validating these against nothing
  // while every neighbour is bounded would leave `?tags=<anything>` the one
  // param that still reaches the API and comes back as a failed search.
  tags: z.array(uuidSchema),
  sort: z.enum(VENDOR_SORT_OPTIONS),
  /*
    Derived from the API's own pagination schema rather than restated. `page`
    was declared here and in `vendorSearchQuerySchema` and the two disagreed:
    this side had a lower bound and no upper one, so `?page=2147483648` cleared
    the screen's boundary, reached the DAO and overflowed `int4` computing its
    offset — a 500 for a URL anyone can paste.

    `unwrap()` drops the API's `.default(1)`: the URL layer supplies its own
    default through `searchParsers`, and a schema default here would mask a
    dropped param rather than reporting it in `dropped`.
  */
  page: paginationQuerySchema.shape.page.unwrap(),
});

/**
 * What "no value" looks like, per field — the value a dropped param falls to.
 *
 * Must mirror the defaults on `searchParsers` above. A value that disagrees
 * would clear a param to something the URL layer would then write back out.
 */
const SEARCH_STATE_FALLBACKS: SearchState = {
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

export type DroppedSearchField = keyof SearchState;

export interface ParsedSearchState {
  /** Safe to format, compare and query with. Never holds a rejected value. */
  readonly state: SearchState;
  /** Which params were rejected, so the screen can say they were cleared. */
  readonly dropped: readonly DroppedSearchField[];
}

/**
 * Validates the URL's params field by field, replacing each rejected one with
 * its "no value" fallback.
 *
 * Field by field rather than whole-object on purpose: one unparseable date
 * must not throw away the category and city the customer actually asked for.
 * The question they asked is still a good question.
 *
 * The past-date rule is deliberately **not** here. "Today" is the viewer's
 * local day, which the server rendering this screen cannot know, so it stays
 * in the client-only effect that already handles it.
 */
export function parseSearchState(raw: SearchState, params?: URLSearchParams): ParsedSearchState {
  const result = searchStateSchema.safeParse(raw);

  /*
   * Zod reports one issue per failing field and each issue's path names it, so
   * one whole-object parse tells us exactly which params to clear. Every issue
   * here is top-level; a `tags` element failure still reports `tags`.
   */
  const dropped: DroppedSearchField[] = result.success
    ? []
    : [...new Set(result.error.issues.map((issue) => issue.path[0] as DroppedSearchField))];

  /*
   * The params the URL asked for that never reached the schema intact, merged
   * here rather than at the caller so that **announced and cleared are the
   * same set**. Merging only the announcement was the defect: a partly-numeric
   * bound was named as cleared while its truncated value was still applied,
   * which is the contradiction this whole ticket is about.
   *
   * The raw params are optional so the pure callers — and the tests that drive
   * this function directly — keep working; without them only the schema
   * judges, which is what happens on any surface that has no URL to read.
   */
  if (params !== undefined) {
    for (const field of unusableSearchParams(params)) {
      if (!dropped.includes(field)) {
        dropped.push(field);
      }
    }
  }

  const state: SearchState = { ...raw };

  for (const field of dropped) {
    // `Object.assign` rather than `state[field] = …`: assigning through a
    // union-typed key widens the value to the union of every field's type,
    // which TypeScript refuses. This form keeps `state` narrowed to
    // `SearchState` without an `any` or a cast.
    Object.assign(state, { [field]: SEARCH_STATE_FALLBACKS[field] });
  }

  /*
   * A range whose floor is above its ceiling is refused by the API as a pair,
   * so neither value alone is the culprit and both are cleared. Left in, the
   * screen would render the incoherent `$21,474,836.48 – $10,000+` chip over a
   * result set the API had refused to produce.
   *
   * Neither can already be in `dropped`: a cleared price is `null`, which this
   * guard excludes.
   */
  if (
    state.minPriceCents !== null &&
    state.maxPriceCents !== null &&
    state.minPriceCents > state.maxPriceCents
  ) {
    state.minPriceCents = null;
    state.maxPriceCents = null;
    dropped.push('minPriceCents', 'maxPriceCents');
  }

  return { state, dropped };
}

/** How a cleared param is named to a customer. Never the param's own key. */
const DROPPED_FIELD_LABELS: Record<DroppedSearchField, string> = {
  category: 'vendor type',
  city: 'city',
  state: 'state',
  name: 'name',
  date: 'date',
  /*
   * The two bounds are named apart, because they are refused apart. Both read
   * `price range` until #403, so half a rejected range — a ceiling above the
   * cap with a floor the API accepted — announced "that price range ... was
   * cleared" while the floor was still in the URL, still in the request, and
   * still drawing its chip. The reader was told a filter was gone that was
   * visibly narrowing the grid in front of them.
   */
  minPriceCents: 'minimum price',
  maxPriceCents: 'maximum price',
  minRating: 'rating',
  tags: 'tags',
  sort: 'sort order',
  page: 'page',
};

/** What the pair is called when both bounds went, since that is one thing. */
const PRICE_RANGE_LABEL = 'price range';

/**
 * The customer-facing names of the params that were dropped, in the order they
 * were dropped, without repeats.
 *
 * Both bounds gone is the range gone, and is named once as the reader set it.
 * One bound gone is not a range gone, so it keeps its own name — that is the
 * whole point of the split above.
 */
function droppedLabels(dropped: readonly DroppedSearchField[]): string[] {
  const fields = new Set(dropped);
  const wholeRange = fields.has('minPriceCents') && fields.has('maxPriceCents');

  return [
    ...new Set(
      dropped.map((field) =>
        wholeRange && (field === 'minPriceCents' || field === 'maxPriceCents')
          ? PRICE_RANGE_LABEL
          : DROPPED_FIELD_LABELS[field],
      ),
    ),
  ];
}

/** Every param the URL layer reads, in the order a notice names them. */
const SEARCH_PARAM_FIELDS = Object.keys(searchParsers) as DroppedSearchField[];

/**
 * The text a numeric param's value must be before its parser's answer can be
 * trusted at all.
 *
 * **`nuqs`'s numeric parsers are `parseInt` and `parseFloat`, which read a
 * prefix and discard the rest.** Measured against `nuqs@2.10.1`: `'12abc'` is
 * `12`, `'2abc'` is `2`, `'0x10'` is `16`, `'1e3'` is `1`, `'4.5xyz'` is
 * `4.5`. Only a value with no leading digits at all — `'abc'` — answers
 * `null`. So a partly-numeric param was neither announced nor cleared but
 * *silently obeyed*: `?minPriceCents=12abc` drew a `$0.12` floor, sent
 * `minPriceCents=12`, and dropped every unpriced vendor from the grid, with
 * the live region saying nothing. `?page=2abc` is a non-numeric page — the
 * literal wording of this ticket's acceptance — quietly served as page 2.
 *
 * A shape, not a round-trip of the parsed value: `String(parseInt('01'))` is
 * `'1'`, so comparing them would announce `?page=01` as cleared while honouring
 * it, which is the same untruth one step over. These patterns accept every
 * form the app itself writes (`toSearchQuery` serialises with `String`), so no
 * link this product generates can trip them.
 */
const RAW_NUMERIC_SHAPES: Partial<Record<DroppedSearchField, RegExp>> = {
  minPriceCents: /^\d+$/,
  maxPriceCents: /^\d+$/,
  page: /^\d+$/,
  minRating: /^\d+(?:\.\d+)?$/,
};

/**
 * Params the URL carried that the URL layer could make nothing of.
 *
 * `nuqs` answers `null` for a value its parser cannot read, and each parser's
 * default then stands in — which is right for the *value* and silent about the
 * *ask*. `?page=abc` rendered page 1 and `?sort=evil` rendered the default
 * order, both without a word, while `?page=2147483648` was announced as
 * cleared: the screen named some of the params it dropped and not others, and
 * which half you landed in depended on whether the value happened to survive
 * as far as the schema.
 *
 * Numeric params are judged on their text (above) because their parser answers
 * a number for input that is not one. Everything else is judged on the
 * parser's own verdict, and the params whose parser cannot fail — plain
 * strings and the tag list — reach `searchStateSchema` unchanged and are
 * judged there.
 *
 * An empty value (`?sort=`) is a param that asks nothing, not one that asks
 * something unreadable, so it is left alone — writing "that sort order isn't
 * one we can use" over a blank would be inventing a complaint.
 *
 * Takes the raw params rather than reading them, so the rule is a unit test.
 */
export function unusableSearchParams(params: URLSearchParams): DroppedSearchField[] {
  const unusable: DroppedSearchField[] = [];

  for (const field of SEARCH_PARAM_FIELDS) {
    const raw = params.get(field);

    if (raw === null || raw === '') {
      continue;
    }

    const shape = RAW_NUMERIC_SHAPES[field];

    if (shape === undefined ? searchParsers[field].parse(raw) === null : !shape.test(raw.trim())) {
      unusable.push(field);
    }
  }

  return unusable;
}

/**
 * The line the screen shows when a param was cleared — `null` when none was.
 *
 * It says what was dropped and what still holds, matching how an already-past
 * date is announced today. Silently ignoring a filter the URL asked for would
 * leave the customer reading a result set that answers a different question.
 */
export function clearedParamsLine(dropped: readonly DroppedSearchField[]): string | null {
  // The common case by far, and the one every render of a well-formed URL
  // takes: answer it before allocating anything.
  if (dropped.length === 0) {
    return null;
  }

  const labels = droppedLabels(dropped);

  const subject =
    labels.length === 1
      ? `That ${labels[0]} isn't one we can use, so it was cleared`
      : `The ${labels.slice(0, -1).join(', ')} and ${labels.at(-1)} aren't ones we can use, so they were cleared`;

  return `${subject} — the rest of your search still applies.`;
}

/** The three values the search bar owns. Never rendered as Refine chips. */
export type SearchQueryValues = Pick<SearchState, 'category' | 'city' | 'date'>;

export interface UseSearchState {
  /** Already validated: every consumer of this hook gets safe values. */
  state: SearchState;
  /** Params the URL asked for that could not be used, so the screen can say so. */
  dropped: readonly DroppedSearchField[];
  /** Applies a patch. Any change but paging returns to page 1. */
  setState: (patch: SearchPatch) => void;
  /** Clears the Refine bar only — the query stays, because it is the question. */
  clearRefinements: () => void;
}

export function useSearchState(): UseSearchState {
  const [raw, setQuery] = useQueryStates(searchParsers, { history: 'push' });

  /*
   * The raw params, alongside the parsed ones, because the two carry different
   * information: `raw` says what each value ended up as, `searchParams` says
   * what was asked for. A param `nuqs` could not read is already at its
   * fallback by the time it reaches `parseSearchState`, so nothing but the URL
   * itself can tell that it was ever there.
   */
  const searchParams = useSearchParams();

  /*
   * Validated here rather than in the screen, because this hook is the only
   * way the URL reaches the screen. A component that reads `state` can format
   * it, compare it and query with it without checking it first — which is the
   * whole point, since the checking is what nobody remembers to do.
   *
   * Memoized on `raw`, which `useQueryStates` keeps stable while the URL is
   * unchanged, and on the params object, which Next keeps stable the same way.
   * Parsing afresh each render would hand every consumer a new object identity
   * on renders the URL had nothing to do with — cheap in CPU, but it makes
   * `state` unusable as an effect dependency or a `memo` prop.
   */
  const { state, dropped } = useMemo(
    () => parseSearchState(raw as SearchState, searchParams),
    [raw, searchParams],
  );

  return {
    state,
    dropped,
    setState: (patch) => {
      /*
       * Changing a filter while on page 3 would otherwise ask for the third
       * page of a result set that may only have one — the user sees an empty
       * grid and reads it as "no matches".
       */
      const resetsPage = Object.keys(patch).some((key) => key !== 'page');
      void setQuery(resetsPage ? { ...patch, page: null } : patch);
    },
    /*
     * "Clear" sits in the Refine bar and clears the Refine bar. Wiping the
     * category and city too would throw away the question the results answer
     * and drop the customer back to an unfiltered grid they never asked for.
     */
    clearRefinements: () => {
      void setQuery({
        minPriceCents: null,
        maxPriceCents: null,
        minRating: null,
        tags: null,
        page: null,
      });
    },
  };
}

/** Turns the current state into the querystring the API expects. */
export function toSearchQuery(state: SearchState): string {
  const params = new URLSearchParams();

  if (state.name) params.set('name', state.name);
  if (state.category) params.set('category', state.category);
  if (state.city) params.set('city', state.city);
  if (state.state) params.set('state', state.state);
  if (state.minPriceCents !== null) params.set('minPriceCents', String(state.minPriceCents));
  if (state.maxPriceCents !== null) params.set('maxPriceCents', String(state.maxPriceCents));
  if (state.date) params.set('date', state.date);
  if (state.minRating !== null) params.set('minRating', String(state.minRating));
  for (const tag of state.tags) {
    params.append('tags', tag);
  }
  params.set('sort', state.sort);
  params.set('page', String(state.page));
  params.set('pageSize', String(DEFAULT_PAGE_SIZE));

  return params.toString();
}

/**
 * How many Refine chips are narrowing the results right now — the number the
 * mobile "Filters · N" trigger carries.
 *
 * The query (category, city, date) is deliberately excluded: it is shown by the
 * search bar, which owns it. Counting it here would be a second representation
 * of one state, and the date must never read as a filter at any width.
 */
export function activeRefineCount(state: SearchState): number {
  return [
    state.minPriceCents !== null || state.maxPriceCents !== null,
    state.minRating !== null,
    state.tags.length > 0,
  ].filter(Boolean).length;
}

/** Whether the customer has actually asked something yet. */
export function hasQuery(state: SearchState): boolean {
  return state.category !== '' || state.city !== '' || state.date !== '' || state.name !== '';
}
