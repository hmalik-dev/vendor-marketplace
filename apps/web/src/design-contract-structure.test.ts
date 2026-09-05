import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The design contract's structural integrity — the one thing every other
 * frame-reading test is blind to.
 *
 * `skeleton.test.tsx`, `frame-13-parity.test.ts` and
 * `vendor-profile-editor-parity.test.ts` all slice the `Screens.dc.html` frame
 * file as a **string**: from one `data-screen-label=` to the next. That reads
 * the right bytes whatever the tag nesting is doing, so a re-cut that leaves a
 * surplus `</div>` passes all three while the browser puts the frame somewhere
 * else entirely.
 *
 * That happened, in the commit this file arrives in. #385's first pass replaced
 * two rails with a regex whose tail matched trailing `</div>`s belonging to the
 * frames' outer wrappers, so the replacements' own closers were surplus. Screen
 * section 20 ended three closers deep and
 * `27 Vendor dashboard — empty · 1024` fell out of its section card: in
 * Chromium it went from a child of screen 20 at x 1516, beside its 1440
 * sibling, to a direct child of the canvas host at x 0, below the card. 1909
 * tests, `tsc --noEmit` and Prettier were all green over it.
 *
 * Per-section balance is what closes that hole. A section that balances cannot
 * leak a frame into its neighbour, and it is checkable without a layout engine.
 */

const designDirectory = join(process.cwd(), '../../design');
const framesFile = readdirSync(designDirectory).filter((entry) =>
  entry.endsWith('Screens.dc.html'),
);

if (framesFile.length !== 1) {
  throw new Error(`Expected exactly one screens frame file in design/, found ${framesFile.length}`);
}

const frames = readFileSync(join(designDirectory, framesFile[0] as string), 'utf8');

const SECTION_OPEN = '<div class="sc">';

/**
 * `<div` counted as a tag opener rather than as a substring: `\b` keeps
 * `<divider` (or any longer name) from reading as one.
 */
function tagCounts(markup: string): { open: number; close: number } {
  return {
    open: (markup.match(/<div\b/g) ?? []).length,
    close: (markup.match(/<\/div>/g) ?? []).length,
  };
}

/** Each screen section's markup, keyed by the number in its `.sc-n` badge. */
function sections(): ReadonlyArray<{ name: string; markup: string }> {
  const starts: number[] = [];

  for (
    let at = frames.indexOf(SECTION_OPEN);
    at !== -1;
    at = frames.indexOf(SECTION_OPEN, at + 1)
  ) {
    starts.push(at);
  }

  return starts.map((start, index) => {
    const markup = frames.slice(start, starts[index + 1] ?? frames.length);

    return { name: /class="sc-n">([^<]*)/.exec(markup)?.[1] ?? '(unnamed)', markup };
  });
}

describe('the design contract is structurally intact', () => {
  /*
   * Screen `01` carries one surplus `</div>` and has since before this guard
   * existed. It is pinned by name rather than tolerated by a threshold, so the
   * guard stays exact everywhere else and fixing `01` fails this line loudly
   * instead of quietly widening the allowance.
   */
  const KNOWN_UNBALANCED: ReadonlyMap<string, number> = new Map([['01', -1]]);

  it('has more than a token number of screen sections to check', () => {
    // Non-vacuity: a selector that matched nothing would pass every case below.
    expect(sections().length).toBeGreaterThan(20);
    expect(frames).toContain('data-screen-label=');
  });

  it('balances <div> against </div> inside every screen section', () => {
    const deltas = sections().map(({ name, markup }) => {
      const { open, close } = tagCounts(markup);

      return { name, delta: open - close };
    });

    const offenders = deltas.filter(
      ({ name, delta }) => delta !== (KNOWN_UNBALANCED.get(name) ?? 0),
    );

    expect(offenders).toEqual([]);
  });

  it('keeps the file’s own totals at the balance those sections imply', () => {
    const { open, close } = tagCounts(frames);
    const allowed = [...KNOWN_UNBALANCED.values()].reduce((sum, delta) => sum + delta, 0);

    expect(open - close).toBe(allowed);
  });

  it('gives every frame a label, and every label a frame', () => {
    const labels = [...frames.matchAll(/data-screen-label="([^"]+)"/g)].map((match) => match[1]);

    expect(labels.length).toBeGreaterThan(40);
    expect(new Set(labels).size).toBe(labels.length);

    // Every labelled frame is a `.fr` — the class the canvas styles and sizes.
    for (const label of labels) {
      const at = frames.indexOf(`data-screen-label="${label}"`);
      const tagStart = frames.lastIndexOf('<div', at);

      expect(frames.slice(tagStart, at)).toContain('class="fr"');
    }
  });

  it('places every frame inside a screen section', () => {
    const orphans = [...frames.matchAll(/data-screen-label="([^"]+)"/g)]
      .filter((match) => frames.lastIndexOf(SECTION_OPEN, match.index) === -1)
      .map((match) => match[1]);

    expect(orphans).toEqual([]);
  });
});
