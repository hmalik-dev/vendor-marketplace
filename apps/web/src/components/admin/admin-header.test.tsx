import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminHeader } from './admin-header';

afterEach(cleanup);

const EMAIL = 'admin+clerk_test@example.com';

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
});
