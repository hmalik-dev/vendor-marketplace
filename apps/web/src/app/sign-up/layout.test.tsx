import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redirectIfSignedIn = vi.fn<() => Promise<void>>();

vi.mock('@/lib/current-user', () => ({ redirectIfSignedIn: () => redirectIfSignedIn() }));

const { default: SignUpLayout } = await import('./layout');

describe('SignUpLayout', () => {
  afterEach(() => {
    cleanup();
    redirectIfSignedIn.mockReset();
  });

  it('renders the sign-up page for a signed-out visitor', async () => {
    redirectIfSignedIn.mockResolvedValue(undefined);

    render(await SignUpLayout({ children: <p>Create your account</p> }));

    expect(screen.getByText('Create your account')).toBeDefined();
  });

  it('never renders its children when the signed-in guard redirects', async () => {
    redirectIfSignedIn.mockRejectedValue(new Error('NEXT_REDIRECT:/after-sign-in'));

    await expect(SignUpLayout({ children: <p>Create your account</p> })).rejects.toThrow(
      'NEXT_REDIRECT:/after-sign-in',
    );
  });
});
