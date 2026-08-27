import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const themeCss = readFileSync(
  require.resolve('@vendor-marketplace/config/tailwind/theme.css'),
  'utf8',
);
// Vitest runs with the package root as cwd, which is where vitest.config.ts sits.
const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** Every `--color-*` declared in the shared theme, by token name. */
const COLOR_TOKENS = new Map<string, string>(
  [...themeCss.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map((match) => [
    match[1] as string,
    match[2] as string,
  ]),
);

function channelLuminance(channel: number): number {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);

  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

/** WCAG 2.1 contrast ratio between two tokens, resolved from the theme. */
function contrast(foreground: string, background: string): number {
  const fg = COLOR_TOKENS.get(foreground);
  const bg = COLOR_TOKENS.get(background);

  if (!fg || !bg) {
    throw new Error(`Unknown colour token: ${!fg ? foreground : background}`);
  }

  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));

  return (lighter + 0.05) / (darker + 0.05);
}

describe('shared theme tokens', () => {
  /*
   * An undefined custom property invalidates the whole declaration rather than
   * falling through to the next family in the list, so a `--font-*-face`
   * variable that next/font has not emitted silently drops the page to the
   * browser default serif. The fallback has to sit inside var().
   */
  it('keeps a font fallback inside var() for every font token', () => {
    const fontDeclarations = themeCss.match(/--font-[a-z-]+:[^;]+;/g);

    expect(fontDeclarations).not.toBeNull();
    expect(fontDeclarations).toHaveLength(3);

    for (const declaration of fontDeclarations ?? []) {
      expect(declaration).toMatch(/var\(--font-[a-z-]+-face,\s*'[^']+'\)/);
    }
  });

  it('sets the design system type stack', () => {
    expect(themeCss).toContain("var(--font-display-face, 'Instrument Serif')");
    expect(themeCss).toContain("var(--font-body-face, 'Instrument Sans')");
    expect(themeCss).toContain("var(--font-mono-face, 'JetBrains Mono')");
  });

  it('defines the clay, sage, gold, steel, error and warm stone ramps', () => {
    expect(COLOR_TOKENS.get('clay-400')).toBe('#b4552f');
    expect(COLOR_TOKENS.get('clay-500')).toBe('#a34a28');
    expect(COLOR_TOKENS.get('sage-600')).toBe('#4b5940');
    expect(COLOR_TOKENS.get('gold-600')).toBe('#7a5a12');
    expect(COLOR_TOKENS.get('steel-600')).toBe('#3d6a8c');
    expect(COLOR_TOKENS.get('error-500')).toBe('#b23a30');
    expect(COLOR_TOKENS.get('stone-0')).toBe('#fffdf9');
    expect(COLOR_TOKENS.get('stone-50')).toBe('#f8f5ef');
    expect(COLOR_TOKENS.get('stone-600')).toBe('#6b6459');
    expect(COLOR_TOKENS.get('stone-900')).toBe('#23201c');
  });

  /*
   * The terracotta ramp is deleted outright rather than aliased to clay. An
   * alias would let a missed call site render the old palette silently; a
   * deletion fails the build instead, which is the point.
   */
  it('leaves no primary-* alias behind', () => {
    expect(themeCss).not.toContain('--color-primary-');
  });

  it('never uses pure white, the way a default Tailwind app does', () => {
    expect(COLOR_TOKENS.get('stone-0')).not.toBe('#ffffff');
  });

  it('uses the five-step radius scale', () => {
    const radii = [
      '--radius-sm: 6px;',
      '--radius-md: 8px;',
      '--radius-lg: 10px;',
      '--radius-xl: 14px;',
      '--radius-2xl: 18px;',
    ];

    for (const radius of radii) {
      expect(themeCss).toContain(radius);
    }
  });

  it('tints every shadow with the ink rather than with neutral grey or black', () => {
    const shadows = themeCss.match(/--shadow-[a-z]+:[^;]+;/g) ?? [];

    expect(shadows.length).toBeGreaterThanOrEqual(5);

    for (const shadow of shadows) {
      expect(shadow).toMatch(/rgba\(35, (32|40), (28|38), /);
      expect(shadow).not.toContain('rgba(0, 0, 0');
    }
  });

  it('carries the new layout rails alongside the existing chrome variables', () => {
    for (const variable of [
      '--rail-booking',
      '--rail-summary',
      '--rail-context',
      '--list-pane',
      '--rail-filter',
    ]) {
      expect(themeCss).toContain(`${variable}:`);
    }
  });
});

/*
 * design/design-plan/01-foundations.md's contrast table records failures that
 * were already found and fixed once. Asserting them numerically means a future
 * palette tweak cannot quietly reintroduce one.
 */
describe('contrast rules', () => {
  const AA_NORMAL = 4.5;

  it.each([
    ['stone-600', 'stone-50', 'muted labels on the page background'],
    ['stone-600', 'stone-0', 'muted labels on a card'],
    ['stone-600', 'stone-150', 'muted labels on an input fill'],
    ['stone-700', 'stone-50', 'body text'],
    ['stone-900', 'stone-50', 'headings'],
    ['clay-500', 'stone-50', 'clay as text on the page background'],
    ['clay-500', 'stone-0', 'clay as text on a card'],
    ['clay-600', 'clay-100', 'text on a clay-tinted surface'],
    ['stone-0', 'clay-400', 'white text on the primary fill'],
    ['sage-600', 'sage-50', 'confirmed'],
    ['sage-600', 'sage-100', 'completed'],
    ['gold-600', 'gold-50', 'waiting on someone'],
    ['steel-600', 'steel-50', 'information'],
    ['error-500', 'error-50', 'went wrong'],
    ['stone-600', 'stone-200', 'inert status pill'],
  ])('%s on %s clears 4.5:1 — %s', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('records why clay-400 is a fill and never a text colour', () => {
    // 4.32:1 — the exact failure the clay-400/clay-500 split exists to prevent.
    expect(contrast('clay-400', 'stone-100')).toBeLessThan(AA_NORMAL);
  });

  it('records that stone-500 is the one token allowed to fail, for inert content', () => {
    expect(contrast('stone-500', 'stone-0')).toBeLessThan(AA_NORMAL);
  });
});

/*
 * shadcn and Clerk both address colour through the semantic slots below. If a
 * refactor unbinds one, every component using it silently falls back to
 * shadcn's own grey — which looks deliberate and is very hard to spot.
 */
describe('shadcn slot bindings', () => {
  it.each([
    ['--background', '--color-stone-50'],
    ['--foreground', '--color-stone-900'],
    ['--card', '--color-stone-0'],
    ['--popover', '--color-stone-0'],
    ['--primary', '--color-clay-400'],
    ['--primary-foreground', '--color-stone-0'],
    ['--secondary', '--color-stone-150'],
    ['--muted', '--color-stone-150'],
    ['--muted-foreground', '--color-stone-600'],
    ['--accent', '--color-sage-50'],
    ['--accent-foreground', '--color-sage-600'],
    ['--destructive', '--color-error-500'],
    ['--border', '--color-stone-300'],
    ['--input', '--color-stone-300'],
    ['--ring', '--color-clay-400'],
    ['--radius', '--radius-lg'],
  ])('binds %s to %s', (slot, token) => {
    expect(globalsCss).toContain(`${slot}: var(${token});`);
  });

  it('binds every slot to a shared token rather than to a literal colour', () => {
    const rootStart = globalsCss.indexOf(':root {');
    const rootBlock = globalsCss.slice(rootStart, globalsCss.indexOf('\n}', rootStart));
    const declarations = rootBlock.match(/^\s+--[a-z0-9-]+:\s*([^;]+);/gm) ?? [];

    expect(declarations.length).toBeGreaterThan(20);

    for (const declaration of declarations) {
      expect(declaration).toMatch(/var\(--(color|radius)-/);
    }
  });
});
