import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo, LOGO_SIZES } from './logo';

const require = createRequire(import.meta.url);
const themeCss = readFileSync(
  require.resolve('@vendor-marketplace/config/tailwind/theme.css'),
  'utf8',
);

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

  it('keeps the header the frame’s height, in the token that sets it', () => {
    const height = headerRule.match(/height:(\d+)px/);

    expect(height).not.toBeNull();

    // Read the app's own token rather than restating the number, so changing
    // `--header-height` fails here instead of passing on the frame alone.
    const token = themeCss.match(/--header-height:\s*([\d.]+)rem/);

    expect(token).not.toBeNull();
    expect(Number(token?.[1]) * 16).toBe(Number(height?.[1]));
  });

  /*
   * The wordmark is deliberately NOT asserted against the frame here. The
   * frames pair a 15px mark with 23px, and `design-plan/02-brand-and-logo.md`
   * states 1.60 D, which is 24px. Those disagree, and the plan wins until a
   * design pass rules otherwise — so this file asserts the plan's number and
   * `logo.test.tsx` owns it. Recorded against #118.
   */
  it('keeps the wordmark on the plan’s ratio, not the frame’s', () => {
    const plan = readFileSync(
      join(process.cwd(), '../../design/design-plan/02-brand-and-logo.md'),
      'utf8',
    );
    const stated = plan.match(/wordmark size\s+([\d.]+) D/);

    expect(stated).not.toBeNull();

    render(<Logo size={LOGO_SIZES.desktopHeader} />);

    const expected = LOGO_SIZES.desktopHeader * Number(stated?.[1]);
    expect(screen.getByTestId('logo-wordmark').style.fontSize).toBe(`${expected}px`);
  });
});
