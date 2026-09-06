import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { AUTH_PANELS, SCRIM_MID_STOP_FROM_END_PX } from './auth-screen';

/**
 * The sign-up panel's contrast, held to the blanket 4.5:1 in
 * `01-foundations.md`. Ruled 2026-09-04 (D30): no large-text carve-out, the
 * scrim stays, and the colours moved instead.
 *
 * **Nothing else in the repository checks this.** The panel's copy sits on a
 * photograph, so its ground is the scrim composited over whatever that
 * photograph happens to be — and `21-sign-up.md` guarantees legibility against
 * a **pure white** backdrop, the worst any photograph can present, so the
 * guarantee survives swapping the asset.
 *
 * Every input comes from an artefact: the inks and the wash from `AUTH_PANELS`,
 * the wash's stops from the design frames themselves. The one thing that cannot
 * be derived here is where each line box lands, which needs layout — so the
 * coverages in `LINE_BOXES` are `#385`'s browser measurements, and the
 * **parity** block below is what keeps them honest by pinning the gradient they
 * were measured on to the frames that specify it.
 */

// Vitest runs with the package root as cwd, which is where vitest.config.ts sits.
const source = readFileSync(join(process.cwd(), 'src/components/auth/auth-screen.tsx'), 'utf8');
const frames = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

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

interface Ink {
  color: Rgb;
  /** Tailwind's `/NN` opacity suffix, or 1 where the class carries none. */
  opacity: number;
}

/** A Tailwind text utility — `text-gold-150`, `text-stone-0/82` — resolved. */
function ink(utility: string): Ink {
  const match = /^text-([a-z]+-\d+)(?:\/(\d+))?$/.exec(utility);

  if (!match) {
    throw new Error(`Not a themed text utility: ${utility}`);
  }

  return {
    color: token(match[1] as string),
    opacity: match[2] === undefined ? 1 : Number(match[2]) / 100,
  };
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
  /** Where the stop sits on the gradient line, as a fraction of its length. */
  at: number;
}

interface Scrim {
  angle: number;
  stops: readonly ScrimStop[];
}

/**
 * The panel's width, which the gradient line's length depends on. Read off the
 * component so the arithmetic below cannot drift from the box it describes;
 * Tailwind's spacing scale is 0.25rem a step, so `w-150` is 600px.
 */
const PANEL_WIDTH_PX = (() => {
  const match = /className="relative hidden w-([\d.]+) shrink-0/.exec(source);

  if (!match) {
    throw new Error('The marketing panel no longer sets its width with a `w-*` utility');
  }

  return Number(match[1]) * 4;
})();

/** The length of a `Ndeg` gradient line across the panel at a given height. */
function gradientLine(angle: number, height: number): number {
  const radians = (angle * Math.PI) / 180;

  return Math.abs(PANEL_WIDTH_PX * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
}

/**
 * A `linear-gradient(…)` declaration, with every stop placed as a fraction of
 * the gradient line so a `%` stop and a `calc(100% - Npx)` one are comparable.
 *
 * Handles both spellings on purpose: the frames write percentages and the
 * component writes a distance from the end, and the whole point of the parity
 * block is that those two describe the same gradient.
 */
function parseScrim(css: string, height: number): Scrim {
  const angle = Number(/linear-gradient\(\s*([\d.]+)deg/.exec(css)?.[1]);

  if (Number.isNaN(angle)) {
    throw new Error(`No angle in gradient: ${css}`);
  }

  const line = gradientLine(angle, height);
  const stops = [
    ...css.matchAll(
      /rgba\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)\s*(?:calc\(\s*100%\s*-\s*([\d.]+)px\s*\)|([\d.]+)%)/g,
    ),
  ].map((match) => ({
    color: [Number(match[1]), Number(match[2]), Number(match[3])] as Rgb,
    alpha: Number(match[4]),
    at: match[5] === undefined ? Number(match[6]) / 100 : (line - Number(match[5])) / line,
  }));

  if (stops.length !== 3) {
    throw new Error(`Expected a three-stop scrim, parsed ${stops.length}: ${css}`);
  }

  return { angle, stops };
}

/**
 * The scrim colour where its coverage is `alpha`, composited over a white
 * photograph.
 *
 * Coverage rises monotonically from the top stop to the bottom one, so a
 * measured α names a point on the gradient line without needing its pixel
 * offset. The hue is interpolated **premultiplied**, which is how a browser
 * interpolates a gradient between two colours of differing alpha.
 */
function groundAt({ stops }: Scrim, alpha: number): Rgb {
  const [top, mid, bottom] = stops as readonly [ScrimStop, ScrimStop, ScrimStop];
  const [from, to] = alpha <= mid.alpha ? ([top, mid] as const) : ([mid, bottom] as const);
  const progress = (alpha - from.alpha) / (to.alpha - from.alpha);

  const color = [0, 1, 2].map((index) => {
    const start = (from.color[index] as number) * from.alpha;
    const end = (to.color[index] as number) * to.alpha;

    return (start + (end - start) * progress) / alpha;
  }) as unknown as Rgb;

  return composite(color, alpha, [255, 255, 255]);
}

/**
 * The gradient a frame draws, taken from the design file itself.
 *
 * `from` is a marker unique to the frame's markup and `count` the number of
 * washes it draws — one for `12`, two for `12b`'s pair of panels. It has to be
 * the heading span rather than the bare id: frame `12`'s own blurb ends with
 * "see 12b", which sits *before* `12`'s markup, so a looser marker silently
 * measures the wrong frame.
 */
function frameScrims(from: string, count: number): string[] {
  const start = frames.indexOf(from);

  if (start < 0) {
    throw new Error(`Frame marker not found in the design file: ${from}`);
  }

  const found = [
    ...frames
      .slice(start)
      .matchAll(/linear-gradient\([\d.]+deg,(?:\s*rgba\([^)]+\)\s*[\d.]+%,?)+\)/g),
  ]
    .slice(0, count)
    .map((match) => match[0]);

  if (found.length !== count) {
    throw new Error(`Expected ${count} gradient(s) after ${from}, found ${found.length}`);
  }

  return found;
}

/**
 * Each panel, with the frame that specifies its wash and that frame's own panel
 * height — which is the whole subject of D30 §4. Frame `12` is 900px and draws
 * its mid stop at 55%; `12b`'s two are 700px and draw 45%, where `12`'s 55%
 * lands once the box is 200px shorter.
 */
const PANELS = [
  { role: 'both', frame: frameScrims('data-screen-label="12 Sign up"', 1)[0], height: 900 },
  { role: 'customer', frame: frameScrims('class="sc-n">12b<', 2)[0], height: 700 },
  { role: 'vendor', frame: frameScrims('class="sc-n">12b<', 2)[1], height: 700 },
] as const;

/**
 * Every line box on a panel, with the scrim coverage `#385` measured at its
 * centre in a browser (`01-foundations.md`). All three panels are one geometry
 * in the app — the column is `min-h-dvh` and the scrim is anchored in pixels
 * from the bottom — so frame `12`'s coverages are the panel's coverages
 * whichever role is selected.
 *
 * `ink: null` means the panel's own accent, which is the node D30 moved.
 */
const LINE_BOXES = [
  { node: 'headline', alpha: 0.672, ink: 'text-stone-0' },
  { node: 'italic accent', alpha: 0.704, ink: null },
  { node: 'body', alpha: 0.717, ink: 'text-stone-0/82' },
  { node: 'guarantee', alpha: 0.789, ink: 'text-stone-0/90' },
] as const;

/** The `both` panel's three side labels, which no other panel draws. */
const SIDE_LABEL_COVERAGE = [0.789, 0.804, 0.822] as const;

describe('the sign-up panel', () => {
  /*
   * The parity half. The coverages above are browser measurements of a
   * particular gradient, so they mean nothing unless that gradient is the one
   * the frames specify — and `washFor`'s own docstring is not evidence. Every
   * stop, the angle and the mid stop's position are compared against the design
   * file, at each frame's own panel height.
   */
  describe('draws the wash its frame specifies', () => {
    for (const { role, frame, height } of PANELS) {
      const drawn = parseScrim(AUTH_PANELS[role].wash, height);
      const specified = parseScrim(frame, height);

      it(`${role}: same angle and stops as the frame`, () => {
        expect(drawn.angle).toBe(specified.angle);
        expect(drawn.stops.map((stop) => [stop.color, stop.alpha])).toEqual(
          specified.stops.map((stop) => [stop.color, stop.alpha]),
        );
      });

      /*
       * The one number D30 re-derived rather than transcribed. A percentage
       * guarantees a shape; the panel is `min-h-dvh`, so only a distance from
       * the end of the line puts the same ink under a given line of copy at
       * every viewport height.
       */
      it(`${role}: same mid stop as the frame, at the frame's own height`, () => {
        expect(drawn.stops[1]?.at).toBeCloseTo(specified.stops[1]?.at as number, 2);
      });
    }

    it('anchors that stop in pixels, so a shorter panel re-derives it', () => {
      const at = (height: number): number =>
        ((gradientLine(200, height) - SCRIM_MID_STOP_FROM_END_PX) / gradientLine(200, height)) *
        100;

      expect(at(900)).toBeCloseTo(55, 1);
      expect(at(700)).toBeCloseTo(45.2, 1);
    });
  });

  /*
   * The contrast half, against a pure white photograph. The blanket floor
   * applies with no large-text carve-out — the 38px italic accent is the node
   * that asked for one and was refused (D30). `gold-200` there measures 3.80;
   * `gold-150` measures 4.67.
   */
  describe('clears AA over any photograph', () => {
    for (const { role } of PANELS) {
      const panel = AUTH_PANELS[role];
      const scrim = parseScrim(panel.wash, 900);

      for (const box of LINE_BOXES) {
        it(`${role}: the ${box.node} clears 4.5:1 against white`, () => {
          const ground = groundAt(scrim, box.alpha);
          const { color, opacity } = ink(box.ink ?? panel.accentClass);

          expect(contrast(composite(color, opacity, ground), ground)).toBeGreaterThanOrEqual(4.5);
        });
      }

      /*
       * 9.5px uppercase at 700 weight is not large text under any reading, and
       * `#306` recorded the substitution that dropped `VENDING` to 3.68 — so
       * these are read off the component rather than restated here.
       */
      panel.sideLabels?.forEach((label, index) => {
        it(`${role}: the ${label} label clears 4.5:1 against white`, () => {
          const ground = groundAt(scrim, SIDE_LABEL_COVERAGE[index] as number);
          const { color, opacity } = ink(panel.sideLabelClasses[index] as string);

          expect(contrast(composite(color, opacity, ground), ground)).toBeGreaterThanOrEqual(4.5);
        });
      });
    }
  });
});
