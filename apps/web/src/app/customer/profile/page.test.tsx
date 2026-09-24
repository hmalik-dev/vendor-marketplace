import type { ReactNode } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();

vi.mock('@/lib/current-user', () => ({
  requireRole: (role: string) => requireRole(role),
}));
vi.mock('@/lib/customer-data', () => ({
  getOwnCustomerReviews: async () => [],
}));
vi.mock('@/components/customer/customer-profile-form', () => ({
  CustomerProfileForm: (): ReactNode => <form aria-label="Profile form" />,
}));
vi.mock('@/components/customer/customer-history', () => ({
  CustomerReviews: (): ReactNode => <ul aria-label="Reviews list" />,
}));

const { default: CustomerProfilePage } = await import('./page.js');

function customer(firstName: string, lastName: string): Record<string, unknown> {
  return {
    id: 'user-1',
    role: 'customer',
    firstName,
    lastName,
    email: 'pat@example.com',
    avatarUrl: null,
    budgetTier: null,
    totalBookingsCount: 0,
    completedBookingsCount: 0,
    cancelledBookingsCount: 0,
  };
}

async function monogram(): Promise<string | null | undefined> {
  const page = await CustomerProfilePage({ searchParams: Promise.resolve({}) });
  return render(page).container.querySelector('[data-slot="avatar-fallback"]')?.textContent;
}

/*
 * VEN-678: the avatar drew `firstName || 'You'` — one initial, and the
 * email-prefix placeholder's letter before the name step. It follows the
 * header's rule now: both initials from a full name, otherwise no letter.
 */
describe('CustomerProfilePage avatar', () => {
  beforeEach(() => {
    requireRole.mockReset();
  });

  afterEach(cleanup);

  it('draws both initials of the full name', async () => {
    requireRole.mockResolvedValue(customer('Pat', 'Okafor'));

    await expect(monogram()).resolves.toBe('PO');
  });

  it('draws no letter for the placeholder first name alone', async () => {
    requireRole.mockResolvedValue(customer('pat', ''));

    await expect(monogram()).resolves.toBe('');
  });
});

/*
 * VEN-706. `Active` and `Past` repeated `/bookings`, and the `Your account`
 * sidebar duplicated the header, so the page is the record and the reviews.
 */
describe('CustomerProfilePage chrome and tabs', () => {
  beforeEach(() => {
    requireRole.mockReset().mockResolvedValue(customer('Pat', 'Okafor'));
  });

  afterEach(cleanup);

  it('renders no navigation labelled Your account', async () => {
    render(await CustomerProfilePage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole('navigation', { name: 'Your account' })).toBeNull();
  });

  it('offers only Profile and Reviews about you', async () => {
    render(await CustomerProfilePage({ searchParams: Promise.resolve({}) }));

    const tabs = screen.getByRole('navigation', { name: 'Profile sections' });

    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Profile', 'Reviews about you']);
  });

  it.each(['active', 'past'])('draws the Profile tab for ?tab=%s', async (tab) => {
    render(await CustomerProfilePage({ searchParams: Promise.resolve({ tab }) }));

    expect(screen.getByRole('form', { name: 'Profile form' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('aria-current')).toBe('page');
  });
});
