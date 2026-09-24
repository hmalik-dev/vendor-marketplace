import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const refresh = vi.fn();
const signInWithEmail = vi.fn();
const verifyEmailCode = vi.fn();
const resendVerificationCode = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock('@/lib/auth/auth-requests', () => ({
  signInWithEmail: (input: unknown) => signInWithEmail(input),
  verifyEmailCode: (input: unknown) => verifyEmailCode(input),
  resendVerificationCode: (email: unknown) => resendVerificationCode(email),
}));

const { SignInForm } = await import('./sign-in-form');

async function submit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText('Email'), 'sam@example.com');
  await user.type(screen.getByLabelText('Password'), 'hunter2-hunter2');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('SignInForm', () => {
  beforeEach(() => {
    signInWithEmail.mockReset().mockResolvedValue('ok');
    verifyEmailCode.mockReset().mockResolvedValue('ok');
    resendVerificationCode.mockReset().mockResolvedValue('ok');
    replace.mockReset();
    refresh.mockReset();
  });

  afterEach(cleanup);

  it("draws frame 12's placeholders in both fields", () => {
    render(<SignInForm destination="/after-sign-in" />);

    expect(screen.getByLabelText('Email').getAttribute('placeholder')).toBe('you@example.com');
    expect(screen.getByLabelText('Password').getAttribute('placeholder')).toBe('••••••••••');
  });

  it('links to the password reset', () => {
    render(<SignInForm destination="/after-sign-in" />);

    expect(screen.getByRole('link', { name: 'Forgot password?' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
  });

  it('signs in and goes to the destination it was given', async () => {
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in?returnTo=%2Fbookings" />);

    await submit(user);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/after-sign-in?returnTo=%2Fbookings'),
    );
    expect(signInWithEmail).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'hunter2-hunter2',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  /*
   * The wording never comes from upstream: a message that distinguished "no
   * such user" from "wrong password" would tell a stranger which addresses
   * hold accounts.
   */
  it('says one fixed sentence on bad credentials and stays put', async () => {
    signInWithEmail.mockResolvedValue('rejected');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    await submit(user);

    expect(await screen.findByText('That email and password did not match.')).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('announces a refusal as an alert and marks both fields invalid', async () => {
    signInWithEmail.mockResolvedValue('rejected');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBeNull();

    await submit(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('That email and password did not match.');
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');
  });

  it('gives the forgot-password link a 44px target', () => {
    render(<SignInForm destination="/after-sign-in" />);

    // jsdom has no layout, so the class-level fact is what can be asserted.
    expect(screen.getByRole('link', { name: 'Forgot password?' }).className.split(/\s+/)).toContain(
      'min-h-11',
    );
  });

  /*
   * A password sign-in is charged for its failures only (VEN-462), but a
   * mistyped password before the right one still spends the budget: the
   * per-address limit is 10 in 10 minutes. Before the `throttled` outcome
   * existed, a 429 there fell into the same bucket as a genuine mismatch and
   * told a correct password it was wrong.
   */
  it('says to wait, not that credentials are wrong, once throttled', async () => {
    signInWithEmail.mockResolvedValue('throttled');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    await submit(user);

    expect(
      await screen.findByText(
        'Too many wrong passwords from this device. Wait a few minutes, or reset your password to sign in now.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeDefined();
    expect(screen.queryByText('That email and password did not match.')).toBeNull();
  });

  it('does not mark the fields invalid when throttled', async () => {
    signInWithEmail.mockResolvedValue('throttled');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    await submit(user);

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBeNull();
  });

  it('does not mark the fields invalid when the service is unreachable', async () => {
    signInWithEmail.mockResolvedValue('unreachable');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    await submit(user);

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBeNull();
  });

  it('says the service is unreachable, not that the password is wrong, on a network failure', async () => {
    signInWithEmail.mockResolvedValue('unreachable');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    await submit(user);

    expect(
      await screen.findByText('We could not reach the sign-in service. Try again in a moment.'),
    ).toBeDefined();
  });

  it('routes an unverified address to the code step and requests a fresh code', async () => {
    signInWithEmail.mockResolvedValueOnce('unverified');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    await submit(user);

    expect(await screen.findByLabelText('Verification code')).toBeDefined();
    await waitFor(() => expect(resendVerificationCode).toHaveBeenCalledWith('sam@example.com'));
    expect(replace).not.toHaveBeenCalled();
  });

  it('says so on the code step when the fresh code is refused (VEN-620)', async () => {
    signInWithEmail.mockResolvedValueOnce('unverified');
    resendVerificationCode.mockResolvedValue('throttled');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    await submit(user);

    expect(await screen.findByLabelText('Verification code')).toBeDefined();
    expect(
      await screen.findByText(
        "This isn't going through right now. Wait a few minutes and try again.",
      ),
    ).toBeDefined();
  });

  it("keeps a resend's answer when the slower arrival send is refused after it", async () => {
    signInWithEmail.mockResolvedValueOnce('unverified');
    let refuseArrival: (outcome: string) => void = () => undefined;
    resendVerificationCode
      .mockReturnValueOnce(new Promise((resolve) => (refuseArrival = resolve)))
      .mockResolvedValue('ok');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    await submit(user);
    await user.click(await screen.findByRole('button', { name: 'Send a new code' }));
    expect(await screen.findByText('A new code is on its way.')).toBeDefined();

    refuseArrival('throttled');
    await waitFor(() => expect(resendVerificationCode).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText('A new code is on its way.')).toBeDefined();
    expect(
      screen.queryByText("This isn't going through right now. Wait a few minutes and try again."),
    ).toBeNull();
  });

  it('finishes the sign-in after the code from the unverified route is accepted', async () => {
    signInWithEmail.mockResolvedValueOnce('unverified').mockResolvedValue('ok');
    const user = userEvent.setup();
    render(<SignInForm destination="/after-sign-in" />);

    await submit(user);
    await user.type(await screen.findByLabelText('Verification code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/after-sign-in'));
    expect(verifyEmailCode).toHaveBeenCalledWith({ email: 'sam@example.com', otp: '654321' });
  });
});
