import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The disclosure caret is gone from every dropdown trigger — **D25**.
 *
 * This is not a parity fix and the frames have not changed: the screens bundle
 * still draws `▾` on its triggers and `42-dropdowns.md` still specifies it. The
 * user overrode both and is correcting the frames themselves, so for once the
 * code leads the contract.
 *
 * That is exactly why it needs an assertion rather than a commit message. A
 * parity pass reads the frame, sees a caret the app does not draw, and files it
 * as a Text-axis finding — which is how it came back twice already, as #228 and
 * again as #338. An inverted assertion turns the next attempt red instead of
 * letting it land.
 *
 * Scope: **the two unicode glyphs**, anywhere in rendered source. Deliberately
 * not every disclosure indicator — `ui/select.tsx` and `tags/tag-category-section.tsx`
 * draw lucide icons on their triggers and still do. #364's deliverable is the
 * twelve sites drawing the character the frames draw, and the override is
 * against that character; removing an icon from a shadcn primitive is a
 * different decision on surfaces this ruling did not cover. Said here because
 * a guard whose name is broader than its reach is worse than a narrow one.
 *
 * Prose is excluded by blanking comments — several files legitimately describe
 * the frame's caret in a doc comment, and `refine-bar.tsx` describes the chip
 * states it used to have.
 *
 * Two known blind spots in that blanking, neither exploited today and both
 * cheaper to name than to close: a `//` inside a string literal blanks the rest
 * of its line, and a regex literal containing `*\/` ends the block early. A
 * caret re-landing on a line that also carries a URL would read clean.
 */

const CARETS = ['▾', '▴'] as const;

/** Every non-test source file under `src`, as `[repo-relative path, contents]`. */
function sourceFiles(): [string, string][] {
  const root = join(process.cwd(), 'src');

  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    .sort()
    .map((entry) => [join('src', entry), readFileSync(join(root, entry), 'utf8')]);
}

/**
 * The source with every comment blanked out, positions preserved.
 *
 * Blanked rather than deleted so a reported line number still points at the
 * real line. A caret inside a `//` or `/* *\/` comment is documentation of what
 * the frame draws; a caret outside one is a rendered glyph.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );
}

describe('no dropdown trigger draws the unicode disclosure caret (D25)', () => {
  const files = sourceFiles();

  it('reads the tree it is scanning, so the check cannot be vacuous', () => {
    expect(files.length).toBeGreaterThan(100);

    // The triggers the caret used to sit on are still here — this is a removed
    // glyph, not a removed feature, and every trigger keeps `aria-expanded`.
    const triggers = files.filter(([, source]) => source.includes('aria-expanded'));
    expect(triggers.length).toBeGreaterThanOrEqual(10);
  });

  it('proves it can fail, on source that does carry one', () => {
    const fabricated = `<span aria-hidden="true">${CARETS[0]}</span>`;

    expect(withoutComments(fabricated)).toContain(CARETS[0]);
  });

  it('reads a caret in a comment as prose rather than as a render', () => {
    const documented = `/** The frame's \`Payouts ${CARETS[0]}\` options. */`;

    expect(withoutComments(documented)).not.toContain(CARETS[0]);
  });

  it('renders neither glyph anywhere in the app’s own source', () => {
    const rendered = files.flatMap(([file, source]) => {
      const code = withoutComments(source);

      return code
        .split('\n')
        .flatMap((line, index) =>
          CARETS.some((caret) => line.includes(caret))
            ? [`${file}:${index + 1} — ${line.trim()}`]
            : [],
        );
    });

    expect(rendered).toEqual([]);
  });

  /*
   * The two the sweep had to reach into a string for. Both built the glyph into
   * the button's *accessible name*, so a screen reader announced "All
   * categories black down-pointing small triangle, button" — the caret was not
   * only decorative-and-unhidden, it was part of the label. Asserted by name
   * rather than by absence of the glyph, because the point is what the control
   * is now called.
   */
  it('names the two Refine chips without the glyph', () => {
    const chips = readFileSync(
      join(process.cwd(), 'src/components/bookings/bookings-refine-chips.tsx'),
      'utf8',
    );

    expect(chips).toContain("{category ?? 'All categories'}");
    expect(chips).toContain('{SORT_LABELS[sort]}');
  });
});
