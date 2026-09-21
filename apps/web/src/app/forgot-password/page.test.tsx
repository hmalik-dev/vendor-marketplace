import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redirectIfSignedIn = vi.fn<() => Promise<void>>();

vi.mock('@/components/auth/forgot-password-form', () => ({
  ForgotPasswordForm: () => <div data-testid="forgot-form" />,
}));
vi.mock('@/lib/current-user', () => ({ redirectIfSignedIn: () => redirectIfSignedIn() }));

const { default: ForgotPasswordPage } = await import('./page');

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    cleanup();
    redirectIfSignedIn.mockReset();
  });

  it('renders the request form for a signed-out visitor', async () => {
    redirectIfSignedIn.mockResolvedValue(undefined);

    render(await ForgotPasswordPage());

    expect(screen.getByTestId('forgot-form')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Forgot your password?' })).toBeDefined();
  });

  it('never renders the form when the signed-in guard redirects', async () => {
    redirectIfSignedIn.mockRejectedValue(new Error('NEXT_REDIRECT:/after-sign-in'));

    await expect(ForgotPasswordPage()).rejects.toThrow('NEXT_REDIRECT:/after-sign-in');
  });
});
