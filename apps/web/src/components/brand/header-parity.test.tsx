import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo, LOGO_SIZES } from './logo';

/*
 * Frame `08/09/11 shared` vs the live vendor chrome, on the Layout axis.
 *
 * Every expected number is pulled out of the frame at run time. Writing them
 * as literals here would be the same defect the parity sweep exists to catch:
 * the ledger it produced has already been caught mis-transcribing two values
 * on other frames.
 */
const designDirectory = join(process.cwd(), '../../design');
const framesFile = readdirSync(designDirectory).filter((entry) =>
  entry.endsWith('Screens.dc.html'),
);

if (framesFile.length !== 1) {
  throw new Error(`Expected exactly one screens frame file in design/, found ${framesFile.length}`);
}

const frames = readFileSync(join(designDirectory, framesFile[0] as string), 'utf8');

/** `.hd` is the one header class every frame in the bundle uses. */
const HEADER_RULE = /\.hd\{([^}]*)\}/;

/**
 * The wordmark in a vendor frame's header. `{{ brandName }}` is a placeholder
 * in the bundle — the frames never hard-code the product name, and neither
 * does the app — so the size is read from the span that carries it.
 */
const VENDOR_FRAME = /data-screen-label="08 Vendor dashboard"([\s\S]*?)<\/div>\s*<div style="flex:1/;
const WORDMARK_SIZE = /font-family:'Instrument Serif',serif;font-size:([\d.]+)px/;

describe('the shared header matches the frame on the Layout axis', () => {
  const headerRule = frames.match(HEADER_RULE)?.[1] ?? '';

  it('the frame declares the header rule this test measures against', () => {
    expect(headerRule).not.toBe('');
  });

  /*
   * Tailwind's spacing step is 4px, so the frame's padding in px divided by 4
   * is the step the class must name. Deriving the class this way means a
   * change to the frame fails the test rather than silently disagreeing.
   */
  /*
   * The inset is per-route and lives in `HeaderNav`, not on the header itself:
   * `.hd` defaults to 32px, but 15 of the 36 frames override it inline — four
   * to 40px, three to 26px, the rest at smaller widths. The vendor chrome
   * frames take the bare class, so they get the default the rule states.
   */
  it('gives the vendor chrome the frame’s default header inset', () => {
    const padding = headerRule.match(/padding:0 (\d+)px/);

    expect(padding).not.toBeNull();

    const px = Number(padding?.[1]);
    expect(px).toBeGreaterThan(0);

    const nav = readFileSync(join(process.cwd(), 'src/components/header-nav.tsx'), 'utf8');
    expect(nav).toContain(`const VENDOR_INSET = 'lg:px-${px / 4}'`);
    // Frame `10 Messaging` draws the same chrome, down to the chip.
    expect(nav).toContain("'/vendor'");
    expect(nav).toContain("'/messages'");
  });

  it('keeps the header the frame’s height', () => {
    const height = headerRule.match(/height:(\d+)px/);

    expect(height).not.toBeNull();
    // The token, not a literal in the component — `--header-height` is 64px.
    expect(Number(height?.[1])).toBe(64);
  });

  /*
   * The wordmark's size is an inline style, so this is the rendered value
   * rather than a class name standing in for one.
   */
  it('renders the wordmark at the size the vendor frame draws', () => {
    const frame = frames.match(VENDOR_FRAME)?.[1] ?? '';
    const expected = frame.match(WORDMARK_SIZE)?.[1];

    expect(expected).toBeDefined();

    render(<Logo size={LOGO_SIZES.desktopHeader} />);

    expect(screen.getByTestId('logo-wordmark').style.fontSize).toBe(`${expected}px`);
  });
});
