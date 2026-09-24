import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  render(<ChangePasswordForm role="vendor" />);

  if (current) await user.type(screen.getByLabelText(AUTH_COPY.currentPasswordLabel), current);
  if (next) await user.type(screen.getByLabelText(AUTH_COPY.resetPasswordLabel), next);
  if (confirm) await user.type(screen.getByLabelText(AUTH_COPY.confirmPasswordLabel), confirm);
  await user.click(screen.getByRole('button', { name: AUTH_COPY.changeSubmit }));
}

describe('ChangePasswordForm (VEN-677)', () => {
  it('describes the new password with sign-up’s rule', () => {
    render(<ChangePasswordForm role="vendor" />);

    const field = screen.getByLabelText(AUTH_COPY.resetPasswordLabel);

    expect(field.getAttribute('minlength')).toBe('10');
    expect(field.getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByText(AUTH_COPY.passwordHelper)).toBeDefined();
  });

  it.each([
    [
      'a new password under 10 characters',
      'old-password',
      'short-pw1',
      'short-pw1',
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

  it("sends the two passwords, then takes the reader to their role's home (VEN-698)", async () => {
    await fill('the-old-password', 'a-new-password', 'a-new-password');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/change-password');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      currentPassword: 'the-old-password',
      newPassword: 'a-new-password',
    });
    expect(push).toHaveBeenCalledExactlyOnceWith('/vendor/dashboard');
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['customer', '/bookings'],
    ['admin', '/admin'],
  ] as const)('takes a %s to %s on success', async (role, home) => {
    const user = userEvent.setup();
    render(<ChangePasswordForm role={role} />);
    await user.type(screen.getByLabelText(AUTH_COPY.currentPasswordLabel), 'the-old-password');
    await user.type(screen.getByLabelText(AUTH_COPY.resetPasswordLabel), 'a-new-password');
    await user.type(screen.getByLabelText(AUTH_COPY.confirmPasswordLabel), 'a-new-password');
    await user.click(screen.getByRole('button', { name: AUTH_COPY.changeSubmit }));

    expect(push).toHaveBeenCalledExactlyOnceWith(home);
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

    expect(push).toHaveBeenCalledExactlyOnceWith(
      '/sign-in?returnTo=%2Faccount%2Fsettings%2Fpassword',
    );
    expect(screen.queryByText(AUTH_COPY.changeWrongCurrent)).toBeNull();
  });
});
