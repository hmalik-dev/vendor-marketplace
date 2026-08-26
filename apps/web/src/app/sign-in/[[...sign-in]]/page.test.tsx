import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redirectIfSignedIn = vi.fn<() => Promise<void>>();

vi.mock('@clerk/nextjs', () => ({
  SignIn: (props: Record<string, unknown>) => <div data-testid="clerk-sign-in" {...props} />,
}));
vi.mock('@/lib/current-user', () => ({ redirectIfSignedIn: () => redirectIfSignedIn() }));

const { default: SignInPage } = await import('./page');

describe('SignInPage', () => {
  afterEach(() => {
    cleanup();
    redirectIfSignedIn.mockReset();
  });

  it('renders the Clerk form for a signed-out visitor', async () => {
    redirectIfSignedIn.mockResolvedValue(undefined);

    render(await SignInPage());

    expect(screen.getByTestId('clerk-sign-in')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeDefined();
  });

  it('never renders the form when the signed-in guard redirects', async () => {
    redirectIfSignedIn.mockRejectedValue(new Error('NEXT_REDIRECT:/after-sign-in'));

    await expect(SignInPage()).rejects.toThrow('NEXT_REDIRECT:/after-sign-in');
  });
});
