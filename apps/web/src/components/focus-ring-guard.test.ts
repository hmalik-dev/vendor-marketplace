import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A focus ring that is declared must actually paint.
 *
 * Tailwind's width utilities take their line style from `--tw-outline-style`,
 * and `outline-none` sets that variable to `none` on the same element. So
 * `outline-none focus-visible:outline-2` — which reads like a perfectly
 * ordinary focus ring, and is what shipped on the profile tablist — computes to
 * a 2px outline with `outline-style: none` and draws **nothing at all**. The
 * element is genuinely `:focus-visible`; there is simply no ring.
 *
 * It is invisible in review, invisible in a unit test that only asserts the
 * class string, and invisible to anyone who navigates with a mouse. It was
 * caught by reading `outlineStyle` off a real focused element in a browser, and
 * that is not a check anything in this repository runs by default — hence this.
 *
 * The rule: any element that suppresses its outline and then restores one on
 * focus must also restore the style. `outline-hidden` is Tailwind's
 * forced-colors-aware variant of the same thing and carries the same trap.
 */
const SUPPRESSES = /\boutline-(?:none|hidden)\b/;
const RESTORES_WIDTH = /\bfocus(?:-visible)?:outline-(?:\d+|\[)/;
const RESTORES_STYLE = /\bfocus(?:-visible)?:outline-(?:solid|dashed|dotted|double)\b/;

const COMPONENTS_DIR = path.dirname(fileURLToPath(import.meta.url));

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await sourceFiles(full)));
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      found.push(full);
    }
  }

  return found;
}

describe('focus rings paint', () => {
  it('finds the components it is meant to be guarding', async () => {
    const files = await sourceFiles(COMPONENTS_DIR);

    // Guards the guard: a scan that matched nothing would pass forever while
    // the rule it encodes went unenforced.
    expect(files.length).toBeGreaterThan(10);
  });

  it('never restores an outline width on focus without its line style', async () => {
    const files = await sourceFiles(COMPONENTS_DIR);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      // Prose explaining the trap is not an instance of it.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      for (const [index, line] of code.split('\n').entries()) {
        if (SUPPRESSES.test(line) && RESTORES_WIDTH.test(line) && !RESTORES_STYLE.test(line)) {
          offenders.push(`${path.relative(COMPONENTS_DIR, file)}:${index + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /*
   * The third way a ring renders nothing, and the subtlest (#73).
   *
   * Tailwind v4 registers `--tw-ring-shadow` and its siblings as animatable
   * custom properties, so `transition-all` animates the focus ring *in*. A
   * parity pass measured this primitive as "five all-transparent entries" and
   * reported a broken ring; it was 0% of the way through a 150ms animation.
   * The ring was correct and the transition was wrong.
   *
   * It still cost every keyboard stop 150ms with no indicator, which is the
   * one population the ring exists for. `04-laws.md`: functional transitions
   * survive, decorative ones do not — and a focus indicator is functional.
   *
   * Scoped to lines that declare a focus ring, so an unrelated `transition-all`
   * on something with no ring is left alone.
   */
  it('never transitions the property its focus ring is painted with', async () => {
    const files = await sourceFiles(COMPONENTS_DIR);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      /*
       * File-scoped, not line-scoped, and that is the point. In `vendor-card`
       * the ring and the transition that ramps it sit eighteen lines apart on
       * the same element — a line-scoped check saw neither.
       *
       * `has-[a:focus-visible]:ring-2` also declares a ring while containing no
       * `focus-visible:ring-` substring, because the `]` is in the way; that
       * blind spot is why the flagship fix of this very ticket shipped a 200ms
       * ramp on the ring it had just made visible.
       */
      const declaresRing = /focus-visible\]?:(?:ring|outline)-\d/.test(code);
      const transitionsBoxShadow =
        /\btransition-all\b/.test(code) || /\btransition-\[[^\]]*box-shadow/.test(code);

      if (declaresRing && transitionsBoxShadow) {
        offenders.push(path.relative(COMPONENTS_DIR, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
