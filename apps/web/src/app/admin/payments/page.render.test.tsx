import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getAdminPayments = vi.fn();

vi.mock('@/lib/admin-data', () => ({
  getAdminPayments,
  getAdminTaxYears: async () => ({ years: [], backupWithheld: false }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/payments',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: AdminPaymentsPage } = await import('./page');

afterEach(() => {
  cleanup();
  getAdminPayments.mockReset();
});

describe('the payments page search', () => {
  it('sends the term to the API and names it, and the flag, when nothing matches', async () => {
    getAdminPayments.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      widenings: [{ key: 'flag', count: 3 }],
    });

    render(
      await AdminPaymentsPage({
        searchParams: Promise.resolve({ q: ' pi_3Abc ', flag: 'payout-failing' }),
      }),
    );

    expect(getAdminPayments).toHaveBeenCalledWith('?flag=payout-failing&q=pi_3Abc&page=1');
    expect(screen.getByText(/^No payments match "pi_3Abc" and /)).toBeDefined();
    // Dropping the flag keeps the search.
    expect(screen.getByRole('link', { name: 'Every payment (3)' }).getAttribute('href')).toBe(
      '/admin/payments?q=pi_3Abc',
    );
  });

  it('says no payments yet, not filtered-empty, when nothing is searched', async () => {
    getAdminPayments.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      widenings: [],
    });

    render(await AdminPaymentsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText('No payments yet')).toBeDefined();
    expect(screen.queryByText(/filters? (is|are) narrowing/)).toBeNull();
  });
});
