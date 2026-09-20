import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Vitest runs with the package root as cwd, where vitest.config.ts sits. */
const LAYOUT = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');

/**
 * VEN-492. The header and footer await the API, and the root layout sits above
 * every segment's `loading.tsx`, so an un-suspended chrome holds the whole
 * document and no route's loader can paint. This pins the boundary; the
 * rendered result (document arrives fast, loader visible) is a browser check.
 */
describe('root layout streaming', () => {
  it.each(['SiteHeader', 'SiteFooter'])('wraps <%s /> in its own Suspense boundary', (name) => {
    const wrapped = new RegExp(
      String.raw`<Suspense fallback=\{[^\n]*\}>\s*<${name} />\s*</Suspense>`,
    );

    expect(LAYOUT).toMatch(wrapped);
  });

  it('reserves the header height while it streams, as a <header> so auth screens still hide it', () => {
    expect(LAYOUT).toMatch(/fallback=\{<header className="[^"]*h-\(--header-height\)[^"]*" \/>\}/);
  });

  it('keeps the header boundary above <main>, so focus order is unchanged', () => {
    expect(LAYOUT.indexOf('<SiteHeader />')).toBeGreaterThan(-1);
    expect(LAYOUT.indexOf('<SiteHeader />')).toBeLessThan(LAYOUT.indexOf('<main'));
  });
});
