import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireCurrentUser = vi.fn<(returnTo?: string) => Promise<unknown>>();
const apiRequest = vi.fn();
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@/components/account/close-account-form', () => ({
  CloseAccountForm: (props: { role: string; email: string; blockers: unknown[] }) => (
    <form
      data-testid="close-form"
      data-role={props.role}
      data-email={props.email}
      data-blockers={props.blockers.length}
    />
  ),
}));
vi.mock('@/lib/current-user', () => ({
  requireCurrentUser: (returnTo?: string) => requireCurrentUser(returnTo),
}));
vi.mock('@/lib/auth/server', () => ({ getServerSession: async () => ({ token: 'tok' }) }));
vi.mock('@/lib/api-client', () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }));
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

const { default: CloseAccountPage } = await import('./page');

describe('CloseAccountPage (VEN-680)', () => {
  afterEach(() => {
    cleanup();
    requireCurrentUser.mockReset();
    apiRequest.mockReset();
    notFound.mockClear();
  });

  it.each(['customer', 'vendor'] as const)(
    'hands a %s the blockers the API reads for them',
    async (role) => {
      requireCurrentUser.mockResolvedValue({ role, email: 'ada@example.com' });
      apiRequest.mockResolvedValue({ blockers: [{ bookingId: 'b' }] });

      render(await CloseAccountPage());

      expect(screen.getByRole('heading', { level: 1, name: 'Close account' })).toBeDefined();
      const form = screen.getByTestId('close-form');
      expect(form.getAttribute('data-role')).toBe(role);
      expect(form.getAttribute('data-email')).toBe('ada@example.com');
      expect(form.getAttribute('data-blockers')).toBe('1');
      expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
        '/users/me/close',
        expect.objectContaining({ token: 'tok' }),
      );
    },
  );

  it('is a 404 for an admin, and reads nothing from the API', async () => {
    requireCurrentUser.mockResolvedValue({ role: 'admin', email: 'root@example.com' });

    await expect(CloseAccountPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor to sign in and back to this page', async () => {
    requireCurrentUser.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(CloseAccountPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(requireCurrentUser).toHaveBeenCalledExactlyOnceWith('/account/settings/close');
  });
});
