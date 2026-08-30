import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * #169/#304: 1024 is its own breakpoint, and 768 is another.
 *
 * The numbers are READ OUT OF THE FRAMES at test time, never written down, and
 * asserted by **one table over the three drawn widths** rather than three
 * hand-written suites — a viewport that gets its own suite is a viewport that
 * quietly stops being asserted.
 *
 * This asserts the *ladder the source commits to*. What each rule computes to
 * in a real browser is `parity-checker`'s job; what this catches is the class
 * of regression that put 1024 on the desktop step and 768 on a step no frame
 * draws — which is what "1024 reads as compressed desktop" actually was.
 */

const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/**
 * The markup of one screen frame.
 *
 * Bounded at the next `data-screen-label` **or** the next card, whichever comes
 * first — the bundle nests responsive variants inside one card, so bounding on
 * the card alone swallows the neighbours.
 */
function frame(label: string): string {
  const start = frameHtml.indexOf(`data-screen-label="${label}"`);
  expect(start, `frame "${label}" is missing from the design file`).toBeGreaterThan(-1);

  const after = start + 1;
  const ends = [
    frameHtml.indexOf('data-screen-label="', after),
    frameHtml.indexOf('<div class="sc"', after),
  ].filter((index) => index !== -1);

  return frameHtml.slice(start, ends.length > 0 ? Math.min(...ends) : frameHtml.length);
}

/**
 * The page gutter a frame draws.
 *
 * The frame's outermost bars carry it as `padding: 0 Npx`, which is the same
 * number the hero block repeats as the middle value of `padding: Tpx Npx 0`.
 * Both are read and required to agree, so a frame that changes only one of them
 * fails here rather than silently picking whichever this function looked at.
 */
function frameGutter(label: string): number {
  const block = frame(label);

  const bar = /padding:0 (\d+)px/.exec(block.replace(/padding: /g, 'padding:'));
  const hero = /padding:(\d+)px (\d+)px 0/.exec(block.replace(/padding: /g, 'padding:'));

  expect(bar, `frame "${label}" draws no \`padding: 0 Npx\` bar`).not.toBeNull();
  expect(hero, `frame "${label}" draws no \`padding: Tpx Npx 0\` hero block`).not.toBeNull();

  const fromBar = Number((bar as RegExpExecArray)[1]);
  const fromHero = Number((hero as RegExpExecArray)[2]);
  expect(fromHero, `frame "${label}" disagrees with itself about the gutter`).toBe(fromBar);

  return fromBar;
}

/** The headline size and ratio a frame draws: its largest declared font-size. */
function frameHeadline(label: string): { size: number; lineHeight: number } {
  const block = frame(label);
  const sizes = [...block.matchAll(/font-size:([\d.]+)px/g)].map((m) => Number(m[1]));
  const size = Math.max(...sizes);

  const declaration = new RegExp(`font-size:${size}px;line-height:([\\d.]+)`).exec(block);
  expect(declaration, `frame "${label}" declares no line-height on its headline`).not.toBeNull();

  return { size, lineHeight: Number((declaration as RegExpExecArray)[1]) };
}

const read = (path: string): string => readFileSync(join(process.cwd(), 'src', path), 'utf8');

const pageSource = read(join('app', 'page.tsx'));
const headerSource = read(join('components', 'header-nav.tsx'));
const footerSource = read(join('components', 'site-footer.tsx'));
const themeSource = readFileSync(
  join(process.cwd(), '..', '..', 'packages', 'config', 'tailwind', 'theme.css'),
  'utf8',
);

/**
 * The three drawn widths, and the Tailwind variant that selects each.
 *
 * `min-[90rem]` rather than `xl`, because 1440 is the width the frame is drawn
 * at and 1280 is not a width anything in this bundle draws. `/search` already
 * steps its own gutter the same way.
 */
const VIEWPORTS = [
  { width: 768, label: '14 Landing tablet', variant: '' },
  { width: 1024, label: '27 Landing — 1024', variant: 'lg:' },
  { width: 1440, label: '01 Landing', variant: 'min-[90rem]:' },
] as const;

/** px → the Tailwind spacing unit that renders it; the scale is 4px per unit. */
const unit = (px: number): number => px / 4;

describe('the landing gutter is the frames own, at each width they draw', () => {
  /*
   * The three of them together, because the defect was never one wrong number
   * — it was the header, the page and the footer each on a different ladder,
   * which puts the logo out of line with the hero copy by 8-12px at exactly
   * the widths #169 is about.
   */
  const SOURCES = [
    { name: 'page.tsx', source: pageSource },
    { name: 'header-nav.tsx', source: headerSource },
    { name: 'site-footer.tsx', source: footerSource },
  ] as const;

  it.each(VIEWPORTS)('$label draws a gutter this suite can read', ({ label }) => {
    expect(frameGutter(label)).toBeGreaterThan(0);
  });

  /*
   * The 768 step is the *effective* value at 768, which may be written
   * unprefixed or with `sm:` — 640 is below 768, so `sm:px-5` is in force
   * there. The header needs the distinction: six `14 … mobile` frames draw it
   * at 16px, so its unprefixed base is 16 and its 768 value rides on `sm:`.
   * The page and footer have no narrower frame to answer and state 20 flat.
   */
  it.each(VIEWPORTS)('the page, header and footer all step to $width', ({ label, variant }) => {
    const gutter = frameGutter(label);
    const utility = `px-${unit(gutter)}`;
    const variants = variant === '' ? ['', 'sm:'] : [variant];

    for (const { name, source } of SOURCES) {
      const found = variants.some((prefix) =>
        new RegExp(`(?:^|[\\s'\`"])${(prefix + utility).replace(/[[\]]/g, '\\$&')}(?![\\d.])`).test(
          source,
        ),
      );

      expect(
        found,
        `${name} has no \`${variants.map((p) => p + utility).join('\` or \`')}\` for the ` +
          `${gutter}px gutter frame "${label}" draws`,
      ).toBe(true);
    }
  });

  /*
   * The specific regression: 1024 must not be on the same step as 1440, and
   * 768 must not be on a step no frame draws. Asserted as an inequality over
   * the frames rather than as three constants, so a re-import that genuinely
   * unifies two widths updates this instead of failing it.
   */
  it('gives 768, 1024 and 1440 three different gutters', () => {
    const gutters = VIEWPORTS.map((viewport) => frameGutter(viewport.label));

    expect(new Set(gutters).size, `the frames draw ${gutters.join('/')}`).toBe(3);
    expect(gutters[0]).toBeLessThan(gutters[1] as number);
    expect(gutters[1]).toBeLessThan(gutters[2] as number);
  });
});

describe('the hero headline steps at every width a frame draws one', () => {
  it.each(VIEWPORTS)('carries the $width headline size and its own ratio', ({ label }) => {
    const { size, lineHeight } = frameHeadline(label);

    /*
     * The size reaches the page through a named token, so both halves are
     * checked: the token holds the frame's px and the frame's ratio, and the
     * headline selects that token at that width.
     */
    const token = new RegExp(
      `--text-([a-z-]+):\\s*${size}px;\\s*--text-\\1--line-height:\\s*${lineHeight}\\b`,
    ).exec(themeSource);

    expect(
      token,
      `no type token is ${size}px at line-height ${lineHeight}, which is what "${label}" draws`,
    ).not.toBeNull();

    const name = (token as RegExpExecArray)[1] as string;
    expect(
      new RegExp(`(?:^|[\\s'\`"])(?:[a-z]+:|min-\\[90rem\\]:)?text-${name}(?![\\w-])`).test(
        pageSource,
      ),
      `page.tsx never selects \`text-${name}\`, the ${size}px step for "${label}"`,
    ).toBe(true);
  });

  /*
   * A single hardcoded `leading-` on the headline silently overrides the ratio
   * every one of those tokens carries — and the frames do not agree on one
   * ratio, so that is a real error at whichever width differs rather than a
   * tidiness point. 768 is the width that differs.
   */
  it('lets each size token bring its own ratio, rather than pinning one', () => {
    const headline = /<h1 className="([^"]*font-display[^"]*)"/.exec(pageSource);
    expect(headline, 'no display h1 in page.tsx').not.toBeNull();

    const classes = (headline as RegExpExecArray)[1] as string;
    expect(
      /(?:^|\s)(?:[a-z]+:|min-\[90rem\]:)?leading-/.test(classes),
      `the hero h1 pins a line-height (${classes}), overriding all four tokens`,
    ).toBe(false);

    const ratios = VIEWPORTS.map((viewport) => frameHeadline(viewport.label).lineHeight);
    expect(
      new Set(ratios).size,
      'the frames would have to agree for a pin to be harmless',
    ).toBeGreaterThan(1);
  });
});
