import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminCustomerPage, WireAdminCustomerRow } from '@/lib/wire-schemas';

const getAdminCustomers = vi.fn<(query: string) => Promise<WireAdminCustomerPage>>();

vi.mock('@/lib/admin-data', () => ({
  getAdminCustomers: (query: string) => getAdminCustomers(query),
}));
// `FilterSelect` navigates on choice, and jsdom has no app router mounted.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const { default: AdminCustomersPage } = await import('./page');

const CLOSED_ID = '22222222-2222-4222-8222-222222222222';

function customer(overrides: Partial<WireAdminCustomerRow> = {}): WireAdminCustomerRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    city: 'Austin',
    state: 'TX',
    totalBookingsCount: 2,
    isBanned: false,
    isClosed: false,
    pendingEmail: null,
    createdAt: new Date('2026-01-05T00:00:00Z'),
    ...overrides,
  };
}

function page(
  items: WireAdminCustomerRow[],
  widenings: WireAdminCustomerPage['widenings'] = [],
): WireAdminCustomerPage {
  return { items, total: items.length, page: 1, pageSize: 15, widenings };
}

async function renderPage(params: Record<string, string> = {}) {
  return render(await AdminCustomersPage({ searchParams: Promise.resolve(params) }));
}

/** `/admin/customers` and its closed-account filter (VEN-382). */
describe('AdminCustomersPage', () => {
  beforeEach(() => {
    getAdminCustomers.mockReset();
  });

  afterEach(cleanup);

  it('asks for live accounts by default, and for closed ones only when told', async () => {
    getAdminCustomers.mockResolvedValue(page([customer()]));

    await renderPage();
    expect(getAdminCustomers).toHaveBeenLastCalledWith('?page=1');

    cleanup();
    await renderPage({ status: 'live' });
    expect(getAdminCustomers).toHaveBeenLastCalledWith('?page=1');

    cleanup();
    await renderPage({ status: 'closed' });
    expect(getAdminCustomers).toHaveBeenLastCalledWith('?status=closed&page=1');
  });

  it('drops a status this list does not have rather than passing it upstream', async () => {
    getAdminCustomers.mockResolvedValue(page([customer()]));

    await renderPage({ status: 'retired' });

    expect(getAdminCustomers).toHaveBeenLastCalledWith('?page=1');
  });

  it('marks only the closed row with an inert Closed pill, and keeps its name linked', async () => {
    const closed = customer({
      id: CLOSED_ID,
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      isClosed: true,
      isBanned: true,
    });
    getAdminCustomers.mockResolvedValue(page([customer(), closed]));

    await renderPage({ status: 'closed' });

    // `DataTable` mounts one branch per viewport (VEN-395), so each row once.
    const pills = [...document.querySelectorAll('[data-slot="status-pill"]')];
    expect(pills.map((pill) => [pill.textContent, pill.getAttribute('data-tone')])).toEqual([
      ['Closed', 'inert'],
    ]);
    expect(screen.getAllByText('Joined Jan 5, 2026')).toHaveLength(1);
    expect(
      screen
        .getAllByRole('link', { name: 'Grace Hopper' })
        .map((link) => link.getAttribute('href')),
    ).toEqual([`/admin/users/${CLOSED_ID}`]);
  });

  it('shows the chosen set on the Status trigger and carries it through the search form', async () => {
    getAdminCustomers.mockResolvedValue(page([customer({ isClosed: true })]));

    const { container } = await renderPage({ status: 'closed' });

    // The chosen option replaces the trigger's label, the way every admin filter reads.
    expect(screen.getByRole('button', { name: 'Closed' }).getAttribute('aria-haspopup')).toBe(
      'listbox',
    );
    expect(screen.queryByRole('button', { name: 'Status' })).toBeNull();
    // Exactly one: the bar writes it from `params`, and a second field under the
    // same name would submit `?status=closed&status=closed` (VEN-395).
    expect(
      [...container.querySelectorAll('input[type="hidden"][name="status"]')].map((input) =>
        input.getAttribute('value'),
      ),
    ).toEqual(['closed']);
  });

  it('reads as an unapplied Status filter by default, with no hidden status field', async () => {
    getAdminCustomers.mockResolvedValue(page([customer()]));

    const { container } = await renderPage({ status: 'live' });

    expect(screen.getByRole('button', { name: 'Status' }).getAttribute('aria-haspopup')).toBe(
      'listbox',
    );
    expect(container.querySelector('input[type="hidden"][name="status"]')).toBeNull();
  });

  it('routes an empty live-view search into the closed set it is hiding', async () => {
    getAdminCustomers.mockResolvedValue(page([], [{ key: 'status', count: 1 }]));

    await renderPage({ q: 'hopper' });

    expect(screen.getByText('No customers match "hopper"')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Closed accounts (1)' }).getAttribute('href')).toBe(
      '/admin/customers?q=hopper&status=closed',
    );
  });

  it('routes an empty closed-view search back to live accounts', async () => {
    getAdminCustomers.mockResolvedValue(page([], [{ key: 'status', count: 3 }]));

    await renderPage({ status: 'closed', q: 'kessler' });

    expect(screen.getByText('No closed customers match "kessler"')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Live accounts (3)' }).getAttribute('href')).toBe(
      '/admin/customers?q=kessler',
    );
  });

  it('draws the true empty state when nothing was asked', async () => {
    getAdminCustomers.mockResolvedValue(page([]));

    await renderPage();

    expect(screen.getByText('No customers yet')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Closed accounts/ })).toBeNull();
  });
});
