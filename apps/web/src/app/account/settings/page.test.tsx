import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireCurrentUser = vi.fn<(returnTo?: string) => Promise<unknown>>();

vi.mock('@/components/account/change-password-form', () => ({
  ChangePasswordForm: () => <form data-testid="change-password-form" />,
}));
vi.mock('@/lib/current-user', () => ({
  requireCurrentUser: (returnTo?: string) => requireCurrentUser(returnTo),
}));

const { default: AccountSettingsPage } = await import('./page');

describe('AccountSettingsPage (VEN-677)', () => {
  afterEach(() => {
    cleanup();
    requireCurrentUser.mockReset();
  });

  it('opens on the password section, for whoever is signed in', async () => {
    requireCurrentUser.mockResolvedValue({ role: 'admin' });

    render(await AccountSettingsPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Account settings' })).toBeDefined();
    const sections = screen.getAllByRole('region');
    expect(sections.map((section) => section.getAttribute('aria-labelledby'))).toEqual([
      'password-heading',
    ]);
    expect(screen.getByRole('heading', { level: 2, name: 'Password' })).toBeDefined();
    expect(screen.getByTestId('change-password-form')).toBeDefined();
  });

  it('sends a signed-out visitor to sign in and back here, rendering nothing', async () => {
    requireCurrentUser.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(AccountSettingsPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(requireCurrentUser).toHaveBeenCalledExactlyOnceWith('/account/settings');
  });
});
