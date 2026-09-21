import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redirectIfSignedIn = vi.fn<() => Promise<void>>();

vi.mock('@/components/auth/reset-password-form', () => ({
  ResetPasswordForm: (props: { initialEmail: string }) => (
    <div data-testid="reset-form" data-email={props.initialEmail} />
  ),
}));
vi.mock('@/lib/current-user', () => ({ redirectIfSignedIn: () => redirectIfSignedIn() }));

const { default: ResetPasswordPage } = await import('./page');

describe('ResetPasswordPage', () => {
  afterEach(() => {
    cleanup();
    redirectIfSignedIn.mockReset();
  });

  it('hands the address from the request screen to the form', async () => {
    redirectIfSignedIn.mockResolvedValue(undefined);

    render(
      await ResetPasswordPage({ searchParams: Promise.resolve({ email: 'sam@example.com' }) }),
    );

    expect(screen.getByTestId('reset-form').getAttribute('data-email')).toBe('sam@example.com');
    expect(screen.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeDefined();
  });

  it('starts empty when no address is given', async () => {
    redirectIfSignedIn.mockResolvedValue(undefined);

    render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId('reset-form').getAttribute('data-email')).toBe('');
  });

  it('never renders the form when the signed-in guard redirects', async () => {
    redirectIfSignedIn.mockRejectedValue(new Error('NEXT_REDIRECT:/after-sign-in'));

    await expect(ResetPasswordPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT:/after-sign-in',
    );
  });
});
