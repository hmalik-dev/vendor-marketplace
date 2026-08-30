import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { STICKY_SUBMIT_BAR_HEIGHT, TOAST_BOTTOM_OFFSET, TOAST_GAP } from './toast-offset';

const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(relative: string): string {
  return readFileSync(path.join(WEB_SRC, relative), 'utf8');
}

describe('TOAST_BOTTOM_OFFSET', () => {
  it('clears the sticky submit bar with a gap', () => {
    expect(TOAST_BOTTOM_OFFSET).toBe(`${STICKY_SUBMIT_BAR_HEIGHT + TOAST_GAP}px`);
    expect(STICKY_SUBMIT_BAR_HEIGHT + TOAST_GAP).toBeGreaterThan(STICKY_SUBMIT_BAR_HEIGHT);
  });

  /**
   * The number above is a measurement of the bar, so it has to fail when the
   * bar changes. `py-3.5` is 14px each side; a bar given more padding would
   * grow past the offset and start swallowing toasts again exactly as #225
   * described, silently.
   */
  it('is measured against the bar the vendor form actually renders', () => {
    const form = read('components/vendor-profile-form.tsx');
    const bar = form.split('\n').find((line) => line.includes('sticky bottom-0'));

    expect(bar).toBeDefined();
    expect(bar).toContain('py-3.5');
    // It wraps below `lg`, which is why the constant sizes the two-line bar.
    expect(bar).toContain('lg:static');
  });

  it('clears the bar even when its left cell wraps above the buttons', () => {
    // One line is 65px; the wrapped bar adds a text row. Sizing to 65 is what
    // would let the trap back in at exactly the widths where the bar sticks.
    expect(STICKY_SUBMIT_BAR_HEIGHT).toBeGreaterThan(65);
  });

  /**
   * sonner's `assignOffset` writes a scalar to all four sides via `assignAll`,
   * so `offset={TOAST_BOTTOM_OFFSET}` would move every toast in from the right
   * edge as well — 105px in place of the 24px default. Only the bottom is ours.
   */
  it('moves the bottom inset alone, not all four sides', () => {
    const layout = read('app/layout.tsx');

    expect(layout).toContain('offset={{ bottom: TOAST_BOTTOM_OFFSET }}');
    expect(layout).not.toMatch(/offset=\{TOAST_BOTTOM_OFFSET\}/);
  });

  /**
   * sonner swaps to `mobileOffset` below 600px. The submit bar is `sticky`
   * rather than `static` below `lg`, so the narrow widths are the ones that
   * still have a bar to collide with — leaving the mobile inset at its 16px
   * default would have fixed #225 only where it was least likely to bite.
   */
  it('applies the same inset below sonner’s 600px breakpoint', () => {
    const layout = read('app/layout.tsx');

    expect(layout).toContain('mobileOffset={{ bottom: TOAST_BOTTOM_OFFSET }}');
  });

  it('keeps the corner the design fixes', () => {
    expect(read('app/layout.tsx')).toContain('position="bottom-right"');
  });
});
