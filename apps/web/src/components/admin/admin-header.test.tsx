import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminHeader } from './admin-header';

afterEach(cleanup);

// The listener is `session-sync.test.tsx`'s (VEN-699); here only that it is mounted.
vi.mock('@/components/auth/session-sync', () => ({
  SessionSync: () => <span data-testid="session-sync" />,
}));

const EMAIL = 'admin+auth_test@example.com';

describe('AdminHeader and a sign-out in another tab', () => {
  it('mounts the session listener, since it replaces the site header on /admin', () => {
    render(<AdminHeader email={EMAIL} name="Admin" />);

    expect(screen.getAllByTestId('session-sync')).toHaveLength(1);
  });
});

/*
 * jsdom performs no layout, so none of this measures a width — the 390px
 * overflow itself is verified in the browser pass. What is settled here is the
 * class-level fact that caused it: a flex item's automatic minimum is
 * `min-content`, so without `min-w-0` on the block and an eliding label, the
 * identity pair cannot compress below the address it prints. Measured at 390 it
 * sat 239.25px wide and reached `right=406.78`, which gave every `/admin` route
 * `scrollWidth 407` and scrolled the document sideways.
 */
describe('AdminHeader', () => {
  it('lets the identity block compress instead of setting a floor under it', () => {
    render(<AdminHeader email={EMAIL} name="Admin" />);

    const label = screen.getByText(`Logged in as ${EMAIL}`);
    expect(label.className).toContain('truncate');

    const block = label.parentElement;
    expect(block?.className).toContain('min-w-0');
  });

  /*
   * #441. `stone-400` is a **border** value: the frames draw it on a light
   * ground at thirty-nine sites and as text on ink at none. This header is
   * `stone-900`, so its text reads from the ink-ground ramp minted in `aac9b3b`
   * — `480 -> 520 -> 540 -> 560` — and `480` is its lightest step.
   *
   * Frame `13` does draw this line at `stone-400`'s own value. That is the
   * frame naming a colour rather than a role, and the two steps are three units
   * apart, so the rendered line is unchanged. Recorded here so a parity pass
   * reads it as the ruling it is and does not re-file it.
   *
   * The token's own end is guarded by `theme-tokens.test.ts`, which carries the
   * `stone-480` on `stone-900` contrast pair. This is the call site.
   */
  it('reads the operator line off the ink-ground ramp, not off a border token', () => {
    render(<AdminHeader email={EMAIL} name="Admin" />);

    const classes = screen.getByText(`Logged in as ${EMAIL}`).className.split(/\s+/);

    expect(classes).toContain('text-stone-480');
    expect(classes).not.toContain('text-stone-400');
  });

  it('keeps the full address reachable once the label elides', () => {
    render(<AdminHeader email={EMAIL} name="Admin" />);

    expect(screen.getByText(`Logged in as ${EMAIL}`).getAttribute('title')).toBe(EMAIL);
  });

  it('holds the brand cluster at its drawn size rather than compressing it', () => {
    render(<AdminHeader email={EMAIL} name="Admin" />);

    // The `Admin` chip's cluster — frame `13` draws it at a fixed size, and the
    // identity block is the half that gives way when the header runs out of room.
    const chip = screen.getByText('Admin');
    expect(chip.parentElement?.className).toContain('shrink-0');
  });
  /*
   * VEN-388. Frame `13`'s `.hd` is `height:64px` plus a 1px bottom border in a
   * document with no box-sizing reset, so it is 65px outer. `box-content` on
   * the same token is what reproduces that; a border-box header is 1px short.
   * jsdom resolves no height, so the class-level fact is what is asserted.
   */
  it('sizes the bar as content-box, so the hairline sits outside the header height', () => {
    render(<AdminHeader email={EMAIL} name="Admin" />);

    const classes = screen.getByRole('banner').className.split(/\s+/);
    expect(classes).toContain('box-content');
    expect(classes).toContain('h-(--header-height)');
    expect(classes).toContain('border-b');
  });

  // VEN-660: the console on staging says so, inverted for the ink header.
  it('marks a staging console in the dark tone, and a production console not at all', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'staging');
    const { unmount } = render(<AdminHeader email={EMAIL} name="Admin" />);
    const marker = screen.getByTestId('tier-marker');
    expect(marker.textContent).toBe('Staging');
    expect(marker.className.split(/\s+/)).toContain('bg-stone-0');
    unmount();

    vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'production');
    render(<AdminHeader email={EMAIL} name="Admin" />);
    expect(screen.queryByTestId('tier-marker')).toBeNull();
    vi.unstubAllEnvs();
  });

  /*
   * VEN-677, ruled by the account holder: the console's avatar opens the same
   * account menu as the site header's, with its first row back to the console.
   */
  it('opens the account menu: the console, settings, support and sign out', () => {
    render(<AdminHeader email={EMAIL} name="Admin" />);

    // jsdom has no PointerEvent, and Radix opens a menu from the keyboard too.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Account menu, Admin' }), {
      key: 'Enter',
    });
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');

    expect(items.map((item) => [item.textContent, item.getAttribute('href')])).toEqual([
      ['Admin', '/admin'],
      ['Account settings', '/account/settings'],
      ['Contact support', '/support'],
      ['Sign out', null],
    ]);
  });

  it('draws the trigger’s monogram as frame `13` does: 30px, in the inverted pair', () => {
    render(<AdminHeader email={EMAIL} name="Admin" />);

    // The trigger names who is signed in: the line beside it carries only an address.
    const trigger = screen.getByRole('button', { name: 'Account menu, Admin' });
    const circle = trigger.firstElementChild as HTMLElement;

    expect(circle.style.width).toBe('30px');
    expect(circle.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['bg-stone-700', 'text-clay-150']),
    );
    expect(trigger.className.split(/\s+/)).toContain('-mx-[7px]');
  });
});
