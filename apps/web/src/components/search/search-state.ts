'use client';

import {
  calendarDateSchema,
  DEFAULT_PAGE_SIZE,
  MAX_BUSINESS_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PACKAGE_PRICE_CENTS,
  REVIEW_RATING_MAX,
  slugSchema,
  uuidSchema,
  VENDOR_SORT_OPTIONS,
  type VendorSortOption,
} from '@vendor-marketplace/shared';
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
  page: z.number().int().min(1),
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
export function parseSearchState(raw: SearchState): ParsedSearchState {
  const result = searchStateSchema.safeParse(raw);

  /*
   * Zod reports one issue per failing field and each issue's path names it, so
   * one whole-object parse tells us exactly which params to clear. Every issue
   * here is top-level; a `tags` element failure still reports `tags`.
   */
  const dropped: DroppedSearchField[] = result.success
    ? []
    : [...new Set(result.error.issues.map((issue) => issue.path[0] as DroppedSearchField))];

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
  minPriceCents: 'price range',
  maxPriceCents: 'price range',
  minRating: 'rating',
  tags: 'tags',
  sort: 'sort order',
  page: 'page',
};

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

  const labels = [...new Set(dropped.map((field) => DROPPED_FIELD_LABELS[field]))];

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
   * Validated here rather than in the screen, because this hook is the only
   * way the URL reaches the screen. A component that reads `state` can format
   * it, compare it and query with it without checking it first — which is the
   * whole point, since the checking is what nobody remembers to do.
   *
   * Memoized on `raw`, which `useQueryStates` keeps stable while the URL is
   * unchanged. Parsing afresh each render would hand every consumer a new
   * object identity on renders the URL had nothing to do with — cheap in CPU,
   * but it makes `state` unusable as an effect dependency or a `memo` prop.
   */
  const { state, dropped } = useMemo(() => parseSearchState(raw as SearchState), [raw]);

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
