import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavDrawer } from './nav-drawer';

const pathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LINKS = [
  { label: 'Browse', href: '/search' },
  { label: 'How it works', href: '/#how-it-works' },
] as const;

afterEach(() => {
  pathname.current = '/';
  cleanup();
});

/**
 * The header used to drop its nav below `md`, so on a phone these routes had
 * no door at all. What matters here is not that a panel appears but that it
 * behaves like one: reachable by keyboard, escapable, and gone once it has
 * been used.
 */
describe('NavDrawer', () => {
  it('offers a trigger with a 44px tap target', () => {
    render(<NavDrawer links={LINKS} />);

    expect(screen.getByRole('button', { name: 'Open menu' }).className).toContain('size-11');
  });

  it('opens on the trigger and lists every link', async () => {
    const user = userEvent.setup();
    render(<NavDrawer links={LINKS} />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByRole('link', { name: 'Browse' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'How it works' })).toBeDefined();
  });

  /* Keyboard reachability is the point of a button over a click handler. */
  it('opens from the keyboard', async () => {
    const user = userEvent.setup();
    render(<NavDrawer links={LINKS} />);

    screen.getByRole('button', { name: 'Open menu' }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<NavDrawer links={LINKS} />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moves focus into the panel and back to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<NavDrawer links={LINKS} />);

    const trigger = screen.getByRole('button', { name: 'Open menu' });
    await user.click(trigger);

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  /*
   * A drawer left standing over the page it just navigated to is this
   * component's most common bug, and the route change is the only signal.
   */
  it('closes when the route changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<NavDrawer links={LINKS} />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog')).toBeDefined();

    pathname.current = '/search';
    rerender(<NavDrawer links={LINKS} />);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('names itself for assistive technology without drawing a heading', async () => {
    const user = userEvent.setup();
    render(<NavDrawer links={LINKS} />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Menu');
  });
});
