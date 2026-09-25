import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getAdminActivity = vi.fn();
const getAdminActivityActors = vi.fn();

vi.mock('@/lib/admin-data', () => ({ getAdminActivity, getAdminActivityActors }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/activity',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: AdminActivityPage } = await import('./page');

const EMPTY = { items: [], total: 0, page: 1, pageSize: 15 };

afterEach(() => {
  cleanup();
  getAdminActivity.mockReset();
  getAdminActivityActors.mockReset();
});

/** The search box (VEN-749). */
describe('the activity page search', () => {
  it('sends the term to the API and to the CSV export', async () => {
    getAdminActivity.mockResolvedValue({ ...EMPTY, widenings: [] });
    getAdminActivityActors.mockResolvedValue({ actors: [] });

    render(
      await AdminActivityPage({ searchParams: Promise.resolve({ q: 'okonkwo', range: '7d' }) }),
    );

    expect(getAdminActivity).toHaveBeenCalledWith('?range=7d&q=okonkwo&page=1');
    expect(screen.getByRole('link', { name: /Export CSV/ }).getAttribute('href')).toBe(
      '/admin/activity/export?range=7d&q=okonkwo',
    );
    expect(screen.getByRole('searchbox', { name: 'Search' }).getAttribute('value')).toBe('okonkwo');
  });

  it('names the search when it leaves nothing, and offers to clear it', async () => {
    getAdminActivity.mockResolvedValue({ ...EMPTY, widenings: [{ key: 'q', count: 9 }] });
    getAdminActivityActors.mockResolvedValue({ actors: [] });

    render(
      await AdminActivityPage({
        searchParams: Promise.resolve({ q: 'okonkwo', action: 'user_banned' }),
      }),
    );

    expect(
      screen.getByText('No console activity matches "okonkwo" and these filters'),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Clear the search (9)' }).getAttribute('href')).toBe(
      '/admin/activity?action=user_banned',
    );
  });

  it('does not report a blank search as an ignored filter', async () => {
    getAdminActivity.mockResolvedValue({ ...EMPTY, widenings: [] });
    getAdminActivityActors.mockResolvedValue({ actors: [] });

    render(await AdminActivityPage({ searchParams: Promise.resolve({ q: '   ' }) }));

    expect(getAdminActivity).toHaveBeenCalledWith('?page=1');
    expect(screen.queryByText(/Ignored/)).toBeNull();
    expect(screen.getByText('No console activity yet')).toBeDefined();
  });
});
