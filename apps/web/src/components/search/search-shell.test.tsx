import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchPatch, SearchState } from './search-state';

const apiRequest = vi.fn();

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiRequest: (path: string, options: unknown) => apiRequest(path, options),
}));

let state: SearchState;
const setState = vi.fn<(patch: SearchPatch) => void>();
const clearRefinements = vi.fn();

vi.mock('./search-state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./search-state')>()),
  useSearchState: () => ({ state, setState, clearRefinements }),
}));

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

    render(<SearchShell categories={CATEGORIES} tags={[]} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Searching…');
  });

  it('names the query in the searching line when the customer gave one', async () => {
    apiRequest.mockImplementation(neverResolves);
    state = baseState({ category: 'photography', city: 'Austin' });

    render(<SearchShell categories={CATEGORIES} tags={[]} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'Searching photographers in Austin…',
    );
  });

  /*
   * `40-states.md`: chrome the user already filled in is never skeletonised.
   * The query bar and the Refine bar stay real while the grid loads — only the
   * part that is actually unknown is replaced.
   */
  it('keeps the query bar real and skeletonises only the results grid', async () => {
    apiRequest.mockImplementation(neverResolves);

    const { container } = render(<SearchShell categories={CATEGORIES} tags={[]} />);

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

    const { container } = render(<SearchShell categories={CATEGORIES} tags={[]} />);
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

    const { rerender } = render(<SearchShell categories={CATEGORIES} tags={[]} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('24'),
    );

    apiRequest.mockImplementation(neverResolves);
    state = baseState({ minRating: 4 });
    rerender(<SearchShell categories={CATEGORIES} tags={[]} />);

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

    render(<SearchShell categories={CATEGORIES} tags={[]} />);

    await waitFor(() =>
      expect(screen.getByText('No photographers match all 2 filters')).toBeDefined(),
    );
    expect(
      screen.getByText('The date is the narrowest filter here. Loosen one and results come back.'),
    ).toBeDefined();
  });

  it('offers a one-tap relaxation per filter, loosening exactly one thing', async () => {
    state = baseState({ category: 'photography', date: '2099-06-14', minRating: 4 });

    render(<SearchShell categories={CATEGORIES} tags={[]} />);

    const anyDate = await screen.findByRole('button', { name: 'Any date' });
    anyDate.click();

    expect(setState).toHaveBeenCalledWith({ date: '' });
    expect(screen.getByRole('button', { name: 'Any rating' })).toBeDefined();
  });

  it('diagnoses nothing, and offers nothing to loosen, on an unfiltered search', async () => {
    state = baseState({ category: 'photography' });

    render(<SearchShell categories={CATEGORIES} tags={[]} />);

    await waitFor(() => expect(screen.getByText('No photographers listed yet')).toBeDefined());
    expect(screen.getByText('Try a different vendor type or city.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Any date' })).toBeNull();
  });
});
