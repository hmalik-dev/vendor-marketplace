import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireCurrentUser = vi.fn<(returnTo?: string) => Promise<unknown>>();

vi.mock('@/components/account/change-password-form', () => ({
  ChangePasswordForm: ({ role }: { role: string }) => (
    <form data-testid="change-password-form" data-role={role} />
  ),
}));
vi.mock('@/lib/current-user', () => ({
  requireCurrentUser: (returnTo?: string) => requireCurrentUser(returnTo),
}));

const { default: ChangePasswordPage } = await import('./page');

describe('ChangePasswordPage (VEN-703)', () => {
  afterEach(() => {
    cleanup();
    requireCurrentUser.mockReset();
  });

  it('draws the form for whoever is signed in, with a way back to the list', async () => {
    requireCurrentUser.mockResolvedValue({ role: 'admin' });

    render(await ChangePasswordPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Change password' })).toBeDefined();
    expect(screen.getByTestId('change-password-form').getAttribute('data-role')).toBe('admin');
    expect(screen.getByRole('link', { name: /Account settings/ }).getAttribute('href')).toBe(
      '/account/settings',
    );
  });

  it('sends a signed-out visitor to sign in and back to this page', async () => {
    requireCurrentUser.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(ChangePasswordPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(requireCurrentUser).toHaveBeenCalledExactlyOnceWith('/account/settings/password');
  });
});
