import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DASHBOARD_LABEL_BY_ROLE } from '@/lib/role-routes';
import { SignedInDrawer } from './header-drawer';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

/**
 * The drawer holds the *same* control the bar hides below `sm`, so it must call
 * it the same thing. Two copies of that decision is how one destination ends up
 * with two names, which is the shape of the defect #361 filed against the bar.
 *
 * The role lives on the server and this is a Client Component, so the label
 * arrives as a prop — and what is worth pinning is that every role's label
 * reaches the rendered row, not that the component knows how to look one up.
 */
describe('SignedInDrawer', () => {
  it.each(Object.entries(DASHBOARD_LABEL_BY_ROLE))(
    'labels the dashboard row for a %s account',
    async (_role, label) => {
      const user = userEvent.setup();

      render(<SignedInDrawer dashboardLabel={label} />);
      await user.click(screen.getByRole('button', { name: 'Open menu' }));

      expect(screen.getByRole('link', { name: label })).toHaveProperty(
        'href',
        'http://localhost:3000/dashboard',
      );
      expect(screen.getByRole('link', { name: 'Messages' })).toHaveProperty(
        'href',
        'http://localhost:3000/messages',
      );
    },
  );

  it('never writes "Dashboard" for a customer', async () => {
    const user = userEvent.setup();

    render(<SignedInDrawer dashboardLabel={DASHBOARD_LABEL_BY_ROLE.customer} />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(document.body.textContent).not.toContain('Dashboard');
  });
});
