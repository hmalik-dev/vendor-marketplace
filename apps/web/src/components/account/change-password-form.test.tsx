import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_MIN_LENGTH } from '@vendor-marketplace/shared';
import { AUTH_COPY } from '@/app/auth-copy';

const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }));

const { ChangePasswordForm } = await import('./change-password-form');

/*
 * The real `changePassword` runs against a stubbed `fetch`, so "refused before
 * any request" is asserted on the network itself, not on a mocked helper.
 */
const fetchMock = vi.fn();

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  fetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fill(current: string, next: string, confirm: string): Promise<void> {
  const user = userEvent.setup();
  render(<ChangePasswordForm />);

  if (current) await user.type(screen.getByLabelText(AUTH_COPY.currentPasswordLabel), current);
  if (next) await user.type(screen.getByLabelText(AUTH_COPY.resetPasswordLabel), next);
  if (confirm) await user.type(screen.getByLabelText(AUTH_COPY.confirmPasswordLabel), confirm);
  await user.click(screen.getByRole('button', { name: AUTH_COPY.changeSubmit }));
}

describe('ChangePasswordForm (VEN-677)', () => {
  it('describes the new password with sign-up’s rule', () => {
    render(<ChangePasswordForm />);

    const field = screen.getByLabelText(AUTH_COPY.resetPasswordLabel);

    expect(field.getAttribute('minlength')).toBe(String(PASSWORD_MIN_LENGTH));
    expect(field.getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByText(AUTH_COPY.passwordHelper)).toBeDefined();
  });

  it.each([
    [
      `a new password of ${PASSWORD_MIN_LENGTH - 1} characters`,
      'old-password',
      'x'.repeat(PASSWORD_MIN_LENGTH - 1),
      'x'.repeat(PASSWORD_MIN_LENGTH - 1),
      'changeTooShort',
    ],
    [
      'a confirm that does not match',
      'old-password',
      'a-new-password',
      'a-new-passwort',
      'changeMismatch',
    ],
    [
      'a new password over 128 characters',
      'old-password',
      'x'.repeat(129),
      'x'.repeat(129),
      'changeTooLong',
    ],
    [
      'a new password equal to the current one',
      'the-same-password',
      'the-same-password',
      'the-same-password',
      'changeSameAsCurrent',
    ],
  ] as const)('refuses %s before any request', async (_name, current, next, confirm, copy) => {
    await fill(current, next, confirm);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(AUTH_COPY[copy])).toBeDefined();
  });

  it('sends the two passwords, says so, clears the fields and keeps the reader here', async () => {
    await fill('the-old-password', 'a-new-password', 'a-new-password');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/change-password');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      currentPassword: 'the-old-password',
      newPassword: 'a-new-password',
    });
    expect(screen.getByText(AUTH_COPY.changeDone)).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>(AUTH_COPY.currentPasswordLabel).value).toBe('');
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    [400, 'changeWrongCurrent'],
    [429, 'throttled'],
    [503, 'unreachable'],
  ] as const)('explains a %i in its own words', async (status, copy) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid password upstream' }), { status }),
    );

    await fill('the-old-password', 'a-new-password', 'a-new-password');

    expect(screen.getByText(AUTH_COPY[copy])).toBeDefined();
    expect(screen.queryByText('Invalid password upstream')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sends a caller whose session ended elsewhere to sign in and back, not to a wrong-password line', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

    await fill('the-old-password', 'a-new-password', 'a-new-password');

    expect(push).toHaveBeenCalledExactlyOnceWith('/sign-in?returnTo=%2Faccount%2Fsettings');
    expect(screen.queryByText(AUTH_COPY.changeWrongCurrent)).toBeNull();
  });
});
