import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * #74. The design frames are the type scale's acceptance criterion, and they
 * set `line-height` on almost nothing: every UI class computes `normal`, and
 * the ratios that do appear are set inline, on prose and on the hero headline.
 *
 * Every expectation below is derived from the frame file at test time rather
 * than written down as a number, so the theme cannot drift from the contract
 * and a design re-import that changes the frames fails here instead of passing
 * silently.
 *
 * Scope: `line-height` only. `font-size` and `letter-spacing` belong to #198.
 */

const require = createRequire(import.meta.url);
const themeCss = readFileSync(
  require.resolve('@vendor-marketplace/config/tailwind/theme.css'),
  'utf8',
);
/*
 * Vitest runs with the package root as cwd, which is where vitest.config.mts
 * sits. The frame file is named after the product, so the name is read from
 * `BRAND_NAME` rather than written out — the same law the rest of the app obeys.
 */
const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/** Every `--<prefix><name>: <value>` in the theme, by name. */
function themeTokens(pattern: RegExp): Map<string, string> {
  return new Map(
    [...themeCss.matchAll(pattern)].map((match) => [
      match[1] as string,
      (match[2] as string).trim(),
    ]),
  );
}

const THEME_LINE_HEIGHTS = themeTokens(/--text-([a-z0-9-]+)--line-height:\s*([^;]+);/g);
const THEME_LEADING = themeTokens(/--leading-([a-z0-9-]+):\s*([^;]+);/g);

/**
 * The line-height of every class the frame stylesheet declares, by class name.
 * Both spellings are in use: `.tn` sets type with the `font:` shorthand and a
 * `/1.5`, `.inp` with longhand. A class that sets neither computes `normal`.
 */
const FRAME_LINE_HEIGHTS = new Map<string, string>(
  [...frameHtml.matchAll(/\.([A-Za-z][\w-]*)\s*\{([^}]*)\}/g)].map((rule) => {
    const body = rule[2] as string;
    const longhand = /line-height:\s*([\d.]+)/.exec(body);
    /*
     * The `font:` shorthand carries the ratio after a slash. Everything before
     * the size is optional and unordered in CSS — `font:600 11.5px/1.5`,
     * `font:11.5px/1.5`, `font:600 italic 11.5px / 1.5` are all valid — so this
     * anchors on `<size>px / <ratio>` rather than on a leading integer weight.
     * Matching too narrowly here fails *open*: an unrecognised shorthand reads
     * as `normal`, which is exactly the drift this file exists to catch.
     */
    const shorthand = /font:[^;]*?[\d.]+px\s*\/\s*([\d.]+)/.exec(body);

    return [rule[1] as string, longhand?.[1] ?? shorthand?.[1] ?? 'normal'];
  }),
);

function frameLineHeight(name: string): string {
  const found = FRAME_LINE_HEIGHTS.get(name);

  if (found === undefined) {
    throw new Error(`No .${name} rule in the frame stylesheet.`);
  }

  return found;
}

interface InlineType {
  /** `null` when the frame sets a ratio without restating the size. */
  readonly fontSize: number | null;
  readonly lineHeight: string;
}

/** Every ratio the frames set inline, with the size it was set at. */
const INLINE_TYPE: InlineType[] = [];
/** The ratios the frames set inline at one font-size, so 54px yields `['1.04']`. */
const INLINE_RATIOS_BY_SIZE = new Map<number, Set<string>>();

for (const attribute of frameHtml.matchAll(/style="([^"]*)"/g)) {
  const style = attribute[1] as string;
  const ratio = /line-height:\s*([\d.]+)/.exec(style);

  if (!ratio) {
    continue;
  }

  const lineHeight = ratio[1] as string;
  const size = /font-size:\s*([\d.]+)px/.exec(style);
  const fontSize = size ? Number.parseFloat(size[1] as string) : null;

  INLINE_TYPE.push({ fontSize, lineHeight });

  if (fontSize !== null) {
    const atSize = INLINE_RATIOS_BY_SIZE.get(fontSize) ?? new Set<string>();

    atSize.add(lineHeight);
    INLINE_RATIOS_BY_SIZE.set(fontSize, atSize);
  }
}

/** Every ratio the frames use anywhere, inline or in the stylesheet. */
const FRAME_RATIOS = [
  ...new Set([
    ...INLINE_TYPE.map((type) => type.lineHeight),
    ...[...FRAME_LINE_HEIGHTS.values()].filter((value) => value !== 'normal'),
  ]),
];

/** The ratio the frames reach for most often across a slice of their inline type. */
function modalRatio(matches: (type: InlineType) => boolean): string {
  const tally = new Map<string, number>();

  for (const type of INLINE_TYPE.filter(matches)) {
    tally.set(type.lineHeight, (tally.get(type.lineHeight) ?? 0) + 1);
  }

  return [...tally.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] as string;
}

/**
 * `display-lg` is the one step with a ratio and no inline counterpart to match:
 * the frames draw display type at 27, 32, 33, 36, 38, 40 and 54px, never at 34.
 * So it takes the measure the frames give display type generally — anything at
 * or above the smallest size they treat as display.
 */
const DISPLAY_FLOOR_PX = 27;

/*
 * Every UI class the frames define. The `.sc-*` classes are deliberately
 * absent: they are the canvas chrome around the frames — the screen title and
 * its description — rather than part of any screen.
 */
const FRAME_UI_CLASSES = [
  'lbl',
  'inp',
  'nav',
  'btnP',
  'btnS',
  'pill',
  'card',
  'h2',
  'sh',
  'tl',
  'tn',
];

/*
 * The theme step each frame UI class is rendered through. The mapping is by
 * role, which is what line-height follows.
 *
 * `.inp` maps to `base` because the app's frame-parity fields — `FIELD_CONTROL`
 * in booking-request-screen.tsx and `FIELD` in customer-profile-form.tsx — are
 * `text-base`, 13.5px, which is the frame's size exactly. Only the shadcn
 * `ui/input.tsx` is 12.5px at desktop.
 *
 * `.pill` and `.card` earn no row: the app renders both through a scale step,
 * but `.lbl` and `.tl` are drawn at `text-[10.5px]` — an arbitrary size, which
 * emits no line-height at all and so never reaches this token. That is #235,
 * and it is why #74 could not close its own five controls.
 */
const STEP_FOR_FRAME_CLASS: Array<[string, string]> = [
  ['xs', 'pill'],
  ['base', 'inp'],
  ['base', 'btnP'],
  ['base', 'btnS'],
  ['base', 'nav'],
  ['display-sm', 'sh'],
  ['display-md', 'h2'],
];

/*
 * Steps with no frame UI class of their own. The frames set type at these sizes
 * inline and leave it at `normal` unless it wraps.
 */
const BODY_STEPS_WITHOUT_A_FRAME_CLASS = ['sm', 'md', 'lg'];

/* The hero is the one place the frames set a ratio on a heading. */
const HERO_STEPS: Array<[string, number]> = [
  ['display-xl', 54],
  ['display-hero-md', 40],
];

describe('type scale line-height parity with the design frames', () => {
  it('the frames set a line-height on exactly one UI class, .tn', () => {
    const withRatio = FRAME_UI_CLASSES.filter((name) => frameLineHeight(name) !== 'normal');

    expect(withRatio).toEqual(['tn']);
    expect(frameLineHeight('tn')).toBe('1.5');
  });

  it.each(STEP_FOR_FRAME_CLASS)(
    '--text-%s--line-height matches the frame class .%s it renders',
    (step, frameName) => {
      expect(THEME_LINE_HEIGHTS.get(step)).toBe(frameLineHeight(frameName));
    },
  );

  it.each(BODY_STEPS_WITHOUT_A_FRAME_CLASS)(
    '--text-%s--line-height is the frame default',
    (step) => {
      expect(THEME_LINE_HEIGHTS.get(step)).toBe('normal');
    },
  );

  it.each(HERO_STEPS)('--text-%s--line-height is the ratio the frame draws at %spx', (step, px) => {
    expect([...(INLINE_RATIOS_BY_SIZE.get(px) ?? [])]).toEqual([THEME_LINE_HEIGHTS.get(step)]);
  });

  it('--text-display-lg--line-height is the measure the frames give display type', () => {
    expect(THEME_LINE_HEIGHTS.get('display-lg')).toBe(
      modalRatio((type) => type.fontSize !== null && type.fontSize >= DISPLAY_FLOOR_PX),
    );
  });

  it('keeps only ratios the frames actually use', () => {
    const kept = [...THEME_LINE_HEIGHTS.entries()].filter(([, value]) => value !== 'normal');

    expect(kept.filter(([, value]) => !FRAME_RATIOS.includes(value))).toEqual([]);
  });

  /*
   * Acceptance: long-form prose keeps a readable measure. The frames give prose
   * one explicitly rather than through the scale, so the app does too — through
   * a named token, not an arbitrary `leading-[1.6]` repeated at each call site.
   *
   * `.tn`'s 1.5, the frames' other ratio, is already Tailwind's `leading-normal`
   * and deliberately gets no second name here.
   */
  it('names the prose measure, and takes its ratio from the frames', () => {
    expect(THEME_LEADING.get('prose')).toBe(modalRatio(() => true));

    for (const [, value] of THEME_LEADING) {
      expect(FRAME_RATIOS).toContain(value);
    }
  });
});
