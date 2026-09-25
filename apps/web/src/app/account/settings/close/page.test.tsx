import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireNonAdmin = vi.fn<(returnTo?: string) => Promise<unknown>>();
const apiRequest = vi.fn();

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
  requireNonAdmin: (returnTo?: string) => requireNonAdmin(returnTo),
}));
vi.mock('@/lib/auth/server', () => ({ getServerSession: async () => ({ token: 'tok' }) }));
vi.mock('@/lib/api-client', () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }));

const { default: CloseAccountPage } = await import('./page');

describe('CloseAccountPage (VEN-680)', () => {
  afterEach(() => {
    cleanup();
    requireNonAdmin.mockReset();
    apiRequest.mockReset();
  });

  it.each(['customer', 'vendor'] as const)(
    'hands a %s the blockers the API reads for them',
    async (role) => {
      requireNonAdmin.mockResolvedValue({ role, email: 'ada@example.com' });
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

  it('runs the non-admin gate for this path, so a stranger or an admin is sent on before any read', async () => {
    requireNonAdmin.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(CloseAccountPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(requireNonAdmin).toHaveBeenCalledExactlyOnceWith('/account/settings/close');
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
