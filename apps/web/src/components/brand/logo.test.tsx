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
