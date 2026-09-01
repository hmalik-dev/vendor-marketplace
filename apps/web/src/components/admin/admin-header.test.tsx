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
