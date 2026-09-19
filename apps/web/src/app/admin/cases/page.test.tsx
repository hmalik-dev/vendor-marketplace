import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminCasePage } from '@/lib/wire-schemas';

const getAdminCases = vi.fn<(query: string) => Promise<WireAdminCasePage>>();

vi.mock('@/lib/admin-data', () => ({
  getAdminCases: (query: string) => getAdminCases(query),
}));
// `FilterSelect` navigates on choice, and jsdom has no app router mounted.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const { default: AdminCasesPage } = await import('./page');

function emptyPage(overrides: Partial<WireAdminCasePage>): WireAdminCasePage {
  return { items: [], total: 0, page: 1, pageSize: 15, widenings: [], ...overrides };
}

async function renderPage(params: Record<string, string> = {}) {
  return render(await AdminCasesPage({ searchParams: Promise.resolve(params) }));
}

/** `/admin/cases` and what it says when a page has no rows (VEN-429). */
describe('AdminCasesPage empty states', () => {
  beforeEach(() => {
    getAdminCases.mockReset();
  });

  afterEach(cleanup);

  it('says nothing is disputed only when the queue really is empty', async () => {
    getAdminCases.mockResolvedValue(emptyPage({}));

    await renderPage();

    expect(screen.getByText('Nothing is disputed')).toBeTruthy();
  });

  it('does not claim nothing is disputed on a page past the end of a queue with cases', async () => {
    getAdminCases.mockImplementation(async (query) =>
      query.includes('pageSize=1') ? emptyPage({ total: 0 }) : emptyPage({ total: 1, page: 3 }),
    );

    await renderPage({ page: '3' });

    expect(screen.queryByText('Nothing is disputed')).toBeNull();
    expect(screen.getByText('There are no cases on this page')).toBeTruthy();
    expect(screen.getByText('The queue has 1 case, all on earlier pages.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the first page' }).getAttribute('href')).toBe(
      '/admin/cases',
    );
  });
});
