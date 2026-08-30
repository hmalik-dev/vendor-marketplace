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
});
