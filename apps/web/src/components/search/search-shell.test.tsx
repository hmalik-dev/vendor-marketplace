import { ERROR_CODES } from '@vendor-marketplace/shared';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ApiClientError } from '@/lib/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearedParamsLine, type SearchPatch, type SearchState } from './search-state';

/** The cities the City select offers — real places with published vendors. */
const CITIES = [
  { city: 'Austin', state: 'TX', vendorCount: 11 },
  { city: 'Portland', state: 'OR', vendorCount: 3 },
];

const apiRequest = vi.fn();

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiRequest: (path: string, options: unknown) => apiRequest(path, options),
}));

let state: SearchState;
const setState = vi.fn<(patch: SearchPatch) => void>();
const clearRefinements = vi.fn();

/*
 * `state` stands in for what the URL carries, and the mock runs it through the
 * real `parseSearchState` — the same boundary `useSearchState` applies in the
 * app. Handing the shell a pre-validated state instead would test a path no
 * visitor takes, and the hostile-URL cases below are exactly the ones that get
 * past a hook that only ever sees clean values.
 */
vi.mock('./search-state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./search-state')>();

  return {
    ...actual,
    useSearchState: () => ({ ...actual.parseSearchState(state), setState, clearRefinements }),
  };
});

const { SearchShell } = await import('./search-shell');

const CATEGORIES = [
  {
    id: 'c1',
    name: 'Photography',
    slug: 'photography',
    description: 'Photo & film',
    icon: null,
    displayOrder: 1,
    isActive: true,
  },
];

function baseState(overrides: Partial<SearchState> = {}): SearchState {
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

/** A search that never settles, so the loading state stays on screen. */
function neverResolves(): Promise<never> {
  return new Promise(() => undefined);
}

function emptyResult(): unknown {
  return { items: [], total: 0, page: 1, pageSize: 20, facets: { categories: [] } };
}

describe('SearchShell loading state — frame 17', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    setState.mockReset();
    state = baseState();
  });

  afterEach(() => cleanup());

  it('says Searching… rather than a count while the answer is in flight', async () => {
    apiRequest.mockImplementation(neverResolves);

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Searching…');
  });

  it('names the query in the searching line when the customer gave one', async () => {
    apiRequest.mockImplementation(neverResolves);
    state = baseState({ category: 'photography', city: 'Austin' });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'Searching photographers in Austin…',
    );
  });

  /*
   * #242. The `free on …` clause used to be nested INSIDE the `<h1>`, so the
   * heading's accessible name concatenated with no separator — a screen reader
   * announced `11 photographers in Austinfree on Sun, Jun 14` — and the clause
   * inherited the heading role's `letter-spacing: -0.22px`. Frame `02` draws
   * the two as siblings.
   *
   * Asserted on the accessible name rather than on the DOM shape: what was
   * wrong is what the heading is *called*, and a later refactor that keeps the
   * two apart by some other means should still pass.
   */
  it('keeps the date clause out of the heading’s accessible name', async () => {
    apiRequest.mockResolvedValue({
      items: [],
      total: 24,
      page: 1,
      pageSize: 20,
      facets: { categories: [] },
    });
    state = baseState({ category: 'photography', city: 'Austin', date: '2026-06-14' });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    const heading = await screen.findByRole('heading', { level: 1 });

    expect(heading.textContent).not.toContain('free on');
    expect(heading.textContent).toContain('photographers in Austin');
    // The clause is still on the screen — it moved out of the heading, it was
    // not deleted.
    expect(screen.getByText(/free on/)).toBeTruthy();
    expect(heading.contains(screen.getByText(/free on/))).toBe(false);
  });

  /*
   * `40-states.md`: chrome the user already filled in is never skeletonised.
   * The query bar and the Refine bar stay real while the grid loads — only the
   * part that is actually unknown is replaced.
   */
  it('keeps the query bar real and skeletonises only the results grid', async () => {
    apiRequest.mockImplementation(neverResolves);

    const { container } = render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    expect(screen.getAllByLabelText('Vendor type').length).toBeGreaterThan(0);
    // Two full rows of four, mirroring the live grid's geometry exactly —
    // `40-states.md` requires a skeleton to be the shape of what replaces it.
    const skeletons = container.querySelectorAll('[data-slot="skeleton-vendor-card"]');
    expect(skeletons).toHaveLength(8);

    /*
     * Two full rows is `columns x 2`, so 1024's three-column grid wants six,
     * not eight — frame `25 Search — loading · 1024`. The count is fixed and
     * the surplus is hidden in CSS, because this renders on the server where
     * there is no viewport to measure.
     */
    expect(
      [...skeletons].filter((node) => node.className.includes('max-[90rem]:hidden')),
    ).toHaveLength(2);
  });

  /*
   * 1024 is a drawn viewport, not a squeezed 1440: `25 Search results — 1024`
   * gives a 13" laptop the desktop composition with a column removed, rather
   * than the two-column tablet grid it used to inherit.
   */
  it('goes three across from lg, four at the 1440 reference width', async () => {
    apiRequest.mockImplementation(neverResolves);

    const { container } = render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);
    const grid = container.querySelector('[data-slot="skeleton-vendor-card"]')?.parentElement;

    expect(grid?.className).toContain('lg:grid-cols-3');
    expect(grid?.className).toContain('min-[90rem]:grid-cols-4');
    // The gap follows the frames: 14px at 1024, 16px at 1440.
    expect(grid?.className).toContain('gap-3.5');
    expect(grid?.className).toContain('min-[90rem]:gap-4');
  });

  /*
   * A refine on an existing result set must not show the previous query's
   * count while the new one is still loading — that number is about a question
   * the customer has already changed.
   */
  it('never shows a stale count once the query changes', async () => {
    apiRequest.mockResolvedValueOnce({
      items: [],
      total: 24,
      page: 1,
      pageSize: 20,
      facets: { categories: [] },
    });

    const { rerender } = render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('24'),
    );

    apiRequest.mockImplementation(neverResolves);
    state = baseState({ minRating: 4 });
    rerender(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Searching…'),
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toContain('24');
  });
});

describe('SearchShell no results — frame 18', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    setState.mockReset();
    apiRequest.mockResolvedValue(emptyResult());
  });

  afterEach(() => cleanup());

  it('counts the filters the customer set and names the narrowest', async () => {
    state = baseState({ category: 'photography', date: '2099-06-14', minRating: 4 });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    // Frame 18 spells the count — "all three filters", not "all 3".
    await waitFor(() =>
      expect(screen.getByText('No photographers match all two filters')).toBeDefined(),
    );
    expect(
      screen.getByText(
        'The date is the narrowest filter here. Loosen one filter and results come back.',
      ),
    ).toBeDefined();
  });

  /*
   * #260. The component carries both of `40-states.md`'s sizes; this is the
   * assertion that THIS state asks for the marketing one. Without it, deleting
   * `scale="marketing"` from the call site left the whole suite green while
   * frame 18's headline silently went back to 26px on a 420px measure — which
   * is the entire user-visible content of the finding.
   */
  it('draws its empty state at the marketing scale frame 18 uses', async () => {
    state = baseState({ category: 'photography', date: '2099-06-14', minRating: 4 });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    const headline = await screen.findByRole('heading', {
      name: 'No photographers match all two filters',
    });

    expect(headline.className).toContain('text-display-empty');
    expect(headline.className).not.toContain('text-display-md');
  });

  /*
   * Frame 18's `.btnP` is `#B4552F` — clay-400, which `01-foundations.md` names
   * PRIMARY FILL — and its `.btnS` text is `#23201C`, stone-900. `text-stone-800`
   * shipped here for a while and the theme defines no `stone-800`, so it fell
   * straight through to Tailwind's built-in `#292524`: an off-palette colour on
   * a public page that no token could account for.
   */
  it('paints the relaxations in palette', async () => {
    state = baseState({ category: 'photography', date: '2099-06-14', minRating: 4 });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    const primary = await screen.findByRole('button', { name: 'Any date' });
    const secondary = screen.getByRole('button', { name: 'Any rating' });

    expect(primary.className).toContain('bg-clay-400');
    expect(primary.className).not.toContain('bg-clay-500 ');
    expect(secondary.className).toContain('text-stone-900');
    expect(secondary.className).not.toContain('text-stone-800');
  });

  it('offers a one-tap relaxation per filter, loosening exactly one thing', async () => {
    state = baseState({ category: 'photography', date: '2099-06-14', minRating: 4 });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    const anyDate = await screen.findByRole('button', { name: 'Any date' });
    anyDate.click();

    expect(setState).toHaveBeenCalledWith({ date: '' });
    expect(screen.getByRole('button', { name: 'Any rating' })).toBeDefined();
  });

  it('diagnoses nothing, and offers nothing to loosen, on an unfiltered search', async () => {
    state = baseState({ category: 'photography' });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() => expect(screen.getByText('No photographers listed yet')).toBeDefined());
    expect(screen.getByText('Try a different vendor type or city.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Any date' })).toBeNull();
  });
});

/*
 * Each row is a URL that returned HTTP 500. The screen formats the date into
 * its heading, and `Intl.DateTimeFormat.format(Invalid Date)` throws
 * `RangeError: Invalid time value` — which in a Server Component is the 500
 * page. Rendering at all is the assertion; the heading check proves the head
 * and the body read the one parsed value rather than two different sources.
 */
describe('SearchShell against a hostile URL', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue(emptyResult());
    setState.mockReset();
    state = baseState();
  });

  afterEach(() => cleanup());

  it.each([
    'not-a-date',
    '2026-13-45',
    '0000-00-00',
    '2026-08-28T12:00:00Z',
    '<script>alert(1)</script>',
    'A'.repeat(300),
  ])('renders rather than throwing for ?date=%s', async (date) => {
    state = baseState({ category: 'photography', date });

    expect(() =>
      render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />),
    ).not.toThrow();

    const heading = await screen.findByRole('heading', { level: 1 });
    // No "free on …" clause, because there is no date the screen could honour.
    expect(heading.textContent).not.toContain('free on');
    expect(heading.textContent).toContain('photographers');
  });

  it('never sends a rejected value on to the API', async () => {
    state = baseState({ date: 'not-a-date', minPriceCents: 2_147_483_648 });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const [path] = apiRequest.mock.calls[0] as [string];

    expect(path).not.toContain('date=');
    expect(path).not.toContain('minPriceCents');
  });

  it('tells the customer the value was cleared instead of silently ignoring it', async () => {
    state = baseState({ date: 'not-a-date' });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    // The sentence itself is asserted once, in `search-state.test.ts`; here
    // the claim is only that the screen renders it.
    expect(screen.getByText(clearedParamsLine(['date']) ?? '')).toBeDefined();
  });

  /*
   * The API's top-level message is "Request validation failed" — written for
   * whoever reads the logs. Printing an upstream string on a public screen is
   * what `.claude/rules/web-route-boundaries.md` and #72 forbid, and without
   * this test the whole catch branch is unreached by the suite.
   */
  it('never prints the upstream error string when the search fails', async () => {
    apiRequest.mockRejectedValue(
      new ApiClientError(400, ERROR_CODES.VALIDATION_ERROR, 'Request validation failed'),
    );

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeDefined());
    expect(screen.getByText('Could not load vendors just now.')).toBeDefined();
    expect(screen.queryByText(/Request validation failed/)).toBeNull();
  });

  /*
   * #368. The defect this closes: with the API answering 429 for every request,
   * `/search` rendered the ordinary empty-result heading — `No vendors listed
   * yet` — with no error state anywhere. A backend outage was indistinguishable
   * from "nobody matches your filters", and a browser pass driving it reported
   * green.
   *
   * The two branches must therefore assert *different* text, in both
   * directions: a failure is never the empty heading, and an empty result is
   * never the failure heading.
   */
  it('renders the failure state and never the empty-result heading', async () => {
    apiRequest.mockRejectedValue(
      new ApiClientError(429, ERROR_CODES.RATE_LIMITED, 'Too many requests.'),
    );

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeDefined());
    expect(screen.queryByText(/^No vendors/)).toBeNull();
    expect(screen.queryByText(/match that filter/)).toBeNull();
    expect(screen.queryByText(/match all/)).toBeNull();
  });

  it('renders the empty-result heading and never the failure state', async () => {
    apiRequest.mockResolvedValue(emptyResult());

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() => expect(screen.getByText('No vendors listed yet')).toBeDefined());
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.queryByText('Could not load vendors just now.')).toBeNull();
  });

  /*
   * The half that is not on the page. `40-states.md` makes red mean "it
   * failed", and the failure state previously drew the same neutral glyph as
   * the empty state — so the two differed in wording alone, which is the part a
   * hurried reader skips.
   */
  it('tints the failure glyph red, which the empty state never is', async () => {
    apiRequest.mockRejectedValue(new ApiClientError(500, ERROR_CODES.INTERNAL_ERROR, 'Boom'));

    const { container } = render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeDefined());
    expect(container.querySelector('.text-error-500')).not.toBeNull();
    expect(container.querySelector('[data-slot="empty-state"] .text-stone-400')).toBeNull();
  });

  /*
   * The console is the channel a browser agent reads, and it was empty. Without
   * this the page can go back to failing silently and every visual assertion
   * above still passes.
   */
  it('reports the failure to the console so a browser pass cannot miss it', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    apiRequest.mockRejectedValue(
      new ApiClientError(429, ERROR_CODES.RATE_LIMITED, 'Too many requests.'),
    );

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeDefined());
    expect(spy).toHaveBeenCalledWith(
      '[swallowed] search: /vendors request failed',
      expect.anything(),
    );

    spy.mockRestore();
  });

  it('says nothing about cleared params when the URL was entirely usable', async () => {
    state = baseState({ date: '2099-06-14' });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    expect(screen.queryByText(/so it was cleared/)).toBeNull();
  });

  /*
   * A date that parses but has already passed keeps its own wording — it can
   * name the day, which a param that failed the schema cannot. Both now render
   * through one live region, so both branches need holding down.
   */
  it('names the day when clearing a date that has already passed', async () => {
    state = baseState({ date: '2020-01-01' });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() =>
      expect(
        screen.getByText(
          'Wed, Jan 1 has already passed, so the date was cleared — pick a new one to check availability.',
        ),
      ).toBeDefined(),
    );
    expect(setState).toHaveBeenCalledWith({ date: '' });
  });
});

/*
 * `/search?page=2` returned HTTP 200 with an empty results pane while the
 * heading still claimed the full count — 17 vendors and nothing drawn under a
 * line reading "17 photographers".
 *
 * `pageSize` is 20 against 17 vendors, so nothing is lost today. It stops being
 * true the moment the marketplace outgrows one page, and the URL is reachable
 * by hand and by any crawler that guesses it.
 *
 * The correction is a clamp rather than a message: frame `02` draws no
 * pagination at all, so there is no approved string for "that page does not
 * exist" and inventing one would fail the text axis. Going back to the first
 * page is the behaviour the frame can support.
 */
describe('SearchShell out-of-range page', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    setState.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  function pageBeyondTheEnd(): unknown {
    return { items: [], total: 17, page: 2, pageSize: 20, facets: { categories: [] } };
  }

  it('returns to the first page rather than drawing an empty grid under a full count', async () => {
    state = baseState({ page: 2 });
    apiRequest.mockResolvedValue(pageBeyondTheEnd());

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() => expect(setState).toHaveBeenCalledWith({ page: 1 }));
  });

  /*
   * The guard is about a page past the end, not about an empty result set.
   * A genuine no-results search has `total: 0` and must keep frame `18` — the
   * relaxation buttons are the only thing that unsticks it.
   */
  it('leaves a genuinely empty search on the no-results state', async () => {
    state = baseState({ page: 1 });
    apiRequest.mockResolvedValue(emptyResult());

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() =>
      expect(screen.getByText('Try a different vendor type or city.')).toBeDefined(),
    );
    expect(setState).not.toHaveBeenCalledWith({ page: 1 });
  });

  /* And a page that really has rows is left alone. */
  it('does not touch a page that returned results', async () => {
    state = baseState({ page: 1 });
    apiRequest.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      facets: { categories: [] },
    });

    render(<SearchShell categories={CATEGORIES} cities={CITIES} tags={[]} />);

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(setState).not.toHaveBeenCalledWith({ page: 1 });
  });
});
