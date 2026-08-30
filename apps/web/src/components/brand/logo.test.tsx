import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo, LOGO_SIZES } from './logo';

/** The six diameters design/design-plan/02-brand-and-logo.md specifies. */
const EVERY_SIZE = Object.values(LOGO_SIZES);

describe('Logo', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the wordmark from BRAND_NAME rather than a literal', () => {
    render(<Logo size={LOGO_SIZES.authPanel} />);

    expect(screen.getByTestId('logo-wordmark').textContent).toBe(BRAND_NAME);
  });

  it('exposes one accessible name for the whole lockup', () => {
    render(<Logo size={LOGO_SIZES.authPanel} />);

    expect(screen.getByRole('img', { name: BRAND_NAME })).toBeTruthy();
    // The mark is decorative once the lockup is labelled.
    expect(screen.getByTestId('logo-mark').getAttribute('aria-hidden')).toBe('true');
  });

  it.each(EVERY_SIZE)('derives every dimension from size %ipx', (size) => {
    render(<Logo size={size} />);

    const mark = screen.getByTestId('logo-mark');
    const fill = screen.getByTestId('logo-mark-fill');
    const stroke = screen.getByTestId('logo-mark-stroke');

    // The right circle is offset by 0.45 D, so the lockup spans 1.45 D.
    expect(mark.style.width).toBe(`${size * 1.45}px`);
    expect(mark.style.height).toBe(`${size}px`);
    expect(fill.style.width).toBe(`${size}px`);
    expect(stroke.style.width).toBe(`${size}px`);
    // The right circle's left edge sits at 0.45 D.
    expect(stroke.style.left).toBe(`${size * 0.45}px`);
    // Stroke is 8% of the diameter.
    expect(stroke.style.borderWidth).toBe(`${size * 0.08}px`);
    cleanup();
  });

  /*
   * The wordmark size is a ratio; the gap is not (#244). `marketingFooter` is
   * D=20, which no frame draws, so it is the size that exercises the fallback
   * ratio — and 0.6 lands it on the 12px the design file's own cover chrome
   * uses.
   */
  it('sets the wordmark at 1.6x the diameter and falls back to a 0.6 gap', () => {
    const size = LOGO_SIZES.marketingFooter;
    render(<Logo size={size} />);

    expect(screen.getByTestId('logo-wordmark').style.fontSize).toBe(`${size * 1.6}px`);
    expect(screen.getByTestId('logo').style.gap).toBe(`${size * 0.6}px`);
  });

  /*
   * The four diameters the frames DO draw, read out of the plan's own table so
   * the two cannot drift. A single ratio cannot satisfy them — 0.6 is exact at
   * D=15 and 1.4px out at the auth panel, which is what the first version of
   * #244 shipped.
   */
  it.each([
    ['Desktop header', LOGO_SIZES.desktopHeader],
    ['Mobile header', LOGO_SIZES.mobileHeader],
    ['Auth panel', LOGO_SIZES.authPanel],
  ])('gaps the %s lockup by the plan’s own number', (context, size) => {
    const plan = readFileSync(
      join(process.cwd(), '../../design/design-plan/02-brand-and-logo.md'),
      'utf8',
    );
    const row = new RegExp(`\\|\\s*${context}\\s*\\|[^|]*\\|[^|]*\\|\\s*(\\d+)px\\s*\\|`).exec(
      plan,
    );

    expect(row, `the plan states no gap for ${context}`).not.toBeNull();

    render(<Logo size={size} />);

    expect(screen.getByTestId('logo').style.gap).toBe(`${(row as RegExpExecArray)[1]}px`);
  });

  /*
   * The wordmark is dropped by asking for it, not by a size cutoff: the
   * desktop header sets D=15 and still shows it, as frame `01 Landing` renders
   * it. The favicon and app icon are the callers that ask for the mark alone.
   */
  it('keeps the wordmark at the desktop header diameter', () => {
    render(<Logo size={LOGO_SIZES.desktopHeader} />);

    expect(screen.getByTestId('logo-wordmark').textContent).toBe(BRAND_NAME);
  });

  it.each([LOGO_SIZES.favicon, LOGO_SIZES.appIcon, LOGO_SIZES.marketingFooter])(
    'drops the wordmark for the mark variant at %ipx',
    (size) => {
      render(<Logo size={size} variant="mark" />);

      expect(screen.queryByTestId('logo-wordmark')).toBeNull();
      expect(screen.getByTestId('logo-mark')).toBeTruthy();
      // The lockup still announces itself.
      expect(screen.getByRole('img', { name: BRAND_NAME })).toBeTruthy();
      cleanup();
    },
  );

  /*
   * #250. The two circles are equal as FILLS — a D-wide disc and a D-wide hole
   * — with the stroke drawn outside the D. `box-border` read "equal" as equal
   * footprints, which charged the stroke to the hole: at the desktop header a
   * 13px hole beside a 15px disc, so the outline circle sat visibly small
   * inside its own lockup.
   *
   * jsdom computes no box model, so the footprint cannot be measured here.
   * What decides it is the box-sizing, and that is asserted directly; the
   * rendered 17x17-over-15x15 is verified in the browser.
   */
  it.each(EVERY_SIZE)('sizes the stroke circle at %ipx of fill, not of footprint', (size) => {
    render(<Logo size={size} />);

    const stroke = screen.getByTestId('logo-mark-stroke');
    const fill = screen.getByTestId('logo-mark-fill');

    expect(stroke.className).toContain('box-content');
    expect(stroke.className).not.toContain('box-border');
    // The declared size is the FILL on both circles — that is what "equal
    // diameter" means, and it is why the stroke may overflow its own box.
    expect(stroke.style.width).toBe(fill.style.width);
    expect(stroke.style.height).toBe(fill.style.height);
    cleanup();
  });

  it('keeps clay as the fill on a cream ground', () => {
    render(<Logo size={LOGO_SIZES.authPanel} tone="light" />);

    expect(screen.getByTestId('logo-mark-fill').className).toContain('bg-clay-400');
    expect(screen.getByTestId('logo-mark-stroke').className).toContain('border-stone-900');
    expect(screen.getByTestId('logo-wordmark').className).toContain('text-stone-900');
  });

  it('keeps clay as the fill on an ink ground and lifts the stroke to cream', () => {
    render(<Logo size={LOGO_SIZES.authPanel} tone="dark" />);

    expect(screen.getByTestId('logo-mark-fill').className).toContain('bg-clay-400');
    expect(screen.getByTestId('logo-mark-stroke').className).toContain('border-stone-50');
    expect(screen.getByTestId('logo-wordmark').className).toContain('text-stone-50');
  });

  it('keeps the fill/stroke contrast in single colour, so it survives one-colour print', () => {
    render(<Logo size={LOGO_SIZES.authPanel} tone="mono" />);

    const fill = screen.getByTestId('logo-mark-fill');
    const stroke = screen.getByTestId('logo-mark-stroke');

    expect(fill.className).toContain('bg-stone-900');
    expect(stroke.className).toContain('border-stone-900');
    // The stroke circle is still an outline, not a second solid disc.
    expect(stroke.className).not.toContain('bg-stone-900');
  });

  it('sets the wordmark in the display face and nothing else', () => {
    render(<Logo size={LOGO_SIZES.authPanel} />);

    expect(screen.getByTestId('logo-wordmark').className).toContain('font-display');
  });
});

/*
 * The mark is drawn in three places — the component, the favicon and the iOS
 * tile — and "keep the two in step" was a comment, not a check. #250 changed
 * the component to `content-box` and both icons kept the border-box
 * construction, so a 16px favicon would have drawn a 13.4px hole beside a 16px
 * disc while the header beside it drew a 15px hole. Caught in review, not by
 * the suite. This is the check that was missing.
 */
describe('the mark is one construction in all three places', () => {
  const read = (relative: string): string =>
    readFileSync(join(process.cwd(), 'src', 'app', relative), 'utf8');

  /*
   * SVG strokes straddle their path, so a circle's hole is `r - strokeWidth/2`.
   * Equal-as-fills means that hole equals the solid disc's radius — which is
   * what `content-box` produces in CSS, and what border-box did not.
   */
  it('gives the favicon a hole the size of its disc', () => {
    const svg = read('icon.svg');

    const fill = /<circle[^>]*r="([\d.]+)"[^>]*fill="#b4552f"/.exec(svg);
    const stroke = /<circle[^>]*class="stroke"[^>]*r="([\d.]+)"[^>]*stroke-width="([\d.]+)"/.exec(
      svg,
    );

    expect(fill, 'no solid disc in icon.svg').not.toBeNull();
    expect(stroke, 'no outline circle in icon.svg').not.toBeNull();

    const disc = Number((fill as RegExpExecArray)[1]);
    const path = Number((stroke as RegExpExecArray)[1]);
    const width = Number((stroke as RegExpExecArray)[2]);

    expect(path - width / 2).toBe(disc);
  });

  /*
   * And the ink has to fit. The stroke reaches `r + strokeWidth/2` past the
   * offset centre, which is beyond the 1.45 D the mark declares — a `<span>`
   * lets that overflow, a `viewBox` clips it.
   */
  it('gives the favicon a canvas its overflowing stroke fits inside', () => {
    const svg = read('icon.svg');

    const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    const stroke =
      /<circle[^>]*class="stroke"[^>]*cx="([\d.]+)"[^>]*r="([\d.]+)"[^>]*stroke-width="([\d.]+)"/.exec(
        svg,
      );

    expect(viewBox, 'icon.svg has no viewBox').not.toBeNull();
    expect(stroke).not.toBeNull();

    const [width, height] = [
      Number((viewBox as RegExpExecArray)[1]),
      Number((viewBox as RegExpExecArray)[2]),
    ];
    const outer =
      Number((stroke as RegExpExecArray)[1]) +
      Number((stroke as RegExpExecArray)[2]) +
      Number((stroke as RegExpExecArray)[3]) / 2;

    expect(width).toBeGreaterThanOrEqual(outer);
    // Square, so the tile is never letterboxed.
    expect(height).toBe(width);
  });

  /*
   * The root element has to be near the top of the file.
   *
   * Next's metadata image loader sniffs the icon's dimensions from the head of
   * the file, so a long LEADING comment pushes `<svg>` out of its read window
   * and `next build` fails with "is not a valid image file. The image may be
   * corrupted or an unsupported format" — which names neither the comment nor
   * the real cause. #296 hit exactly that by documenting the mark's geometry
   * above the root element; the comment now sits inside it.
   *
   * The bound is deliberately loose. What matters is that the root stays near
   * the top, not the loader's exact buffer size.
   */
  it('keeps the favicon root element in the loader’s read window', () => {
    const svg = read('icon.svg');
    const root = svg.indexOf('<svg');

    expect(root, 'icon.svg has no root element').toBeGreaterThan(-1);
    expect(root).toBeLessThan(256);
  });

  it('gives the iOS tile the same box-sizing the component uses', () => {
    expect(read('apple-icon.tsx')).toContain("boxSizing: 'content-box'");
    expect(read('apple-icon.tsx')).not.toContain("boxSizing: 'border-box'");
  });

  /*
   * The ratios are the mark's definition, so all three must state the same two.
   * A favicon that quietly moved to a different offset would still pass every
   * assertion above.
   */
  it('states one offset and one stroke ratio everywhere', () => {
    const component = readFileSync(
      join(process.cwd(), 'src', 'components', 'brand', 'logo.tsx'),
      'utf8',
    );

    expect(component).toContain('const OFFSET_RATIO = 0.45');
    expect(component).toContain('const STROKE_RATIO = 0.08');
    expect(read('apple-icon.tsx')).toContain('const OFFSET_RATIO = 0.45');
    expect(read('apple-icon.tsx')).toContain('const STROKE_RATIO = 0.08');

    // The favicon states them as resolved numbers at D=100, not as constants.
    const svg = read('icon.svg');
    const fill = /<circle[^>]*cx="([\d.]+)"[^>]*r="([\d.]+)"[^>]*fill="#b4552f"/.exec(svg);
    const stroke = /<circle[^>]*class="stroke"[^>]*cx="([\d.]+)"/.exec(svg);
    const diameter = Number((fill as RegExpExecArray)[2]) * 2;

    expect(Number((stroke as RegExpExecArray)[1]) - Number((fill as RegExpExecArray)[1])).toBe(
      diameter * 0.45,
    );
  });
});
