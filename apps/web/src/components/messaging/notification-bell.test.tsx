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

  it('stops listening once closed, so Escape is not swallowed later', async () => {
    const { user, bell } = await openPanel();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(bell.getAttribute('aria-expanded')).toBe('false');
    });

    // Re-opening must still work; a listener left bound would close it again.
    await user.click(bell);
    expect(bell.getAttribute('aria-expanded')).toBe('true');
  });
});
