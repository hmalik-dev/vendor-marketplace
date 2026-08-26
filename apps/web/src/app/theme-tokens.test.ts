import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const themeCss = readFileSync(require.resolve('@vendorhub/config/tailwind/theme.css'), 'utf8');

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

  it('defines the terracotta, sage, gold, and warm stone ramps', () => {
    expect(themeCss).toContain('--color-primary-400: #ee7b3f;');
    expect(themeCss).toContain('--color-sage-500: #5e7a4e;');
    expect(themeCss).toContain('--color-gold-400: #d4a853;');
    expect(themeCss).toContain('--color-stone-50: #faf7f2;');
  });

  it('uses varied radii rather than one value everywhere', () => {
    const radii = [
      '--radius-sm: 6px;',
      '--radius-md: 10px;',
      '--radius-lg: 14px;',
      '--radius-xl: 20px;',
    ];

    for (const radius of radii) {
      expect(themeCss).toContain(radius);
    }
  });
});
