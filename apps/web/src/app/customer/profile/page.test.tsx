import type { ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();

vi.mock('@/lib/current-user', () => ({
  requireRole: (role: string) => requireRole(role),
}));
vi.mock('@/lib/customer-data', () => ({
  getOwnBookingRequests: async () => [],
  getOwnBookings: async () => [],
  getOwnCustomerReviews: async () => [],
}));
vi.mock('@/lib/messaging-data', () => ({
  getOwnConversationBand: async () => ({ conversations: [], hasUnread: false }),
}));
vi.mock('@/components/bookings/bookings-sidebar', () => ({
  BookingsSidebar: (): ReactNode => null,
}));
vi.mock('@/components/customer/customer-profile-form', () => ({
  CustomerProfileForm: (): ReactNode => null,
}));
vi.mock('@/components/customer/customer-history', () => ({
  CustomerHistory: (): ReactNode => null,
  CustomerReviews: (): ReactNode => null,
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
