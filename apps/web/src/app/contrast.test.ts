import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * VEN-541 — WCAG 1.4.11 (non-text contrast) and 2.4.7 (focus visible).
 *
 * Every indicator the audit named is measured here from the token file rather
 * than restated as a number, so a token edit that drops a pair below 3:1 fails.
 * Each measurement is paired with a source read that proves the component
 * actually uses the token that was measured.
 */
const MIN_RATIO = 3;

const webRoot = process.cwd();
const themeCss = readFileSync(join(webRoot, '../../packages/config/tailwind/theme.css'), 'utf8');
const globalsCss = readFileSync(join(webRoot, 'src/app/globals.css'), 'utf8');

/** Every non-test source file under `src`, relative to it. */
function productionFiles(dir = ''): string[] {
  return readdirSync(join(webRoot, 'src', dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return productionFiles(path);

    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

const source = (path: string): string => readFileSync(join(webRoot, 'src', path), 'utf8');

function token(name: string): string {
  const match = themeCss.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  expect(match, `token ${name}`).not.toBeNull();

  return match?.[1] ?? '';
}

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;

  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');

  return 0.2126 * channel(h, 0) + 0.7152 * channel(h, 2) + 0.0722 * channel(h, 4);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** The two grounds a control sits on: the page and a card. */
const GROUNDS = ['stone-50', 'stone-0'] as const;

function expectContrast(foreground: string): void {
  for (const ground of GROUNDS) {
    expect(
      ratio(token(foreground), token(ground)),
      `${foreground} on ${ground}`,
    ).toBeGreaterThanOrEqual(MIN_RATIO);
  }
}

describe('focus rings meet 3:1', () => {
  it('measures the full clay-400 ring', () => {
    expectContrast('clay-400');
  });

  it('draws the ring at full opacity everywhere it is written', () => {
    const offenders = productionFiles().filter((file) => source(file).includes('ring-clay-400/40'));

    expect(offenders).toEqual([]);
    expect(globalsCss).toMatch(
      /:focus-visible:not\(\[data-focus-own\]\)\s*\{[^}]*ring-clay-400(?![\w/-])/,
    );
  });

  it('marks a highlighted or focused menu row with more than a fill', () => {
    for (const file of ['components/account-menu.tsx', 'components/admin/row-menu.tsx']) {
      expect(source(file), file).toContain('data-[highlighted]:ring-clay-400');
    }
    expect(source('lib/focus.ts')).toMatch(
      /SEGMENT_FOCUS =\s*'[^']*has-\[:focus-visible\]:ring-clay-400/,
    );
  });
});

describe('field and control boundaries meet 3:1', () => {
  it('resolves --input to a token that measures 3:1', () => {
    const match = globalsCss.match(/--input:\s*var\(--color-([a-z0-9-]+)\)/);

    expect(match).not.toBeNull();
    expectContrast(match?.[1] ?? '');
  });

  it('keeps --input a border only: no fill borrows the darkened token', () => {
    const offenders = productionFiles().filter((file) =>
      // `dark:` variants are dead: the app ships no dark theme.
      /(?<![:\w-])(?:[\w[\]-]+:)*bg-input\b/.test(source(file).replace(/dark:\S+/g, '')),
    );

    expect(offenders).toEqual([]);
  });

  it('draws every hand-rolled text field in the boundary token', () => {
    // The field shape: a stone-150 fill with input padding. Cards share the fill but not the padding.
    const offenders = productionFiles().filter((file) =>
      /border-stone-300 bg-stone-150 px-(?:3\.25|\[13px\]|2\.5)/.test(source(file)),
    );

    expect(offenders).toEqual([]);
  });

  it('draws every hand-rolled checkbox in the boundary token', () => {
    const offenders = productionFiles().filter((file) =>
      /appearance-none[^'"`]*border-stone-400/.test(source(file)),
    );

    expect(offenders).toEqual([]);
  });

  it('draws an unchecked control and the drop zone in that boundary token', () => {
    expect(source('components/ui/dropdown.tsx')).toContain('border-[1.5px] border-stone-560');
    expect(source('components/image-upload.tsx')).toContain('border-dashed border-stone-560');
  });
});

describe('rating stars meet 3:1', () => {
  it('measures the unselected and selected star colours', () => {
    expectContrast('stone-560');
    expectContrast('gold-600');
  });

  it('paints the display stars in the same gold as the form', () => {
    expect(source('components/vendors/profile/reviews-pane.tsx')).not.toContain('text-gold-400');
  });

  it('paints the stars in those tokens', () => {
    expect(source('components/vendors/profile/review-form.tsx')).toContain(
      "'text-gold-600' : 'text-stone-560'",
    );
  });
});
