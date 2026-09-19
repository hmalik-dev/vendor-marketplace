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
