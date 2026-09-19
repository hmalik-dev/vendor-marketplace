import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redirectIfSignedIn = vi.fn<() => Promise<void>>();

vi.mock('@/components/auth/sign-in-form', () => ({
  SignInForm: (props: { destination: string }) => (
    <div data-testid="sign-in-form" data-destination={props.destination} />
  ),
}));
vi.mock('@/lib/current-user', () => ({ redirectIfSignedIn: () => redirectIfSignedIn() }));

const { default: SignInPage } = await import('./page');

describe('SignInPage', () => {
  afterEach(() => {
    cleanup();
    redirectIfSignedIn.mockReset();
  });

  it('renders the form for a signed-out visitor', async () => {
    redirectIfSignedIn.mockResolvedValue(undefined);

    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId('sign-in-form')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeDefined();
  });

  it('carries a validated returnTo through /after-sign-in', async () => {
    redirectIfSignedIn.mockResolvedValue(undefined);

    render(await SignInPage({ searchParams: Promise.resolve({ returnTo: '/bookings/abc' }) }));

    expect(screen.getByTestId('sign-in-form').getAttribute('data-destination')).toBe(
      '/after-sign-in?returnTo=%2Fbookings%2Fabc',
    );
  });

  it('drops a returnTo that leaves the origin', async () => {
    redirectIfSignedIn.mockResolvedValue(undefined);

    render(
      await SignInPage({ searchParams: Promise.resolve({ returnTo: 'https://evil.example' }) }),
    );

    expect(screen.getByTestId('sign-in-form').getAttribute('data-destination')).toBe(
      '/after-sign-in',
    );
  });

  it('never renders the form when the signed-in guard redirects', async () => {
    redirectIfSignedIn.mockRejectedValue(new Error('NEXT_REDIRECT:/after-sign-in'));

    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT:/after-sign-in',
    );
  });
});
