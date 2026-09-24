import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_COPY } from '@/app/auth-copy';

const signOut = vi.fn<() => Promise<void>>();
const assign = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/auth/auth-requests', () => ({ signOut: () => signOut() }));
vi.mock('sonner', () => ({ toast: { error: (message: string) => toastError(message) } }));

const { SignOutButton } = await import('./sign-out-button');
const { resetSessionEndedForTests } = await import('@/lib/auth/session-ended');

describe('SignOutButton', () => {
  afterEach(() => {
    cleanup();
    resetSessionEndedForTests();
    signOut.mockReset();
    assign.mockReset();
    toastError.mockReset();
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

  it('lands on the home page by default', async () => {
    signOut.mockResolvedValue(undefined);
    vi.stubGlobal('location', { assign });

    render(
      <SignOutButton>
        <button type="button">Sign out</button>
      </SignOutButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
  });

  it('stays on the page and shows the unreachable copy when the call fails', async () => {
    signOut.mockRejectedValue(new Error('offline'));
    vi.stubGlobal('location', { assign });

    render(
      <SignOutButton redirectUrl="/goodbye">
        <button type="button">Sign out</button>
      </SignOutButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(AUTH_COPY.unreachable));
    expect(assign).not.toHaveBeenCalled();
  });
});
