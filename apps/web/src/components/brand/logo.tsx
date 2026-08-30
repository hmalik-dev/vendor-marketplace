import { BRAND_NAME } from '@vendor-marketplace/shared';
import { cn } from '@/lib/utils';

/**
 * The mark is two equal circles overlapping by 45% of their diameter — an
 * introduction, two parties meeting, which is the product in one glyph. There
 * is no letterform in it, so the mark carries any name; changing `BRAND_NAME`
 * changes the wordmark text and nothing else.
 *
 * See design/design-plan/02-brand-and-logo.md.
 */

/**
 * How far the right circle is offset from the left one, as a fraction of the
 * diameter — so the two circles overlap by the remaining 0.55 D and the whole
 * mark spans 1.45 D.
 */
const OFFSET_RATIO = 0.45;
/** Stroke on the right-hand circle, as a fraction of the diameter. */
const STROKE_RATIO = 0.08;
/**
 * Gap between the mark and the wordmark, as a fraction of the diameter — for
 * the diameters no frame draws.
 *
 * 0.6, not 0.5 (#244/#250). It is exact at both diameters where the design file
 * states a gap in round numbers on both sides: D=15 → 9px, D=20 → 12px.
 */
const WORDMARK_GAP_RATIO = 0.6;
/**
 * The gaps the frames actually draw, in px, by diameter.
 *
 * The gap is **not** one ratio. Measured across every lockup in the design file
 * — a `gap` flex whose first child is a D-sized box holding two D-sized circles
 * — the frames draw whole pixels and round toward them:
 *
 * | D  | gap  | ratio | drawn in                      |
 * | -- | ---- | ----- | ----------------------------- |
 * | 14 | 9px  | 0.643 | 10 frames (3 more draw 8px)   |
 * | 15 | 9px  | 0.600 | 22 frames — the desktop header |
 * | 18 | 10px | 0.556 | 3 frames                      |
 * | 19 | 10px | 0.526 | `12 Sign up` — the auth panel  |
 *
 * A single ratio therefore cannot satisfy all four, and #244's first fix — 0.5
 * to 0.6, derived from D=15 alone — traded a 0.5px error on the auth lockup for
 * a 1.4px one, because 0.6 renders 11.4 where frame `12` draws 10. The same
 * shape as `AVATAR_SIZES`' glyph table: measured sizes are stated, and the
 * fraction is what the unmeasured ones fall back to.
 *
 * D=14 draws 9px in ten frames against 8px in three, so the majority is taken.
 * D=20 (`marketingFooter`) is absent from every frame and is left to the ratio,
 * which lands on the 12px the design file's own cover chrome draws.
 */
const WORDMARK_GAPS: Partial<Record<number, number>> = { 14: 9, 15: 9, 18: 10, 19: 10 };

/** The gap for a diameter: the frames' number where there is one. */
function wordmarkGap(size: number): number {
  return WORDMARK_GAPS[size] ?? size * WORDMARK_GAP_RATIO;
}
/**
 * Wordmark font size, as a multiple of the diameter.
 *
 * `design-plan/02-brand-and-logo.md` states this as a law — "wordmark size
 * 1.60 D" — so it is not a ticket's to change. Frames `08`/`09`/`10`/`11` pair
 * a 15px mark with a 23px wordmark, which is 1.533 and renders 24px here; ten
 * desktop frames do the same, while frame `01 Landing` draws the 24px that 1.6
 * produces. The frames and the plan therefore disagree, and adjudicating that
 * is a design pass rather than a parity fix. Recorded against #118.
 */
const WORDMARK_SIZE_RATIO = 1.6;
/**
 * The diameters the design calls for, by context. Named so no surface picks a
 * logo size by eye.
 */
export const LOGO_SIZES = {
  desktopHeader: 15,
  mobileHeader: 14,
  authPanel: 19,
  marketingFooter: 20,
  appIcon: 24,
  favicon: 16,
} as const;

export type LogoTone = 'light' | 'dark' | 'mono';

/**
 * Colourways. The single-colour version keeps the fill/stroke contrast, so it
 * survives embroidery, one-colour print and a stamp. The fill is never
 * recoloured to sage or gold.
 */
const TONE_CLASSES: Record<LogoTone, { fill: string; stroke: string; wordmark: string }> = {
  light: { fill: 'bg-clay-400', stroke: 'border-stone-900', wordmark: 'text-stone-900' },
  dark: { fill: 'bg-clay-400', stroke: 'border-stone-50', wordmark: 'text-stone-50' },
  mono: { fill: 'bg-stone-900', stroke: 'border-stone-900', wordmark: 'text-stone-900' },
};

export interface LogoProps {
  /** The circle diameter in px. Every other dimension derives from it. */
  size?: number;
  /**
   * `mark` drops the wordmark. The favicon and the app icon use it, because
   * below 16px the wordmark stops being legible — but the desktop header sets
   * D=15 and still shows it, so the choice is the caller's, not a size cutoff.
   */
  variant?: 'full' | 'mark';
  tone?: LogoTone;
  className?: string;
}

export function Logo({
  size = LOGO_SIZES.desktopHeader,
  variant = 'full',
  tone = 'light',
  className,
}: LogoProps): React.ReactElement {
  const tokens = TONE_CLASSES[tone];
  const markWidth = size * (1 + OFFSET_RATIO);
  const showWordmark = variant === 'full';

  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      data-testid="logo"
      className={cn('inline-flex items-center', className)}
      style={{ gap: `${wordmarkGap(size)}px` }}
    >
      <span
        aria-hidden="true"
        data-testid="logo-mark"
        className="relative block shrink-0"
        style={{ width: `${markWidth}px`, height: `${size}px` }}
      >
        <span
          data-testid="logo-mark-fill"
          className={cn('absolute top-0 left-0 rounded-full', tokens.fill)}
          style={{ width: `${size}px`, height: `${size}px` }}
        />
        <span
          data-testid="logo-mark-stroke"
          className={cn('absolute top-0 box-border rounded-full border', tokens.stroke)}
          style={{
            left: `${size * OFFSET_RATIO}px`,
            width: `${size}px`,
            height: `${size}px`,
            borderWidth: `${size * STROKE_RATIO}px`,
          }}
        />
      </span>

      {showWordmark ? (
        <span
          data-testid="logo-wordmark"
          className={cn('font-display leading-none', tokens.wordmark)}
          style={{ fontSize: `${size * WORDMARK_SIZE_RATIO}px` }}
        >
          {BRAND_NAME}
        </span>
      ) : null}
    </span>
  );
}
