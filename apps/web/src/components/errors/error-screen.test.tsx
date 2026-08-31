import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorScreen } from './error-screen';

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
});
