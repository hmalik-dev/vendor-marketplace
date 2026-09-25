import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireCurrentUser = vi.fn<(returnTo?: string) => Promise<unknown>>();

vi.mock('@/components/account/sessions-list', () => ({
  SessionsList: () => <div data-testid="sessions-list" />,
}));
vi.mock('@/lib/current-user', () => ({
  requireCurrentUser: (returnTo?: string) => requireCurrentUser(returnTo),
}));

const { default: SessionsPage } = await import('./page');

describe('SessionsPage (VEN-681)', () => {
  afterEach(() => {
    cleanup();
    requireCurrentUser.mockReset();
  });

  it.each(['customer', 'vendor', 'admin'] as const)(
    'draws the devices list for a %s, with a way back to the list',
    async (role) => {
      requireCurrentUser.mockResolvedValue({ role });

      render(await SessionsPage());

      expect(
        screen.getByRole('heading', { level: 1, name: "Where you're signed in" }),
      ).toBeDefined();
      expect(screen.getByTestId('sessions-list')).toBeDefined();
      expect(screen.getByRole('link', { name: /Account settings/ }).getAttribute('href')).toBe(
        '/account/settings',
      );
    },
  );

  it('sends a signed-out visitor to sign in and back to this page', async () => {
    requireCurrentUser.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(SessionsPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(requireCurrentUser).toHaveBeenCalledExactlyOnceWith('/account/settings/sessions');
  });
});
