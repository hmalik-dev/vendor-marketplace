import type { UserRole } from '@vendor-marketplace/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/auth-requests', () => ({ signOut: vi.fn() }));

const readSuspendedRole = vi.fn<() => Promise<UserRole | null>>();
vi.mock('@/lib/current-user', () => ({ readSuspendedRole: () => readSuspendedRole() }));

const { default: SuspendedPage } = await import('./page');

const REFUND = 'Confirmed bookings were refunded to customers in full.';

async function renderAs(role: UserRole | null): Promise<void> {
  readSuspendedRole.mockResolvedValue(role);
  render(await SuspendedPage());
}

afterEach(() => {
  cleanup();
  readSuspendedRole.mockReset();
});

/* VEN-763, frame 53: the dead end still has two ways out. */
describe('/suspended', () => {
  it('offers Contact support to /support and a Sign out beside it', async () => {
    await renderAs('customer');

    const body = screen.getByTestId('suspended-actions');
    expect(within(body).getByRole('link', { name: 'Contact support' }).getAttribute('href')).toBe(
      '/support',
    );
    expect(within(body).getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Back to home' })).toBeNull();
  });

  it('draws a header of the mark and Sign out only', async () => {
    await renderAs('vendor');

    const header = screen.getByRole('banner');
    expect(within(header).queryAllByRole('link')).toHaveLength(0);
    expect(
      within(header)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Sign out']);
  });

  it('hides the site header and footer', async () => {
    await renderAs('vendor');

    expect(document.querySelector('[data-auth-screen]')).not.toBeNull();
  });

  it('tells a suspended vendor its confirmed bookings were refunded', async () => {
    await renderAs('vendor');

    expect(screen.getByText(REFUND, { exact: false })).not.toBeNull();
  });

  it.each([['customer'], ['admin'], [null]] as const)('claims no refund to a %s', async (role) => {
    await renderAs(role);

    expect(screen.queryByText(/refunded/)).toBeNull();
    expect(
      screen.getByText('You can’t book, message or take bookings while it’s suspended.'),
    ).not.toBeNull();
  });
});
