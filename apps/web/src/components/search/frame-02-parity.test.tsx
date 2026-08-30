import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';

/*
 * Frames `02 Search` and `18 Search no results` are the acceptance criterion for
 * the search screen (#297), so every expectation below is READ OUT OF THE FRAME
 * at test time rather than written down as a number. A design re-import that
 * moves the contract fails here instead of passing silently.
 *
 * Same reader as `frame-03-parity.test.ts`. Duplicated rather than shared: the
 * two files are the only callers, and a shared helper module would have to be
 * imported by path from a third place that belongs to neither frame.
 */

const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/** The markup of one screen frame, selected by its `data-screen-label`. */
function frame(label: string): string {
  const start = frameHtml.indexOf(`data-screen-label="${label}"`);
  expect(start, `frame "${label}" is missing from the design file`).toBeGreaterThan(-1);

  // Frames are siblings, so the next one's marker is this one's end.
  const next = frameHtml.indexOf('data-screen-label="', start + 1);
  return frameHtml.slice(start, next === -1 ? frameHtml.length : next);
}

const FRAME_02 = frame('02 Search');
const FRAME_18 = frame('18 Search no results');

/** Every `style="..."` body in source order. */
function inlineStyles(markup: string): string[] {
  return [...markup.matchAll(/style="([^"]*)"/g)].map((match) => match[1] as string);
}

/** The first inline style whose body matches every fragment given. */
function styleContaining(markup: string, ...fragments: readonly string[]): string {
  const found = inlineStyles(markup).find((style) =>
    fragments.every((fragment) => style.includes(fragment)),
  );
  expect(found, `no inline style contains ${fragments.join(' + ')}`).toBeDefined();
  return found as string;
}

/** One declaration's value out of a style body. */
function declaration(style: string, property: string): string {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(style);
  expect(match, `"${property}" is missing from "${style}"`).not.toBeNull();
  return (match as RegExpExecArray)[1]!.trim();
}

afterEach(() => cleanup());

describe('frame 02 — the date clause is a sibling of the heading (#242)', () => {
  /*
   * The defect was a nesting one, so the frame's own nesting is the evidence:
   * the heading is a closed `<span class="h2">` and the `free on …` clause is
   * the span that FOLLOWS it, not one inside it. Nested, the accessible name
   * concatenates with no separator and the clause inherits the heading's
   * `letter-spacing`.
   */
  it('closes the heading span before the clause opens', () => {
    const heading = /<span class="h2"[^>]*>([^<]*)<\/span>(<span[^>]*>free on[^<]*<\/span>)/.exec(
      FRAME_02,
    );

    expect(
      heading,
      'frame 02 no longer draws the heading and the clause as siblings',
    ).not.toBeNull();
    expect((heading as RegExpExecArray)[1]).toContain('photographers in');
    expect((heading as RegExpExecArray)[2]).toContain('free on');
  });

  /*
   * The clause is body type in the frame — no `font-family`, so it inherits the
   * sans stack rather than the heading's serif, and no `letter-spacing`.
   */
  it('draws the clause without the heading’s serif or tracking', () => {
    const clauseStyle = inlineStyles(FRAME_02).find((style) =>
      /font-size:13px;color:#6B6459/.test(style),
    );

    expect(clauseStyle, 'frame 02 no longer draws the clause at 13px stone-600').toBeDefined();
    expect(clauseStyle).not.toContain('Instrument Serif');
    expect(clauseStyle).not.toContain('letter-spacing');
  });
});

describe('frame 02 — the header logo lockup (#244)', () => {
  /*
   * The lockup is a mark box and a gap, and the gap is the half that was wrong:
   * 7.5px rendered against the frame's 9px, which put the wordmark 1.5px early
   * on every desktop screen.
   *
   * `Logo` derives the gap from the diameter, so the assertion renders the real
   * component at the real header size and reads the value it computed — not the
   * ratio, which could be changed to any number that happens to please a unit.
   */
  const lockupStyle = styleContaining(FRAME_02, 'align-items:center;gap:', 'flex:none');
  const markStyle = styleContaining(FRAME_02, 'position:relative;width:', 'height:15px');

  it('renders the frame’s gap at the frame’s diameter', () => {
    const frameGap = declaration(lockupStyle, 'gap');
    const frameDiameter = Number.parseFloat(declaration(markStyle, 'height'));

    // The frame's mark is the size the desktop header asks for; if that ever
    // stops being true the gap below is being compared against the wrong frame.
    expect(frameDiameter).toBe(LOGO_SIZES.desktopHeader);

    render(<Logo size={LOGO_SIZES.desktopHeader} />);

    expect(screen.getByTestId('logo').style.gap).toBe(frameGap);
  });

  /*
   * 21 lockups at D=15 in the design file and every one of them draws 9px. The
   * gap is a brand constant, so a single frame agreeing with the code is not
   * enough evidence — the point is that no frame disagrees.
   */
  it('is the gap every 15px lockup in the design file draws', () => {
    const gaps = new Set(
      [
        ...frameHtml.matchAll(
          /align-items:center;gap:([\d.]+)px"><div style="position:relative;width:[\d.]+px;height:15px/g,
        ),
      ].map((match) => match[1] as string),
    );

    expect(gaps.size, `15px lockups disagree on their gap: ${[...gaps].join(', ')}`).toBe(1);

    render(<Logo size={LOGO_SIZES.desktopHeader} />);

    expect(screen.getByTestId('logo').style.gap).toBe(`${[...gaps][0]}px`);
  });
});

describe('frame 18 — the marketing empty state (#260)', () => {
  /*
   * `40-states.md` names two sizes for one component — 26px in-app, 30px
   * marketing — and frame `18` is the marketing one. Both numbers are read from
   * their own source: the size from the frame, the token from the theme, so a
   * token edit and a frame edit cannot silently pass each other.
   */
  const theme = readFileSync(
    join(process.cwd(), '..', '..', 'packages', 'config', 'tailwind', 'theme.css'),
    'utf8',
  );

  const headlineStyle = styleContaining(FRAME_18, "Instrument Serif',serif", 'margin-bottom:10px');
  const bodyStyle = styleContaining(FRAME_18, 'max-width:', 'text-align:center');

  it('sets --text-display-empty to the size the frame draws', () => {
    const token = /--text-display-empty:\s*([^;]+);/.exec(theme);

    expect(token, '--text-display-empty is missing from the theme').not.toBeNull();
    expect((token as RegExpExecArray)[1]!.trim()).toBe(declaration(headlineStyle, 'font-size'));
  });

  it('gives the sentence the frame’s measure, and the app scale a narrower one', () => {
    const emptyState = readFileSync(
      join(process.cwd(), 'src', 'components', 'ui', 'empty-state.tsx'),
      'utf8',
    );
    const measure = declaration(bodyStyle, 'max-width');

    expect(emptyState).toContain(`max-w-[${measure}]`);
    // The in-app measure is the one 40-states.md contrasts it with; if the two
    // ever collapse to one number the `scale` prop has stopped meaning anything.
    expect(emptyState).toContain('max-w-[420px]');
    expect(measure).not.toBe('420px');
  });
});

describe('frame 02 — the active chip’s clear affordance carries the law’s hit area (#245)', () => {
  /*
   * jsdom has no layout, so this cannot measure the rendered box — it guards
   * the utility that decides it, the same way `hit-area.test.ts` does, and reads
   * the law's own number rather than restating 44 here.
   */
  const laws = readFileSync(
    join(process.cwd(), '..', '..', 'design', 'design-plan', '04-laws.md'),
    'utf8',
  );
  const refineBar = readFileSync(
    join(process.cwd(), 'src', 'components', 'search', 'refine-bar.tsx'),
    'utf8',
  );

  it('grows the target to the law’s size without widening the chip', () => {
    const stated = /(\d+)×(\d+) hit area/.exec(laws);

    expect(stated, 'the law no longer states a hit area').not.toBeNull();
    const step = Number((stated as RegExpExecArray)[1]) / 4;

    // A pseudo-element, so the paint keeps the frame's `padding:7px 13px`.
    expect(refineBar).toContain(`after:size-${step}`);
    expect(refineBar).toContain("after:content-['']");
  });

  /*
   * Right-anchored, into the chip row's own gap. Centred, the target would
   * reach 19.5px over the trigger instead of 5.5 — so the direction is part of
   * the fix, not an incidental class.
   *
   * The gutter is asserted off the RENDERED row rather than by grepping the
   * source for `gap-2`: the file also contains `gap-2.5` on the tag-option
   * label, so the substring matched whatever the chip row actually said, and
   * the row could have been set to `gap-1` with this test still green.
   */
  it('anchors the target into the gap rather than centring it', () => {
    expect(refineBar).toContain('after:-right-2');
    // Centred, the target would reach 19.5px over the trigger instead of 5.5.
    expect(refineBar).not.toContain('after:-translate-x-1/2');
  });

  /*
   * The 6px between the label and the glyph is charged to the clear button, not
   * to the trigger — that is what takes the overlap from 11.47px to 5.5px, at
   * identical paint. Asserted as the pair, because either class alone would
   * move the glyph.
   */
  it('charges the label-to-glyph gap to the button that needs the width', () => {
    expect(refineBar).toContain("onClear ? 'pr-0' : 'pr-3.25'");
    expect(refineBar).toContain('pr-2.75 pl-2.5');
  });
});
