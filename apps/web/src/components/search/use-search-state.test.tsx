import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The hook, rendered — not `parseSearchState` driven directly.
 *
 * `search-state.test.ts` covers the boundary function thoroughly, and
 * `search-shell.test.tsx` mocks this hook out entirely, so between them nothing
 * asserted the **wiring**: that `useSearchState` reads the raw params at all and
 * hands them to the boundary. Deleting that argument left the whole suite green
 * while `?page=abc` went back to being obeyed in silence, which is the defect
 * this ticket is about. #403.
 *
 * `nuqs` and `next/navigation` are both stubbed from one `url`, so the two
 * readers cannot drift apart in the fixture the way they could in the app.
 */
let url = '';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(url),
}));

vi.mock('nuqs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('nuqs')>();

  return {
    ...actual,
    // What `useQueryStates` yields: each parser's answer, or its default when
    // the parser could make nothing of the value. That silent fallback is
    // exactly what the hook has to notice.
    useQueryStates: (parsers: Record<string, { parse: (raw: string) => unknown }>) => {
      const params = new URLSearchParams(url);
      const raw = Object.fromEntries(
        Object.entries(parsers).map(([key, parser]) => {
          const value = params.get(key);
          const parsed = value === null ? null : parser.parse(value);

          return [
            key,
            parsed ?? (parser as unknown as { defaultValue?: unknown }).defaultValue ?? null,
          ];
        }),
      );

      return [raw, vi.fn()];
    },
  };
});

const { toSearchQuery, useSearchState } = await import('./search-state');

function Probe(): React.ReactElement {
  const { state, dropped } = useSearchState();

  return (
    <>
      <output data-testid="dropped">{[...dropped].sort().join(',')}</output>
      <output data-testid="page">{String(state.page)}</output>
      <output data-testid="sort">{state.sort}</output>
      <output data-testid="min">{String(state.minPriceCents)}</output>
      {/* The request that goes out, which is the other half of what the
          ticket asks each param class to assert. */}
      <output data-testid="query">{toSearchQuery(state)}</output>
    </>
  );
}

function read(testId: string): string {
  return screen.getByTestId(testId).textContent ?? '';
}

describe('useSearchState reads the raw URL, not only what nuqs made of it', () => {
  afterEach(() => {
    url = '';
    cleanup();
  });

  it('reports a param nuqs silently replaced with its default', () => {
    url = 'page=abc&sort=evil';

    render(<Probe />);

    expect(read('dropped')).toBe('page,sort');
    expect(read('page')).toBe('1');
    expect(read('sort')).toBe('relevance');
    // Cleared means cleared: the request carries the defaults, not `abc`.
    expect(read('query')).toBe('sort=relevance&page=1&pageSize=20');
  });

  /*
   * The harder half, and the one a `parse() === null` check misses: `parseInt`
   * reads a leading number out of `12abc`, so the value arrives looking usable.
   * It has to be both named and cleared.
   */
  it('reports and clears a param nuqs read a number out of', () => {
    url = 'minPriceCents=12abc';

    render(<Probe />);

    expect(read('dropped')).toBe('minPriceCents');
    expect(read('min')).toBe('null');
    expect(read('query')).not.toContain('minPriceCents');
  });

  it('says nothing about a URL it could read', () => {
    url = 'page=2&sort=price_asc&minPriceCents=120000';

    render(<Probe />);

    expect(read('dropped')).toBe('');
    expect(read('page')).toBe('2');
    expect(read('sort')).toBe('price_asc');
    expect(read('min')).toBe('120000');
  });

  it('says nothing about an empty URL', () => {
    render(<Probe />);

    expect(read('dropped')).toBe('');
  });
});
