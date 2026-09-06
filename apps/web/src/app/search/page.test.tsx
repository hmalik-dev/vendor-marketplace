import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const permanentRedirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock('next/navigation', () => ({
  permanentRedirect: (path: string) => permanentRedirect(path),
}));
vi.mock('@/lib/vendor-data', () => ({
  getCategories: async () => [],
  getActiveTags: async () => [],
}));
vi.mock('@/components/search/search-shell', () => ({
  SearchShell: () => <div data-testid="search-shell" />,
}));

const { default: SearchPage } = await import('./page');

async function renderPage(params: Record<string, string | string[]>): Promise<void> {
  render(await SearchPage({ searchParams: Promise.resolve(params) }));
}

/**
 * The route's own half of #419: `search-params.test.ts` owns where a retired
 * category should land, and this owns that the page actually answers with a
 * redirect rather than rendering an empty grid.
 */
describe('SearchPage', () => {
  beforeEach(() => {
    permanentRedirect.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('permanently redirects a retired category onto the survivor', async () => {
    await expect(renderPage({ category: 'florals' })).rejects.toThrow(
      'REDIRECT:/search?category=decor',
    );

    expect(permanentRedirect).toHaveBeenCalledWith('/search?category=decor');
  });

  it('renders the search shell for a category that is still seeded', async () => {
    await renderPage({ category: 'decor' });

    expect(screen.getByTestId('search-shell')).toBeDefined();
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it('renders the search shell with no category at all', async () => {
    await renderPage({});

    expect(screen.getByTestId('search-shell')).toBeDefined();
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});
