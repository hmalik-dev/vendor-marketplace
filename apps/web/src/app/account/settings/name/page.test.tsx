import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireCurrentUser = vi.fn<(returnTo?: string) => Promise<unknown>>();

vi.mock('@/components/account/change-name-form', () => ({
  ChangeNameForm: ({ firstName, lastName }: { firstName: string; lastName: string }) => (
    <form data-testid="change-name-form" data-name={`${firstName} ${lastName}`} />
  ),
}));
vi.mock('@/lib/current-user', () => ({
  requireCurrentUser: (returnTo?: string) => requireCurrentUser(returnTo),
}));

const { default: ChangeNamePage } = await import('./page');

describe('ChangeNamePage (VEN-703)', () => {
  afterEach(() => {
    cleanup();
    requireCurrentUser.mockReset();
  });

  it('draws the form on the name on file, with a way back to the list', async () => {
    requireCurrentUser.mockResolvedValue({
      role: 'vendor',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    render(await ChangeNamePage());

    expect(screen.getByRole('heading', { level: 1, name: 'Your name' })).toBeDefined();
    expect(screen.getByTestId('change-name-form').getAttribute('data-name')).toBe('Ada Lovelace');
    expect(screen.getByRole('link', { name: /Account settings/ }).getAttribute('href')).toBe(
      '/account/settings',
    );
  });

  it('sends a signed-out visitor to sign in and back to this page', async () => {
    requireCurrentUser.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(ChangeNamePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(requireCurrentUser).toHaveBeenCalledExactlyOnceWith('/account/settings/name');
  });
});
