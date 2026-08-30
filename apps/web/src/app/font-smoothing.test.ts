import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * #251 — `01-foundations.md` forbids `-webkit-font-smoothing: antialiased`
 * outright:
 *
 * > Do not add `-webkit-font-smoothing: antialiased`. The frames do not set it.
 * > Applying it to the app alone changes glyph weight and fails the font axis
 * > against every frame. If it is ever wanted, it goes in
 * > the design frame bundle and the app in the same change, or in neither.
 *
 * It had been applied app-wide twice — `layout.tsx` and `global-error.tsx` —
 * which put every screen in the product off the font axis at once. Tailwind's
 * `antialiased` utility is exactly that declaration, so the class is what this
 * guards; a raw CSS declaration is guarded alongside it.
 */

const SOURCE_ROOT = join(process.cwd(), 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('font smoothing', () => {
  it('is never forced anywhere in the application source', () => {
    const offenders = sourceFiles(SOURCE_ROOT).filter((path) => {
      const source = readFileSync(path, 'utf8');
      return /\bantialiased\b/.test(source) || /-webkit-font-smoothing/.test(source);
    });

    expect(offenders.map((path) => path.replace(`${process.cwd()}/`, ''))).toEqual([]);
  });

  /*
   * The law's escape hatch is "both files or neither". If the design bundle
   * ever adopts it, this test is the thing that has to be changed deliberately
   * rather than a rule someone quietly drops.
   */
  it('is not set by the design frames either, so the app matching them is correct', () => {
    /*
     * Located by extension rather than by name: the brand name is read from
     * `BRAND_NAME` and never written as a literal, including in a test.
     */
    const designRoot = join(process.cwd(), '../../design');
    const frameFile = readdirSync(designRoot).find((entry) => entry.endsWith('.dc.html'));

    expect(frameFile).toBeDefined();

    const frames = readFileSync(join(designRoot, frameFile as string), 'utf8');

    expect(frames).not.toMatch(/-webkit-font-smoothing:\s*antialiased/);
  });
});
