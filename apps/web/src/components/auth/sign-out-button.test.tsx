import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const signOut = vi.fn<() => Promise<void>>();
const assign = vi.fn();

vi.mock('@/lib/auth/auth-requests', () => ({ signOut: () => signOut() }));

const { SignOutButton } = await import('./sign-out-button');

describe('SignOutButton', () => {
  afterEach(() => {
    cleanup();
    signOut.mockReset();
    assign.mockReset();
    vi.unstubAllGlobals();
  });

  it('ends the session through the proxy, then navigates to the redirect', async () => {
    signOut.mockResolvedValue(undefined);
    vi.stubGlobal('location', { assign });

    render(
      <SignOutButton redirectUrl="/goodbye">
        <button type="button">Sign out</button>
      </SignOutButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/goodbye'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('lands on the home page by default, and still leaves when the call fails', async () => {
    signOut.mockRejectedValue(new Error('offline'));
    vi.stubGlobal('location', { assign });

    render(
      <SignOutButton>
        <button type="button">Sign out</button>
      </SignOutButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
  });
});
