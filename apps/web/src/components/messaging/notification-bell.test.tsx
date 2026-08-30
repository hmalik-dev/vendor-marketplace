import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 }));

vi.mock('@/lib/use-api', () => ({ useApi: () => call }));
vi.mock('@/lib/use-event-stream', () => ({
  useEventStream: () => ({ connected: true }),
}));

const { NotificationBell } = await import('./notification-bell');

afterEach(() => {
  cleanup();
});

/*
 * Frame `08/09/11 shared`, Access axis.
 *
 * `04-laws.md`: overlays "close on Escape, restore focus". The panel closed on
 * an outside click and on nothing else, so a keyboard user who opened it had
 * no way to shut it — and the empty panel holds nothing focusable, so there
 * was not even a tab-out.
 *
 * These assert behaviour through the rendered DOM rather than the source, so
 * they fail if the handler is removed, rebound to the wrong key, or stops
 * putting focus back.
 */
describe('the notifications panel dismisses on Escape', () => {
  const openPanel = async (): Promise<{
    user: ReturnType<typeof userEvent.setup>;
    bell: HTMLElement;
  }> => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    const bell = screen.getByRole('button', { name: /Notifications/ });
    await user.click(bell);

    expect(bell.getAttribute('aria-expanded')).toBe('true');

    return { user, bell };
  };

  it('opens on the trigger and reports it', async () => {
    const { bell } = await openPanel();

    expect(screen.getByText('Notifications')).toBeDefined();
    expect(bell.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on Escape', async () => {
    const { user, bell } = await openPanel();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(bell.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('puts focus back on the trigger', async () => {
    const { user, bell } = await openPanel();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(bell);
    });
  });

  /*
   * The handler is bound to Escape specifically. Without this, binding it to
   * every keydown would pass the two tests above and close the panel the
   * instant anyone typed.
   *
   * Neither key here activates the trigger: Enter and Space would, since focus
   * is on it, and that is the button's own toggle rather than this handler.
   */
  it('stays open for any other key', async () => {
    const { user, bell } = await openPanel();

    await user.keyboard('a');
    await user.keyboard('{ArrowDown}');

    expect(bell.getAttribute('aria-expanded')).toBe('true');
  });

  /*
   * A leaked listener only reacts to Escape, so re-opening with a click and
   * checking it is open proves nothing — that passes with the cleanup deleted.
   * Pressing Escape a second time while closed is what exercises the leak: a
   * bound-but-stale listener would run against the reopened panel.
   */
  it('unbinds on close, so a stale listener cannot fire', async () => {
    const { user, bell } = await openPanel();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(bell.getAttribute('aria-expanded')).toBe('false');
    });

    // Escape while closed must be inert.
    await user.keyboard('{Escape}');
    expect(bell.getAttribute('aria-expanded')).toBe('false');

    await user.click(bell);
    expect(bell.getAttribute('aria-expanded')).toBe('true');

    // And exactly one handler should close it again, not several.
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(bell.getAttribute('aria-expanded')).toBe('false');
    });
  });
});

/*
 * #70: the panel has to render on screen at every width, not just the ones the
 * frames draw.
 *
 * It hangs off the bell's right edge at a fixed 360px, so at 375px it ran past
 * the left edge of the viewport and clipped its own content — timestamps and
 * the "Mark all read" control first. jsdom does no layout, so what is asserted
 * is the bound itself: a width rule that cannot exceed the viewport.
 */
describe('the notifications panel stays inside the viewport', () => {
  it('caps its width at the viewport less both gutters', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(screen.getByRole('button', { name: /Notifications/ }));

    const panel = screen.getByText('Notifications').closest('div')?.parentElement;
    expect(panel, 'no notifications panel').toBeDefined();

    /* 360px where it fits, and never wider than the screen where it does not. */
    expect((panel as HTMLElement).className).toContain('w-90');
    expect((panel as HTMLElement).className).toContain('max-w-[calc(100vw-2.75rem)]');
  });
});
