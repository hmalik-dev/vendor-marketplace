import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCRIM_MID_STOP_FROM_END_PX } from './auth-screen';

/**
 * The sign-up panel's contrast, held to the blanket 4.5:1 in
 * `01-foundations.md`. Ruled 2026-09-04 (D30): no large-text carve-out, the
 * scrim stays, and the colours moved instead.
 *
 * **Nothing else in the repository checks this.** The panel's copy sits on a
 * photograph, so its ground is the scrim composited over whatever that
 * photograph happens to be — and `21-sign-up.md` guarantees legibility against
 * a **pure white** backdrop, the worst any photograph can present, so the
 * guarantee survives swapping the asset. That is what this asserts.
 */

const require = createRequire(import.meta.url);
const themeCss = readFileSync(
  require.resolve('@vendor-marketplace/config/tailwind/theme.css'),
  'utf8',
);

const COLOR_TOKENS = new Map<string, string>(
  [...themeCss.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map((match) => [
    match[1] as string,
    match[2] as string,
  ]),
);

type Rgb = readonly [number, number, number];

function token(name: string): Rgb {
  const hex = COLOR_TOKENS.get(name);

  if (!hex) {
    throw new Error(`Unknown colour token: ${name}`);
  }

  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function channelLuminance(channel: number): number {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([red, green, blue]: Rgb): number {
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

function contrast(foreground: Rgb, background: Rgb): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}

/** `over` composited onto `under` at `alpha`. */
function composite(over: Rgb, alpha: number, under: Rgb): Rgb {
  return [0, 1, 2].map((index) => {
    const top = over[index] as number;
    const bottom = under[index] as number;

    return top * alpha + bottom * (1 - alpha);
  }) as unknown as Rgb;
}

interface ScrimStop {
  color: Rgb;
  alpha: number;
}

/**
 * The three stops of a panel's wash, in order. Parsed from the string the
 * component actually renders rather than restated here, so a change to the
 * gradient is a change to what this test measures.
 */
function parseScrim(wash: string): readonly [ScrimStop, ScrimStop, ScrimStop] {
  const stops = [...wash.matchAll(/rgba\((\d+),(\d+),(\d+),(\.\d+)\)/g)].map((match) => ({
    color: [Number(match[1]), Number(match[2]), Number(match[3])] as Rgb,
    alpha: Number(match[4]),
  }));

  if (stops.length !== 3) {
    throw new Error(`Expected a three-stop scrim, parsed ${stops.length}: ${wash}`);
  }

  return stops as unknown as readonly [ScrimStop, ScrimStop, ScrimStop];
}

/**
 * The scrim colour at the point where its coverage is `alpha`, composited over
 * a white photograph.
 *
 * Coverage rises monotonically from the top stop to the bottom one, so a
 * measured α names a point on the gradient line without needing its pixel
 * offset. The hue is interpolated **premultiplied**, which is how a browser
 * interpolates a gradient between two colours of differing alpha.
 */
function groundAt(wash: string, alpha: number): Rgb {
  const [top, mid, bottom] = parseScrim(wash);
  const [from, to] = alpha <= mid.alpha ? ([top, mid] as const) : ([mid, bottom] as const);
  const progress = (alpha - from.alpha) / (to.alpha - from.alpha);

  const color = [0, 1, 2].map((index) => {
    const start = (from.color[index] as number) * from.alpha;
    const end = (to.color[index] as number) * to.alpha;

    return (start + (end - start) * progress) / alpha;
  }) as unknown as Rgb;

  return composite(color, alpha, [255, 255, 255]);
}

/** The panel's cream — every node that is not an accent or a role label. */
const CREAM = token('stone-0');

/**
 * Every line box on a panel, with the scrim coverage `#385` measured at its
 * centre in a browser (`01-foundations.md`). All three panels are one geometry
 * in the app — the column is `min-h-dvh` and the scrim is anchored in pixels
 * from the bottom — so frame `12`'s coverages are the panel's coverages
 * whichever role is selected.
 */
const LINE_BOXES = [
  { node: 'headline', alpha: 0.672, ink: CREAM, opacity: 1 },
  { node: 'italic accent', alpha: 0.704, ink: null, opacity: 1 },
  { node: 'body', alpha: 0.717, ink: CREAM, opacity: 0.82 },
  { node: 'guarantee', alpha: 0.789, ink: CREAM, opacity: 0.9 },
] as const;

/** The `both` panel's three side labels, which no other panel draws. */
const SIDE_LABELS = [
  { node: 'BOOKING', alpha: 0.789, ink: token('gold-200'), opacity: 1 },
  { node: 'VENDING', alpha: 0.804, ink: token('sage-175'), opacity: 1 },
  { node: 'BOTH', alpha: 0.822, ink: CREAM, opacity: 0.82 },
] as const;

const PANELS = [
  { role: 'both', accent: token('gold-150') },
  { role: 'customer', accent: token('gold-150') },
  { role: 'vendor', accent: token('sage-150') },
] as const;

/** The wash each panel renders, read off the component's own module source. */
// Vitest runs with the package root as cwd, which is where vitest.config.ts sits.
const source = readFileSync(join(process.cwd(), 'src/components/auth/auth-screen.tsx'), 'utf8');

function washFor(role: string): string {
  const panel = source.slice(source.indexOf(`  ${role}: {`));
  const match = /scrim\('(rgba\([^']+\))', '(rgba\([^']+\))'\)/.exec(panel);

  if (!match) {
    throw new Error(`No scrim found for the ${role} panel`);
  }

  // The shared top stop lives in `scrim()` itself; the two tinted ones are its
  // arguments. Reassembled here so the parser sees all three.
  return `rgba(35,32,28,.14) ${match[1]} ${match[2]}`;
}

describe('the sign-up panel clears AA over any photograph', () => {
  for (const { role, accent } of PANELS) {
    const wash = washFor(role);
    const boxes = role === 'both' ? [...LINE_BOXES, ...SIDE_LABELS] : LINE_BOXES;

    /*
     * The blanket floor, with no large-text carve-out — the 38px italic accent
     * is the node that asked for one and was refused (D30). `gold-200` there
     * measures 3.80 and fails; `gold-150` measures 4.67.
     */
    for (const box of boxes) {
      it(`${role}: the ${box.node} clears 4.5:1 against a white photograph`, () => {
        const ground = groundAt(wash, box.alpha);
        const ink = composite(box.ink ?? accent, box.opacity, ground);

        expect(contrast(ink, ground)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  /*
   * The regression that made `12b` fail: a percentage stop over a shorter panel
   * arrives later in pixels and thins the ink under the copy. Anchoring it to
   * the end of the gradient line makes the coverage under a given line of text
   * a property of the panel rather than of the viewport's height.
   */
  it('puts the scrim mid stop where frame `12` draws it, at any panel height', () => {
    const stopPercent = (height: number): number => {
      const radians = (200 * Math.PI) / 180;
      const line = 600 * Math.abs(Math.sin(radians)) + height * Math.abs(Math.cos(radians));

      return ((line - SCRIM_MID_STOP_FROM_END_PX) / line) * 100;
    };

    // Frame `12` is 900px and draws 55%. Frame `12b` is 700px, and D30 re-cut
    // it to 45% — the same stop, transcribed for the shorter box.
    expect(stopPercent(900)).toBeCloseTo(55, 1);
    expect(stopPercent(700)).toBeCloseTo(45.2, 1);
  });
});
