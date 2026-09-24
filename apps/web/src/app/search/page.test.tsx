import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
 * The page only draws. `/search?category=florals` answers 308 from
 * `middleware.ts` (`middleware.test.ts`), because a page beneath the route's
 * loading boundary can no longer set a status (VEN-715).
 */
describe('SearchPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the search shell for a category that is still seeded', async () => {
    await renderPage({ category: 'decor' });

    expect(screen.getByTestId('search-shell')).toBeDefined();
  });

  it('renders the search shell with no category at all', async () => {
    await renderPage({});

    expect(screen.getByTestId('search-shell')).toBeDefined();
  });
});
