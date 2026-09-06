import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_NAME, SUPPORT_PATH } from '@vendor-marketplace/shared';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorScreen } from './error-screen';
import CheckoutError from '@/app/bookings/[requestId]/checkout/error';

/** `apps/web/src`, from this file's own location. */
const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('ErrorScreen', () => {
  afterEach(() => {
    cleanup();
  });

  /*
   * The two things a user needs from a server error and rarely gets:
   * confirmation that no money moved, and a reference support can look up.
   * `40-states.md` §1 questions 2 and 4.
   */
  it('states the money position even though the answer is nothing', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    const banner = screen.getByRole('status');

    expect(banner.textContent).toContain('No payment was taken and no booking was changed.');
    // Settled, not failed: sage is the colour for a resolved money position.
    expect(banner.getAttribute('data-status')).toBe('settled');
  });

  it('shows the digest, selectable, when there is one to quote', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    const reference = screen.getByText('err_9F3K2QX7');

    expect(reference.className).toContain('select-all');
    expect(reference.className).toContain('font-mono');
  });

  /*
   * A reference the support inbox cannot look up is worse than none, so the
   * line is absent rather than filled with a decorative id.
   */
  it('omits the reference entirely when nothing was logged to match', () => {
    render(<ErrorScreen reset={vi.fn()} />);

    expect(screen.queryByText(/include this if you write to us/)).toBeNull();
  });

  it('retries the segment rather than reloading the document', async () => {
    const reset = vi.fn();
    render(<ErrorScreen digest="err_9F3K2QX7" reset={reset} />);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it('keeps the copy free of apology', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    const text = document.body.textContent ?? '';

    expect(text).not.toMatch(/oops/i);
    expect(text).not.toContain('!');
  });

  /*
   * D17: the 500 page cannot know who is reading it. `Go to my bookings` is
   * addressed to a signed-in customer and is a dead end for everyone else —
   * a signed-out visitor lands on a sign-in wall, and a vendor on a hub that
   * is not theirs. `/search` is the one destination true for every reader.
   *
   * Frame `16`, and `31-content-voice.md`'s 500 recovery row.
   */
  it('recovers to the one destination true for every reader', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    const recovery = screen.getByRole('link', { name: 'Browse vendors' });

    expect(recovery.getAttribute('href')).toBe('/search');
  });

  it('no longer sends an unknown reader to a signed-in surface', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    expect(screen.queryByRole('link', { name: 'Go to my bookings' })).toBeNull();
  });

  /*
   * Deliberately still an `<a>`, not a `<Link>`: this screen is shared with
   * `global-error.tsx`, which replaces the root layout and so renders outside
   * the App Router context `next/link` needs to mount.
   */
  it('keeps the recovery a hard navigation', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Browse vendors' }).tagName).toBe('A');
  });

  /*
   * #421. Frame `16` asks the visitor to include the reference if they write to
   * us, and frame `29` is the screen that does the including for them: the
   * link carries the digest, the route and the moment, so the report that
   * arrives can actually be looked up. Frame `16` draws the affordance in a
   * bespoke 64px header, which is #372's work; it sits under the reference
   * here because that is what it carries.
   */
  describe('the route to support', () => {
    it('carries the digest, the route and the moment', async () => {
      window.history.replaceState({}, '', '/bookings/abc/checkout?package=2');

      render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

      const link = screen.getByRole('link', { name: 'Contact support' });

      // Set on mount: `window.location` cannot be read during the server
      // render this screen also does, so the first paint is the bare path.
      await waitFor(() => expect(link.getAttribute('href')).toContain('?'));

      const query = new URLSearchParams((link.getAttribute('href') ?? '').split('?')[1]);
      expect(query.get('digest')).toBe('err_9F3K2QX7');
      expect(query.get('from')).toBe('/bookings/abc/checkout?package=2');
      expect(Number.isNaN(Date.parse(query.get('at') ?? ''))).toBe(false);
    });

    /*
     * An error thrown while rendering on the client was never written to the
     * server log, so there is nothing for support to look up. The link still
     * leads somewhere — a visitor with a broken page still needs it — it just
     * does not promise a reference that does not exist.
     */
    it('leads to the bare path when nothing was logged to match', () => {
      render(<ErrorScreen reset={vi.fn()} />);

      expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')).toBe(
        SUPPORT_PATH,
      );
    });

    // The same reason `Browse vendors` is an `<a>`: `global-error.tsx` renders
    // this outside the App Router context `next/link` needs.
    it('is a hard navigation too', () => {
      render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

      expect(screen.getByRole('link', { name: 'Contact support' }).tagName).toBe('A');
    });
  });
});

/**
 * Frame `16` draws a bespoke 64px header — the wordmark and one route to a
 * human — and **no site footer and no marketplace navigation**. A reader whose
 * page has just crashed gets one way out, not the ordinary navigation of an
 * application they have already watched fail.
 */
describe('ErrorScreen — the chrome frame 16 draws, and the chrome it removes', () => {
  afterEach(() => {
    cleanup();
  });

  /*
   * Found by its slot, **not** by the `banner` role. In the app this `<header>`
   * renders inside the root layout's `<main>`, where a scoped header maps to
   * `generic` rather than to a landmark — so a `getByRole('banner')` here would
   * pass in jsdom (which puts it at the top level) while matching nothing in a
   * real browser. Verified in one at 1440x900: 0 banner, 0 navigation and 0
   * contentinfo landmarks on the 500 screen, which is the point of the removal.
   */
  it('draws its own header, with the wordmark and Contact support', () => {
    const { container } = render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    const header = container.querySelector('[data-slot="error-header"]') as HTMLElement;

    expect(header).not.toBeNull();
    expect(within(header).getByRole('link', { name: BRAND_NAME })).toHaveProperty(
      'href',
      'http://localhost:3000/',
    );
    expect(within(header).getByRole('link', { name: 'Contact support' })).toBeDefined();
    // The frame's `.hd`: `--header-height`, cream over a stone-300 hairline.
    expect(header.className).toContain('h-(--header-height)');
    expect(header.className).toContain('border-b');
  });

  /*
   * `Contact support` is in the header now, where the frame puts it — not
   * repeated under the reference line, which is where #421 had to leave it
   * while this screen still wore the site header.
   */
  it('carries exactly one route to a human', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    expect(screen.getAllByRole('link', { name: 'Contact support' })).toHaveLength(1);
  });

  /*
   * **The hook, asserted at the class level, because jsdom applies no
   * stylesheet.** `error.tsx` renders *underneath* the root layout, so the site
   * header and footer are this component's siblings and nothing it returns can
   * remove them; the removal is one `:has()` rule in `globals.css` keyed on this
   * attribute. All three halves are pinned — the mark, the rule, and the slots
   * the rule names — and the rendered result is verified in a browser rather
   * than claimed here, since `scrollWidth`/`display` in jsdom would pass on
   * nothing.
   */
  it('marks itself so the site chrome can be taken down', () => {
    const { container } = render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    expect(container.querySelector('[data-error-screen]')).not.toBeNull();
  });

  it('has a stylesheet rule that hides both site landmarks on it', () => {
    const css = readFileSync(path.join(WEB_SRC, 'app/globals.css'), 'utf8');
    const start = css.indexOf('body:has([data-error-screen])');

    expect(start).toBeGreaterThan(-1);

    const rule = css.slice(start, css.indexOf('}', start) + 1);

    expect(rule).toContain("[data-slot='site-header']");
    expect(rule).toContain("[data-slot='site-footer']");
    expect(rule).toContain('display: none');
  });

  /*
   * The other half of the same pair: the selectors above are worth nothing once
   * the two components stop carrying those slots, and a CSS selector that
   * matches nothing fails silently.
   */
  it.each([
    ['site-header', 'components/site-header.tsx'],
    ['site-footer', 'components/site-footer.tsx'],
  ])('finds the %s slot the rule targets', (slot, file) => {
    expect(readFileSync(path.join(WEB_SRC, file), 'utf8')).toContain(`data-slot="${slot}"`);
  });

  /* Frame `16`: h1 at 38px, body at 14px on 1.65, reference chip at 12px. */
  it('takes the frame type scale, not the shell it inherited', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    const body = screen.getByText(/This wasn't anything you did/);

    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-display-error');
    expect(body.className).toContain('text-cta');
    expect(body.className).toContain('leading-[1.65]');
    expect(screen.getByText('err_9F3K2QX7').className).toContain('text-meta');
  });

  /*
   * `31-content-voice.md`: the straight apostrophe, never the curly one. This
   * screen and the 404 were the two that wrote `&rsquo;` while `/sign-up` wrote
   * `&apos;`, which is the inconsistency #366 was filed for.
   */
  it('writes straight apostrophes', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} />);

    const text = document.body.textContent ?? '';

    expect(text).toContain("This wasn't anything you did.");
    expect(text).not.toContain('’');
  });
});

/**
 * Checkout is the one route that already has a header of its own.
 *
 * `checkout/layout.tsx` draws frame `05`'s wordmark bar, and it is a *layout*
 * precisely so that this segment's `error` and `not-found` boundaries inherit
 * it. This screen's own header would stack a second — 128px where the frame
 * draws 64 — and `min-h-screen` under that bar is one bar's worth of scroll on
 * the screen `14-checkout.md` says must not compete with finishing.
 *
 * Found by the security review of #372, against the change that introduced it.
 */
describe('ErrorScreen — chrome={false}, under a shell that has its own header', () => {
  afterEach(() => {
    cleanup();
  });

  it('draws no header of its own', () => {
    const { container } = render(
      <ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} chrome={false} />,
    );

    expect(container.querySelector('[data-slot="error-header"]')).toBeNull();
  });

  /*
   * And does not claim a second viewport height: under checkout it is a
   * `flex-1` child of a `min-h-dvh` column, so `min-h-screen` there is the
   * scroll by construction.
   */
  it('fills its parent rather than the viewport', () => {
    const { container } = render(
      <ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} chrome={false} />,
    );

    const root = container.querySelector('[data-error-screen]') as HTMLElement;

    expect(root.className).toContain('flex-1');
    expect(root.className).not.toContain('min-h-screen');
  });

  /*
   * The route to a human moves rather than vanishing. Frame `05`'s bar is "no
   * nav — nothing competes with finishing", so there is nowhere on it to put
   * the link; it goes under the reference, which is where #421 had it on every
   * 500 before this screen grew a header.
   */
  it('still offers exactly one route to a human', () => {
    render(<ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} chrome={false} />);

    expect(screen.getAllByRole('link', { name: 'Contact support' })).toHaveLength(1);
  });

  /*
   * And the marker stays, so a route that ever stops suppressing the site
   * chrome cannot grow a marketplace footer under a crashed payment.
   */
  it('keeps the marker that takes the site chrome down', () => {
    const { container } = render(
      <ErrorScreen digest="err_9F3K2QX7" reset={vi.fn()} chrome={false} />,
    );

    expect(container.querySelector('[data-error-screen]')).not.toBeNull();
  });

  /*
   * **The boundary itself, rendered.** This was a `toContain('chrome={false}')`
   * over that file's source, and mutation testing caught it: deleting the prop
   * from the JSX left the string in the comment above it, so the guard stayed
   * green while the double header came back. A source grep whose needle also
   * appears in prose is not a check.
   */
  it('is what the checkout boundary actually renders', () => {
    const error = Object.assign(new Error('boom'), { digest: 'err_9F3K2QX7' });
    const { container } = render(<CheckoutError error={error} reset={vi.fn()} />);

    expect(container.querySelector('[data-error-screen]')).not.toBeNull();
    expect(container.querySelector('[data-slot="error-header"]')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Contact support' })).toHaveLength(1);
  });
});
