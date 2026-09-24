import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
/* A full-load replace reports into `replace` too, so every navigation assertion reads one mock. */
const hardReplace = vi.fn((url: string) => replace(url));
const requestMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
const signOut = vi.fn<() => Promise<void>>();
vi.mock('@/lib/auth/auth-requests', () => ({ signOut: () => signOut() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const { CustomerDetailsForm } = await import('./customer-details-form');

describe('CustomerDetailsForm', () => {
  beforeEach(() => {
    replace.mockReset();
    hardReplace.mockClear();
    vi.stubGlobal('location', { ...window.location, replace: hardReplace });
    requestMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /* Not the last step for everyone, so the screen claims no position in the flow. */
  it('asks for the name under its heading alone, with no step eyebrow', () => {
    render(<CustomerDetailsForm returnTo={null} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('What should we call you?');
    expect(screen.queryByText(/last step/i)).toBeNull();
  });

  /* VEN-701: a mandatory step is not a trap, so it carries its own way out. */
  it('signs the customer out and lands them on the home page', async () => {
    signOut.mockResolvedValue(undefined);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo="/bookings" />);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/');
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('refuses an empty submission client-side, without calling the API', async () => {
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo={null} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Enter your first and last name.')).toBeDefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('writes the name via PUT /users/me and continues through /after-sign-in', async () => {
    requestMock.mockResolvedValue({
      id: 'u1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'customer',
    });
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo={null} />);

    await user.type(screen.getByLabelText('First name'), 'Ada');
    await user.type(screen.getByLabelText('Last name'), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(requestMock).toHaveBeenCalledWith(
      '/users/me',
      expect.objectContaining({
        method: 'PUT',
        body: { firstName: 'Ada', lastName: 'Lovelace' },
      }),
    );
    expect(replace).toHaveBeenCalledWith('/after-sign-in');
    // A full load, so the header re-reads the record and draws the new initials.
    expect(hardReplace).toHaveBeenCalledWith('/after-sign-in');
  });

  it('carries a validated returnTo through to /after-sign-in', async () => {
    requestMock.mockResolvedValue({
      id: 'u1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'customer',
    });
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo="/vendors/june-harlow/request" />);

    await user.type(screen.getByLabelText('First name'), 'Ada');
    await user.type(screen.getByLabelText('Last name'), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(replace).toHaveBeenCalledWith(
      '/after-sign-in?returnTo=%2Fvendors%2Fjune-harlow%2Frequest',
    );
  });

  it('shows the API refusal and stays on the step when the save fails', async () => {
    requestMock.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo={null} />);

    await user.type(screen.getByLabelText('First name'), 'Ada');
    await user.type(screen.getByLabelText('Last name'), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText("That didn't save — try again.")).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });
});
