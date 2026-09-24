import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireCurrentUser = vi.fn<(returnTo?: string) => Promise<unknown>>();

vi.mock('@/lib/current-user', () => ({
  requireCurrentUser: (returnTo?: string) => requireCurrentUser(returnTo),
}));

const { default: AccountSettingsPage } = await import('./page');

const NO_QUERY = Promise.resolve({});

describe('AccountSettingsPage (VEN-703)', () => {
  afterEach(() => {
    cleanup();
    requireCurrentUser.mockReset();
  });

  it.each(['customer', 'vendor', 'admin'] as const)(
    'lists exactly the name, password and sessions rows for a %s, opening their own pages',
    async (role) => {
      requireCurrentUser.mockResolvedValue({ role, firstName: 'Ada', lastName: 'Lovelace' });

      render(await AccountSettingsPage({ searchParams: NO_QUERY }));

      expect(screen.getByRole('heading', { level: 1, name: 'Account settings' })).toBeDefined();
      const rows = screen.getAllByRole('link');
      expect(rows.map((row) => row.getAttribute('href'))).toEqual([
        '/account/settings/name',
        '/account/settings/password',
        '/account/settings/sessions',
      ]);
      expect(within(rows[0]!).getByText('Your name')).toBeDefined();
      expect(within(rows[0]!).getByText('Ada Lovelace')).toBeDefined();
      expect(within(rows[1]!).getByText('Password')).toBeDefined();
      expect(within(rows[2]!).getByText("Where you're signed in")).toBeDefined();
    },
  );

  it('shows the confirmation the name page sends the reader back with', async () => {
    requireCurrentUser.mockResolvedValue({ role: 'customer', firstName: 'Ada', lastName: 'B' });

    render(await AccountSettingsPage({ searchParams: Promise.resolve({ saved: 'name' }) }));

    expect(screen.getByRole('status').textContent).toContain('Your name is saved.');
  });

  it.each(['nonsense', '__proto__', 'constructor', 'toString'])(
    'ignores a saved value it has no copy for (%s)',
    async (saved) => {
      requireCurrentUser.mockResolvedValue({ role: 'customer', firstName: 'Ada', lastName: 'B' });

      render(await AccountSettingsPage({ searchParams: Promise.resolve({ saved }) }));

      expect(screen.queryByRole('status')).toBeNull();
    },
  );

  it('sends a signed-out visitor to sign in and back here, rendering nothing', async () => {
    requireCurrentUser.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(AccountSettingsPage({ searchParams: NO_QUERY })).rejects.toThrow('NEXT_REDIRECT');
    expect(requireCurrentUser).toHaveBeenCalledExactlyOnceWith('/account/settings');
  });
});
