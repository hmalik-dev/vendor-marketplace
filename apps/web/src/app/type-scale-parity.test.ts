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
 * #198 adds the other two axes. The frames draw five roles the scale had no
 * step for — `.lbl`, `.tn` and the card meta line — so the scale gains them
 * rather than the components rounding to the nearest step they already had.
 *
 * Scope: `line-height`, `font-size` and `letter-spacing`.
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
const THEME_TRACKING = themeTokens(/--tracking-([a-z0-9-]+):\s*([^;]+);/g);
/*
 * A step and its companions share the `--text-` prefix, so the name alone does
 * not separate them. Only a size is written in `px` — the companions are a
 * ratio or an em — which is what makes this pattern select the scale itself.
 */
const THEME_FONT_SIZES = new Map<string, number>(
  [...themeTokens(/--text-([a-z0-9-]+):\s*([\d.]+)px;/g)].map(([name, size]) => [
    name,
    Number.parseFloat(size),
  ]),
);

/** The declaration body of every class rule in the frame stylesheet, by name. */
const FRAME_RULES = new Map<string, string>(
  [...frameHtml.matchAll(/\.([A-Za-z][\w-]*)\s*\{([^}]*)\}/g)].map((rule) => [
    rule[1] as string,
    rule[2] as string,
  ]),
);

/**
 * The line-height of every class the frame stylesheet declares, by class name.
 * Both spellings are in use: `.tn` sets type with the `font:` shorthand and a
 * `/1.5`, `.inp` with longhand. A class that sets neither computes `normal`.
 */
const FRAME_LINE_HEIGHTS = new Map<string, string>(
  [...FRAME_RULES].map(([name, body]) => {
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

    return [name, longhand?.[1] ?? shorthand?.[1] ?? 'normal'];
  }),
);

/**
 * The font-size of every class that declares one, in px. Both spellings again:
 * `.lbl` and `.tn` carry the size inside the `font:` shorthand, while `.inp`,
 * `.sh` and `.h2` use a `font-size` longhand.
 */
const FRAME_FONT_SIZES = new Map<string, number>(
  [...FRAME_RULES].flatMap(([name, body]): Array<[string, number]> => {
    const declared = /font-size:\s*([\d.]+)px/.exec(body) ?? /font:[^;]*?([\d.]+)px/.exec(body);

    return declared ? [[name, Number.parseFloat(declared[1] as string)]] : [];
  }),
);

/** The letter-spacing of every class that declares one, as written. */
const FRAME_LETTER_SPACING = new Map<string, string>(
  [...FRAME_RULES].flatMap(([name, body]): Array<[string, string]> => {
    const declared = /letter-spacing:\s*([^;]+)/.exec(body);

    return declared ? [[name, (declared[1] as string).trim()]] : [];
  }),
);

function frameLineHeight(name: string): string {
  const found = FRAME_LINE_HEIGHTS.get(name);

  if (found === undefined) {
    throw new Error(`No .${name} rule in the frame stylesheet.`);
  }

  return found;
}

/** An `em` length as a number, so `.05em` and `0.05em` compare equal. */
function emValue(declared: string | undefined): number {
  return Number.parseFloat(declared?.trim().replace(/em$/, '') ?? '');
}

function frameFontSize(name: string): number {
  const found = FRAME_FONT_SIZES.get(name);

  if (found === undefined) {
    throw new Error(`No .${name} rule with a font-size in the frame stylesheet.`);
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
 * `.lbl`, `.tl` and `.tn` reach a token as of #198, which gave the roles the
 * frames draw between the t-shirt steps a step of their own. Before that they
 * were `text-[10.5px]` and `text-[11.5px]` — arbitrary sizes, which emit no
 * line-height and so never reached this table at all.
 *
 * `.pill` and `.card` still earn no row: the app renders both through a scale
 * step it shares with other roles.
 */
const STEP_FOR_FRAME_CLASS: Array<[string, string]> = [
  ['xs', 'pill'],
  ['label', 'lbl'],
  ['label', 'tl'],
  ['base', 'inp'],
  ['base', 'btnP'],
  ['base', 'btnS'],
  ['base', 'nav'],
  ['display-sm', 'sh'],
  ['display-md', 'h2'],
];

/*
 * Steps that take the frames' default measure, left at `normal` unless the text
 * wraps. `sm`, `md`, `lg` and `meta` have no frame class of their own.
 *
 * `helper` does have one, and it is the exception that proves the rule: `.tn`
 * sets `11.5px/1.5`, but that is 7 of the 118 places the frames draw 11.5px.
 * The other 108 — the field-error lines of frame `22` among them — set no
 * line-height at all, so the ratio belongs to `.tn`'s call site, not the step.
 */
const STEPS_AT_THE_FRAME_DEFAULT = ['sm', 'md', 'lg', 'meta', 'helper', 'action', 'cta'];

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

  it.each(STEPS_AT_THE_FRAME_DEFAULT)('--text-%s--line-height is the frame default', (step) => {
    expect(THEME_LINE_HEIGHTS.get(step)).toBe('normal');
  });

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

/*
 * #198. The size each frame class is rendered through. Four of the five roles
 * the ticket names are a class in the frame stylesheet, so the size is read
 * from the contract rather than written down here.
 *
 * `.inp` earns a row even though `base` already matches it, so that a later
 * edit to either side is caught. It does **not** pin what actually broke `.inp`
 * at 1440 — shadcn's `md:text-sm` on the shared controls, which lives in a
 * component and cannot move a theme token. `the shared form controls` below is
 * what guards that.
 */
const SIZE_STEP_FOR_FRAME_CLASS: Array<[string, string]> = [
  ['label', 'lbl'],
  ['label', 'tl'],
  ['helper', 'tn'],
  ['base', 'inp'],
  ['display-sm', 'sh'],
  ['display-md', 'h2'],
];

/** `stone-600`, the muted text colour, read from the theme rather than retyped. */
const STONE_600 = (/--color-stone-600:\s*(#[0-9a-f]{6})/i.exec(themeCss)?.[1] ?? '').toLowerCase();

/**
 * Card meta is the one role the frames give no class: they set it inline on the
 * rating line, which the `★` glyph identifies uniquely and `stone-600`
 * separates from the bold `stone-700` rating in the profile header.
 *
 * The frames disagree with themselves here — 12px on `02 Search & browse` and
 * `04 Booking request`, 12.5px inside `14 Adaptations — tablet 768 & mobile
 * 390`. The parity gate measures 1440x900, so the desktop value wins, and it is
 * also the one the frames draw most often. Taking the mode rather than naming a
 * number keeps that decision tied to the contract.
 */
const CARD_META_PX = ((): number | undefined => {
  const tally = new Map<number, number>();

  for (const match of frameHtml.matchAll(/style="([^"]*)"[^>]*>\s*★/g)) {
    const style = match[1] as string;
    const size = /font-size:\s*([\d.]+)px/.exec(style);

    if (!size || !style.toLowerCase().includes(STONE_600)) {
      continue;
    }

    const px = Number.parseFloat(size[1] as string);

    tally.set(px, (tally.get(px) ?? 0) + 1);
  }

  return [...tally.entries()].sort(([, a], [, b]) => b - a)[0]?.[0];
})();

/**
 * The markup of one frame, by its `data-screen-label`. A size that only some
 * frames draw has to be read from the frame that draws it: `action` and `cta`
 * below are both anchored to `01 Landing`, because across the whole file the
 * shapes that carry them appear at several sizes and the shape alone would not
 * fix one.
 */
function frameMarkup(label: string): string {
  const start = frameHtml.indexOf(`data-screen-label="${label}"`);

  if (start < 0) {
    throw new Error(`No frame labelled ${label}.`);
  }

  const next = frameHtml.indexOf('class="fr"', start);

  return next < 0 ? frameHtml.slice(start) : frameHtml.slice(start, next);
}

const LANDING = frameMarkup('01 Landing');

/** The font-size of the one inline style in `markup` matching every fragment. */
function inlineSizeWhere(markup: string, ...fragments: string[]): number {
  const sizes = new Set<number>();

  for (const attribute of markup.matchAll(/style="([^"]*)"/g)) {
    const style = attribute[1] as string;

    if (!fragments.every((fragment) => style.includes(fragment))) {
      continue;
    }

    const size = /font-size:\s*([\d.]+)px/.exec(style);

    if (size) {
      sizes.add(Number.parseFloat(size[1] as string));
    }
  }

  if (sizes.size !== 1) {
    throw new Error(`${sizes.size} sizes match [${fragments.join(', ')}] in the frame, wanted 1.`);
  }

  return [...sizes][0] as number;
}

describe('type scale font-size and letter-spacing parity with the design frames', () => {
  it.each(SIZE_STEP_FOR_FRAME_CLASS)(
    '--text-%s is the size the frames draw .%s at',
    (step, frameName) => {
      expect(THEME_FONT_SIZES.get(step)).toBe(frameFontSize(frameName));
    },
  );

  it('--text-meta is the size the frames draw the card meta line at', () => {
    expect(STONE_600).toMatch(/^#[0-9a-f]{6}$/);
    expect(CARD_META_PX).toBeGreaterThan(0);
    expect(THEME_FONT_SIZES.get('meta')).toBe(CARD_META_PX);
  });

  /*
   * #83, #86. `action` is the size frame `01 Landing` gives an action that is
   * not a form control. It draws two, and they agree: the header's dark
   * sign-up pill, and the plain `All N categories →` link that opens the
   * category section. Both are read from the frame so neither side can drift.
   */
  it('--text-action is the size frame 01 Landing draws its header CTA pill at', () => {
    expect(THEME_FONT_SIZES.get('action')).toBe(
      inlineSizeWhere(LANDING, 'background:#23201C', 'border-radius:999px'),
    );
  });

  it('--text-action is also the size that frame draws its section action link at', () => {
    expect(THEME_FONT_SIZES.get('action')).toBe(inlineSizeWhere(LANDING, 'color:#A34A28'));
  });

  /*
   * #84, #86. `cta` is the size frame `01 Landing` draws its hero submit at —
   * the filled clay pill in the search bar. The shape is no more decisive here
   * than it is for `action`: the frames draw a clay 999px pill at 10, 11,
   * 12.5, 13 and 14px, so the size is read from this frame.
   */
  it('--text-cta is the size frame 01 Landing draws its hero submit at', () => {
    expect(THEME_FONT_SIZES.get('cta')).toBe(
      inlineSizeWhere(LANDING, 'background:#B4552F', 'border-radius:999px'),
    );
  });

  it('--tracking-label is the tracking the frame gives .lbl', () => {
    /*
     * Compared as a number, not as text: `.05em` and `0.05em` are the same
     * tracking, and the frame and a formatter need not agree on the zero.
     */
    const frameEm = emValue(FRAME_LETTER_SPACING.get('lbl'));

    expect(Number.isFinite(frameEm)).toBe(true);
    expect(emValue(THEME_TRACKING.get('label'))).toBe(frameEm);
  });

  /*
   * #165's ruling, kept executable: tracking follows the role, not the size
   * step. The frames hold `.h2` at `-.01em` across six sizes and give eight
   * inline serif spans at 26px no tracking at all, so a `--text-*` companion
   * would bind it to the wrong thing. `--tracking-*` names the role instead.
   */
  it('no scale step carries a letter-spacing companion', () => {
    expect([...themeCss.matchAll(/--text-[a-z0-9-]+--letter-spacing/g)]).toEqual([]);
  });

  /*
   * The frames draw `.inp` at one size at every width, and the app's fields are
   * the shadcn primitives. shadcn ships them with `md:text-sm`, which took every
   * field to 12.5px from 768px up — including the 1440 the parity gate measures
   * — while `text-base` on the same element said 13.5px.
   *
   * The token rows above cannot see this: they compare the theme to the frame,
   * and a responsive variant lives in the component. Re-adding `md:text-sm` left
   * the whole suite green, which is why this reads the components directly.
   */
  it.each(['input.tsx', 'textarea.tsx', 'select.tsx'])(
    'the shared form controls hold one font size at every width: %s',
    (file) => {
      const source = readFileSync(join(process.cwd(), 'src/components/ui', file), 'utf8');
      const responsive = source.match(/\b(?:sm|md|lg|xl|2xl):text-[a-z0-9.[\]-]+/g) ?? [];

      expect(responsive).toEqual([]);
    },
  );
});
