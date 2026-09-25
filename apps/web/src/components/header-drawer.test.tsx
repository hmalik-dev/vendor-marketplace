import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignedInDrawer } from './header-drawer';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

/*
 * The sign-out control clones its one child with a click handler that signs
 * out to `redirectUrl`. The mock does the same against a spy, so removing the
 * wrapper or changing where it lands fails a test.
 */
const signOut = vi.fn();

vi.mock('@/components/auth/sign-out-button', async () => {
  const { cloneElement } = await import('react');

  return {
    SignOutButton: ({
      children,
      redirectUrl,
    }: {
      children: React.ReactElement<{ onClick?: () => void }>;
      redirectUrl?: string;
    }) => cloneElement(children, { onClick: () => signOut(redirectUrl) }),
  };
});

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  signOut.mockClear();
});

const SIGN_OUT_ROW = ['Sign out', null];

/**
 * The drawer holds the *same* rows the avatar menu does, read from the same
 * `accountLinksFor` list: the rows below are pinned by role so a row added to
 * one surface and not the other fails here (VEN-702). `Messages` follows the
 * first row where the role has an inbox; an admin has none.
 */
describe('SignedInDrawer', () => {
  it.each([
    [
      'customer' as const,
      [
        ['My bookings', '/dashboard'],
        ['Messages', '/messages'],
        ['My profile', '/customer/profile'],
        ['Account settings', '/account/settings'],
        ['Contact support', '/support'],
        SIGN_OUT_ROW,
      ],
    ],
    [
      'vendor' as const,
      [
        ['Dashboard', '/dashboard'],
        ['Messages', '/messages'],
        ['Account settings', '/account/settings'],
        ['Contact support', '/support'],
        SIGN_OUT_ROW,
      ],
    ],
    [
      'admin' as const,
      [['Admin', '/admin'], ['Account settings', '/account/settings'], SIGN_OUT_ROW],
    ],
  ])('carries exactly a %s account’s rows', async (role, expected) => {
    const user = userEvent.setup();

    render(<SignedInDrawer role={role} />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    const rows = screen.getByRole('navigation', { name: 'Menu' }).querySelectorAll('li > *');

    expect([...rows].map((row) => [row.textContent, row.getAttribute('href')])).toEqual(expected);
  });

  it('signs out to the home page', async () => {
    const user = userEvent.setup();

    render(<SignedInDrawer role="vendor" />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledExactlyOnceWith('/');
  });

  it('never writes "Dashboard" for a customer', async () => {
    const user = userEvent.setup();

    render(<SignedInDrawer role="customer" />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(document.body.textContent).not.toContain('Dashboard');
  });

  it('offers an admin neither Messages nor Contact support', async () => {
    const user = userEvent.setup();

    render(<SignedInDrawer role="admin" />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.queryByRole('link', { name: 'Messages' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Contact support' })).toBeNull();
  });
});
