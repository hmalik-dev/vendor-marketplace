import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';

const call = vi.fn();
const assign = vi.fn();
const signOut = vi.fn<() => Promise<void>>();
const clearSessionToken = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => call }));
vi.mock('@/lib/auth/auth-requests', () => ({ signOut: () => signOut() }));
vi.mock('@/lib/auth/client', () => ({ clearSessionToken: () => clearSessionToken() }));
const reportSwallowedError = vi.fn();
vi.mock('@/lib/report-error', () => ({
  reportSwallowedError: (context: string, error: unknown) => reportSwallowedError(context, error),
}));

const { CloseAccountForm } = await import('./close-account-form');

const EMAIL = 'ada@example.com';
const BLOCKER = {
  bookingId: '5f0f6f3e-3b1e-4f57-9d55-0a0f6a1f0b11',
  eventDate: '2099-06-01',
  counterpartyName: 'Sunlit Studio',
};

beforeEach(() => {
  assign.mockReset();
  signOut.mockReset().mockResolvedValue(undefined);
  clearSessionToken.mockReset();
  call.mockReset().mockResolvedValue({});
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function reachTheConfirmation(role: 'customer' | 'vendor' = 'customer') {
  const user = userEvent.setup();
  render(<CloseAccountForm role={role} email={EMAIL} blockers={[]} />);
  await user.click(screen.getByRole('button', { name: 'Email me a code' }));
  return user;
}

describe('CloseAccountForm (VEN-680)', () => {
  it('names the bookings that refuse the closure and offers no way to proceed', () => {
    const { container } = render(
      <CloseAccountForm role="customer" email={EMAIL} blockers={[BLOCKER]} />,
    );

    // A list inside the banner's paragraph is invalid HTML and a hydration error in the browser.
    expect(container.querySelector('p p, p ul')).toBeNull();
    expect(screen.getByText('Cancel your upcoming booking first')).toBeDefined();
    expect(screen.getByText(/with Sunlit Studio/).textContent).toContain('2099');
    expect(screen.getByRole('link', { name: 'your bookings' }).getAttribute('href')).toBe(
      '/bookings',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('centres its capped column under the centred heading (VEN-698)', () => {
    const { container } = render(<CloseAccountForm role="customer" email={EMAIL} blockers={[]} />);

    const classes = (container.firstElementChild?.className ?? '').split(' ');

    expect(classes).toContain('mx-auto');
    expect(classes).toContain('max-w-sm');
  });

  it('says what is kept and what goes, and adds the storefront and refunds for a vendor', () => {
    const { unmount } = render(<CloseAccountForm role="customer" email={EMAIL} blockers={[]} />);
    expect(screen.getByText(/Payment and booking records stay/)).toBeDefined();
    expect(screen.queryByText(/storefront/)).toBeNull();
    unmount();

    render(<CloseAccountForm role="vendor" email={EMAIL} blockers={[]} />);
    expect(screen.getByText(/storefront comes off the marketplace/)).toBeDefined();
    expect(screen.getByText(/refunded in full/)).toBeDefined();
  });

  it('asks for the code first, and shows the address it went to', async () => {
    await reachTheConfirmation();

    expect(call).toHaveBeenCalledExactlyOnceWith(
      '/users/me/close/challenge',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.getByRole('status').textContent).toContain(EMAIL);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Close my account' }).disabled,
    ).toBe(true);
  });

  it('does not offer the confirmation when the code could not be sent', async () => {
    call.mockRejectedValue(new ApiClientError(503, 'INTERNAL_ERROR', 'Try later'));
    const user = userEvent.setup();
    render(<CloseAccountForm role="customer" email={EMAIL} blockers={[]} />);

    await user.click(screen.getByRole('button', { name: 'Email me a code' }));

    expect(screen.getByRole('alert').textContent).toContain('We could not send the code.');
    expect(screen.queryByLabelText('Code from the email')).toBeNull();
  });

  it('will not submit until the address is typed and all six digits are in', async () => {
    const user = await reachTheConfirmation();
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Close my account' });

    await user.type(screen.getByLabelText('Type your email address to confirm'), EMAIL);
    await user.type(screen.getByLabelText('Code from the email'), '12345');
    expect(button.disabled).toBe(true);

    await user.type(screen.getByLabelText('Code from the email'), '6');
    expect(button.disabled).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('closes with the address and code, then ends the browser session and says goodbye', async () => {
    const user = await reachTheConfirmation();
    await user.type(screen.getByLabelText('Type your email address to confirm'), ` ${EMAIL} `);
    await user.type(screen.getByLabelText('Code from the email'), '123456');
    await user.click(screen.getByRole('button', { name: 'Close my account' }));

    expect(call).toHaveBeenLastCalledWith(
      '/users/me/close',
      expect.objectContaining({ method: 'POST', body: { email: EMAIL, code: '123456' } }),
    );
    expect(signOut).toHaveBeenCalledOnce();
    expect(clearSessionToken).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledExactlyOnceWith('/account/closed');
  });

  it('still leaves for the farewell when the provider cannot be told to sign out', async () => {
    const failure = new Error('Could not sign out');
    signOut.mockRejectedValue(failure);
    const user = await reachTheConfirmation();
    await user.type(screen.getByLabelText('Type your email address to confirm'), EMAIL);
    await user.type(screen.getByLabelText('Code from the email'), '123456');
    await user.click(screen.getByRole('button', { name: 'Close my account' }));

    expect(reportSwallowedError).toHaveBeenCalledExactlyOnceWith(
      'account closure: signing the browser out failed',
      failure,
    );
    expect(clearSessionToken).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledExactlyOnceWith('/account/closed');
  });

  it('offers a new code after the first one, asking the API for another', async () => {
    const user = await reachTheConfirmation();

    await user.click(screen.getByRole('button', { name: 'Send a new code' }));

    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenLastCalledWith(
      '/users/me/close/challenge',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('closes nothing and stays put when the API refuses the address or the code', async () => {
    const user = await reachTheConfirmation();
    call.mockRejectedValue(
      new ApiClientError(
        403,
        'STEP_UP_REQUIRED',
        'That code is wrong or has expired. Request a new one.',
      ),
    );
    await user.type(screen.getByLabelText('Type your email address to confirm'), EMAIL);
    await user.type(screen.getByLabelText('Code from the email'), '000000');
    await user.click(screen.getByRole('button', { name: 'Close my account' }));

    expect(screen.getByRole('alert').textContent).toContain('That code is wrong or has expired');
    expect(signOut).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
