import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * VEN-389. Nothing declared a document font-size, so every block without a
 * `text-*` utility inherited the browser's 16px — `--text-lg`, not the 13.5px
 * `--text-base` the scale calls its body step. A smaller inline child does not
 * shrink the line box of the block that holds it, which is how the footer's
 * link rows measured a 31px pitch against the frame's 27 (`1b8435f3`).
 *
 * The size goes on `body`, never `html`: every rem-based Tailwind spacing
 * utility resolves against `html`, so declaring it there would rescale the
 * whole product's spacing to fix its type.
 *
 * `e2e/body-text-size.spec.ts` reads the rendered result in a browser; this
 * compiles the real stylesheet so the cascade outcome fails here first.
 */
const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

type Plugin = unknown;
type Postcss = (plugins: Plugin[]) => {
  process(css: string, options: { from: string }): Promise<{ css: string }>;
};
type TailwindPlugin = (options: { base: string }) => Plugin;

/* Resolved at runtime for the reason `inherited-leading.test.ts` gives. */
async function compile(): Promise<string> {
  const require = createRequire(import.meta.url);
  const postcss = require('postcss') as Postcss;
  const tailwind = require('@tailwindcss/postcss') as TailwindPlugin;

  const from = join(process.cwd(), 'src/app/globals.css');
  const result = await postcss([tailwind({ base: process.cwd() })]).process(globalsCss, { from });

  return result.css;
}

/** Every value of `property` given to a selector list that is exactly `selector`. */
function declared(css: string, selector: RegExp, property: string): string[] {
  const values: string[] = [];

  // A lookbehind, so one rule's closing brace still starts the rule after it.
  for (const match of css.matchAll(/(?<=^|[{};])\s*([^{};]+)\{([^{}]*)\}/g)) {
    if (!selector.test((match[1] ?? '').trim())) continue;

    const found = [
      ...(match[2] ?? '').matchAll(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+)`, 'g')),
    ];
    values.push(...found.map((d) => (d[1] ?? '').trim()));
  }

  return values;
}

describe('the document body is set at the scale’s body step', () => {
  it('gives body `var(--text-base)`, and gives it last', async () => {
    const css = await compile();
    const sizes = declared(css, /^body$/, 'font-size');

    expect(sizes.at(-1)).toBe('var(--text-base)');
  }, 30_000);

  it('resolves `--text-base` to 13.5px', async () => {
    const css = await compile();

    expect(declared(css, /^:root\s*,\s*:host$/, '--text-base')).toContain('13.5px');
  }, 30_000);

  /*
   * The mistake this ticket's scope names: moving the size to `html` would make
   * `1rem` 13.5px and shrink every `p-4`, `gap-6` and `h-10` in the product.
   */
  it('never declares a font-size on html', async () => {
    const css = await compile();

    expect(declared(css, /^html(\s*,\s*:host)?$/, 'font-size')).toEqual([]);
  }, 30_000);
});
