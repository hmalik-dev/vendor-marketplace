import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const requestPasswordReset = vi.fn();
const resetPasswordWithCode = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth/auth-requests', () => ({
  requestPasswordReset: (email: unknown) => requestPasswordReset(email),
  resetPasswordWithCode: (input: unknown) => resetPasswordWithCode(input),
}));

const { ForgotPasswordForm } = await import('./forgot-password-form');
const { ResetPasswordForm } = await import('./reset-password-form');

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    push.mockReset();
    requestPasswordReset.mockReset().mockResolvedValue('ok');
  });
  afterEach(cleanup);

  it('asks for a code and moves on with the address', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('Email'), ' sam@example.com ');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));

    expect(requestPasswordReset).toHaveBeenCalledWith('sam@example.com');
    expect(push).toHaveBeenCalledWith('/reset-password?email=sam%40example.com');
  });

  it('stays put and says so when the service cannot be reached', async () => {
    requestPasswordReset.mockResolvedValue('unreachable');
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('Email'), 'sam@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));

    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByText('We could not reach the sign-in service. Try again in a moment.'),
    ).toBeDefined();
  });
});

it('ForgotPasswordForm stays put when the caller is throttled', async () => {
  push.mockReset();
  requestPasswordReset.mockReset().mockResolvedValue('throttled');
  const user = userEvent.setup();
  render(<ForgotPasswordForm />);

  await user.type(screen.getByLabelText('Email'), 'sam@example.com');
  await user.click(screen.getByRole('button', { name: 'Email me a code' }));

  expect(push).not.toHaveBeenCalled();
  expect(
    screen.getByText("This isn't going through right now. Wait a few minutes and try again."),
  ).toBeDefined();
  cleanup();
});

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    requestPasswordReset.mockReset().mockResolvedValue('ok');
    resetPasswordWithCode.mockReset().mockResolvedValue('ok');
  });
  afterEach(cleanup);

  async function fill(
    user: ReturnType<typeof userEvent.setup>,
    password = 'brand-new-pass',
  ): Promise<void> {
    await user.type(screen.getByLabelText('Verification code'), '123456');
    await user.type(screen.getByLabelText('New password'), password);
  }

  it('offers a way back to sign in before the reset is done', () => {
    render(<ResetPasswordForm initialEmail="" />);

    expect(screen.getByRole('link', { name: 'Back to sign in' }).getAttribute('href')).toBe(
      '/sign-in',
    );
  });

  it('prefills the address from the request screen', () => {
    render(<ResetPasswordForm initialEmail="sam@example.com" />);

    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('sam@example.com');
  });

  it('sends the code and the new password, then points at sign-in', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm initialEmail="sam@example.com" />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(resetPasswordWithCode).toHaveBeenCalledWith({
      email: 'sam@example.com',
      otp: '123456',
      password: 'brand-new-pass',
    });
    expect(screen.getByText('Your password is changed. Sign in with the new one.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in');
  });

  it('keeps submit disabled until the password meets the ten-character rule', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm initialEmail="sam@example.com" />);

    await fill(user, 'short-9ch');

    expect(
      (screen.getByRole('button', { name: 'Set new password' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('says one fixed sentence for a used, expired or wrong code', async () => {
    resetPasswordWithCode.mockResolvedValue('rejected');
    const user = userEvent.setup();
    render(<ResetPasswordForm initialEmail="sam@example.com" />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(
      screen.getByText(
        'That code did not work, or it has expired. Check it, or ask for a new one.',
      ),
    ).toBeDefined();
    expect(screen.queryByText('Your password is changed. Sign in with the new one.')).toBeNull();
  });

  it('says to wait, not that the code is wrong, once the address is throttled', async () => {
    resetPasswordWithCode.mockResolvedValue('throttled');
    const user = userEvent.setup();
    render(<ResetPasswordForm initialEmail="sam@example.com" />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(
      screen.getByText("This isn't going through right now. Wait a few minutes and try again."),
    ).toBeDefined();
    expect(
      screen.queryByText(
        'That code did not work, or it has expired. Check it, or ask for a new one.',
      ),
    ).toBeNull();
  });

  it('says to wait when a resend is throttled', async () => {
    requestPasswordReset.mockResolvedValue('throttled');
    const user = userEvent.setup();
    render(<ResetPasswordForm initialEmail="sam@example.com" />);

    await user.click(screen.getByRole('button', { name: 'Send a new code' }));

    expect(
      screen.getByText("This isn't going through right now. Wait a few minutes and try again."),
    ).toBeDefined();
  });

  /*
   * `requestPasswordReset` only ever answers 'rejected' for something other
   * than the per-caller 429 (`auth-requests.ts`'s docstring), so this leftover
   * outcome must not be relabelled as a throttle it never was.
   */
  it('does not call an actual refusal a throttle', async () => {
    requestPasswordReset.mockResolvedValue('rejected');
    const user = userEvent.setup();
    render(<ResetPasswordForm initialEmail="sam@example.com" />);

    await user.click(screen.getByRole('button', { name: 'Send a new code' }));

    expect(
      screen.getByText('We could not reach the sign-in service. Try again in a moment.'),
    ).toBeDefined();
    expect(
      screen.queryByText("This isn't going through right now. Wait a few minutes and try again."),
    ).toBeNull();
  });

  it('asks for a fresh code for the address shown', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm initialEmail="sam@example.com" />);

    await user.click(screen.getByRole('button', { name: 'Send a new code' }));

    expect(requestPasswordReset).toHaveBeenCalledWith('sam@example.com');
  });
});
