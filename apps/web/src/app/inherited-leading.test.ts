import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * #235. Frames draw `normal` leading; the app inherited `1.5`.
 *
 * Tailwind emits font-size *and* line-height together only for a named scale
 * step. An arbitrary utility emits font-size alone —
 *
 *   .text-\[10\.5px\]{font-size:10.5px}
 *
 * — so those elements take whatever `html` inherits, and
 * `tailwindcss/preflight.css` sets `html, :host { line-height: 1.5 }`. With no
 * counter-declaration, 82 arbitrary `text-[Npx]` sites across 39 files rendered
 * a line box the frames never draw: a category card measured 163.75px against
 * the frame's 157.50, a refine chip 34.75 against 31.00.
 *
 * The fix is one declaration rather than a `leading-*` on each call site,
 * because a site with **no** text utility at all still inherits — the
 * per-call-site route cannot close the class.
 *
 * A source guard, like `focus-ring.test.ts` beside it. What it pins is that the
 * declaration exists and resolves to the CSS keyword: the browser pass is the
 * real gate, and it is recorded on the ticket.
 */
const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** The body of the last rule matching `selector`, so a later override wins. */
function ruleFor(selector: string): string {
  const matches = [
    ...globalsCss.matchAll(new RegExp(`(?:^|\\s)${selector}\\s*\\{([^}]*)\\}`, 'g')),
  ];
  expect(matches.length).toBeGreaterThan(0);

  return matches[matches.length - 1]?.[1] ?? '';
}

describe('the inherited line-height agrees with the frames', () => {
  it('declares `line-height: normal` on html', () => {
    expect(ruleFor('html')).toMatch(/line-height:\s*normal/);
  });

  /*
   * `leading-normal` is Tailwind's *1.5*, not the CSS keyword — the exact value
   * being removed. Writing the utility here would look like the fix and change
   * nothing, so the keyword is asserted literally.
   */
  it('uses the CSS keyword rather than Tailwind’s `leading-normal`', () => {
    expect(ruleFor('html')).not.toMatch(/leading-normal/);
  });

  /*
   * The regression this exists to catch: a Tailwind upgrade, or anything else,
   * re-widening the default. `1.5` on `html` or `body` is the shape of that
   * mistake, and it is what every measurement above was taken against.
   */
  it('never restores a numeric default on html or body', () => {
    for (const selector of ['html', 'body']) {
      expect(ruleFor(selector)).not.toMatch(/line-height:\s*1\.5/);
    }
  });
});

/*
 * `packages/config/tailwind/theme.css` states the rule this ticket implements:
 * "Line-height is `normal` on every body and UI step, because that is what the
 * frames draw ... A ratio belongs to the element that wraps, not to the step:
 * prose asks for `leading-prose`."
 *
 * So narrowing the default is only half the change. The browser pass over every
 * public screen found exactly one wrapped paragraph that had been living on the
 * inherited 1.5 — three lines at a measured 1.25 once it was gone. It is guarded
 * here because the next person to touch that page has nothing else telling them
 * the measure is load-bearing.
 */
/*
 * The source guard above pins the declaration's *text*. What the ticket
 * actually rests on is the cascade **outcome**: our rule and preflight's
 * `html, :host { line-height: 1.5 }` share `@layer base` and the same
 * specificity, so source order alone decides which one an element gets.
 *
 * That is not decidable from `globals.css` — preflight's layer membership is
 * chosen inside the `tailwindcss` package, which this file never names. So
 * compile the real stylesheet and read the resolved order. It is what makes a
 * Tailwind upgrade that relayers preflight fail here rather than in a browser.
 */
describe('the compiled cascade resolves to `normal`', () => {
  /*
   * Resolved at runtime rather than imported. `postcss` reaches this package
   * transitively, through `@tailwindcss/postcss`, so a static import is not
   * resolvable at transform time — and adding a direct dependency to satisfy a
   * test would be the tail wagging the dog.
   */
  /*
   * Only the surface this test drives, declared locally. `postcss`'s own types
   * are no more resolvable than its runtime is, and widening to `any` to reach
   * a two-method API would cost more than it buys.
   */
  type Plugin = unknown;
  type Postcss = (plugins: Plugin[]) => {
    process(css: string, options: { from: string }): Promise<{ css: string }>;
  };
  type TailwindPlugin = (options: { base: string }) => Plugin;

  async function compile(): Promise<string> {
    const require = createRequire(import.meta.url);
    const postcss = require('postcss') as Postcss;
    const tailwind = require('@tailwindcss/postcss') as TailwindPlugin;

    const from = join(process.cwd(), 'src/app/globals.css');
    const result = await postcss([tailwind({ base: process.cwd() })]).process(globalsCss, { from });

    return result.css;
  }

  /** Every `line-height` a bare `html` selector is given, in source order. */
  function htmlLineHeights(css: string): string[] {
    const values: string[] = [];

    for (const match of css.matchAll(/(?:^|\})\s*(html[^{}]*)\{([^}]*)\}/g)) {
      const selector = (match[1] ?? '').trim();
      // `html:has(...)` and the like are more specific and not the default.
      if (!/^html\s*(,\s*:host\s*)?$/.test(selector)) continue;

      const declared = [...(match[2] ?? '').matchAll(/line-height:\s*([^;]+)/g)];
      values.push(...declared.map((d) => (d[1] ?? '').trim()));
    }

    return values;
  }

  it('gives the document `normal`, and gives it last', async () => {
    const declared = htmlLineHeights(await compile());

    // Preflight's 1.5 is still emitted — the fix overrides it, it does not
    // remove it. Asserting both is what proves the ordering is the mechanism.
    expect(declared).toContain('1.5');
    expect(declared).toContain('normal');
    expect(declared.at(-1)).toBe('normal');
    expect(declared.lastIndexOf('normal')).toBeGreaterThan(declared.lastIndexOf('1.5'));
  }, 30_000);
});

describe('prose that wraps carries its own measure', () => {
  const suspended = readFileSync(join(process.cwd(), 'src/app/suspended/page.tsx'), 'utf8');

  it('gives the suspended-account paragraph an explicit leading', () => {
    const paragraph = suspended.match(/<p className="([^"]*)"/)?.[1] ?? '';

    expect(paragraph).toContain('leading-prose');
  });
});
