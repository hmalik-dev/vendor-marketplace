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
 * It hangs off the **bell's** right edge at a fixed 360px, and the bell is not
 * the last thing in the header — `UserButton` and the drawer trigger follow it.
 * So the room to its left is the viewport less everything to its right, which
 * at 390 is about 118px. A first attempt bounded it at one gutter
 * (`100vw - 2.75rem`), the number that would be right if the panel were flush
 * to the screen edge; that removed 14px of a 92px overflow and left the
 * timestamps and `Mark all read` still clipped.
 *
 * jsdom performs no layout, so the rendered result is the browser's to settle —
 * see `.claude/rules/web-design-parity.md`. What is checkable here is the
 * arithmetic: the reserve must be at least as wide as the controls that sit
 * between the panel's right edge and the screen's. Asserting the literal string
 * could not fail, which is why the wrong bound survived a green test.
 */
describe('the notifications panel stays inside the viewport', () => {
  /** Everything between the panel's right edge and the viewport's, at 390. */
  const CHROME_TO_THE_RIGHT_PX = 12 + 44 + 12 + 44 - 10 + 16;

  it('reserves at least the width of the controls beside it', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(screen.getByRole('button', { name: /Notifications/ }));

    const panel = screen.getByText('Notifications').closest('div')?.parentElement;
    expect(panel, 'no notifications panel').toBeDefined();

    const className = (panel as HTMLElement).className;

    /* 360px where it fits. */
    expect(className).toContain('w-90');

    const bound = /max-w-\[calc\(100vw-([\d.]+)rem\)\]/.exec(className);
    expect(bound, `no viewport bound in "${className}"`).not.toBeNull();

    const reservedPx = Number((bound as RegExpExecArray)[1]) * 16;
    expect(
      reservedPx,
      `the panel reserves ${reservedPx}px but ${CHROME_TO_THE_RIGHT_PX}px of header ` +
        'chrome sits between it and the screen edge',
    ).toBeGreaterThanOrEqual(CHROME_TO_THE_RIGHT_PX);
  });
});

/**
 * #72 also found the bell dropping the weekday every other date in the product
 * carries — `search-shell`, `request-row` and `booking-entries` all include it.
 * "Sat, Dec 19" is the product's format; "Dec 19" was the bell's alone.
 */
describe('notification dates', () => {
  const NOTIFICATION = {
    id: 'n1',
    type: 'new_request',
    title: 'New booking request',
    body: 'A customer asked about Dec 19.',
    data: {},
    readAt: null,
    // A `Date`, as the wire schema yields — `Intl` rejects the raw ISO string.
    createdAt: new Date('2026-12-19T15:00:00.000Z'),
  };

  it('names the weekday, as every other date in the product does', async () => {
    call.mockResolvedValueOnce({
      items: [NOTIFICATION],
      total: 1,
      page: 1,
      pageSize: 20,
    } as never);

    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(screen.getByRole('button', { name: /Notifications/ }));

    // Scoped to the timestamp itself; the body copy also mentions the date.
    const WEEKDAY_DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), Dec 19$/;

    await waitFor(() => {
      expect(screen.getByText(WEEKDAY_DATE)).toBeDefined();
    });

    // The raw ISO form #72 measured must never reach a reader.
    expect(screen.queryByText(/\d{4}-\d{2}-\d{2}/)).toBeNull();
  });
});
