import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withoutComments } from '@/testing/source-scan';

/*
 * The disclosure caret is gone from every dropdown trigger **but one** — D25,
 * as narrowed by #426.
 *
 * D25 was not a parity fix and the frames have not changed: the screens bundle
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
 * **#426 reverses the override for the vendor-type picker, and only for it.**
 * The account holder asked for the caret back on the landing hero and on
 * `/search`, which are one control — `category-select.tsx`, mounted by both.
 * The other twelve sites keep D25.
 *
 * So this file is **narrowed, never deleted**: without it the glyph creeps back
 * across all fourteen, which is the thing that has already happened twice. The
 * exemption is one named file, and `EXEMPT` below is asserted to *be* one file
 * so that widening it is an edit somebody has to make on purpose. The exempt
 * file is checked from the other side too — it must really draw both glyphs,
 * and only inside an `aria-hidden` span.
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

/**
 * The one file #426 lets draw them: the vendor-type picker, which the landing
 * hero and `/search` both mount.
 *
 * A list of one, on purpose. The count is asserted below, so widening this is a
 * deliberate edit to a test rather than a class of drift.
 */
const EXEMPT = [join('src', 'components', 'search', 'category-select.tsx')];

/** Every non-test source file under `src`, as `[repo-relative path, contents]`. */
function sourceFiles(): [string, string][] {
  const root = join(process.cwd(), 'src');

  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    .sort()
    .map((entry) => [join('src', entry), readFileSync(join(root, entry), 'utf8')]);
}

describe('only the vendor-type trigger draws the unicode disclosure caret (D25, narrowed by #426)', () => {
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

  it('renders neither glyph anywhere in the app’s own source, bar the one exempt file', () => {
    const rendered = files
      .filter(([file]) => !EXEMPT.includes(file))
      .flatMap(([file, source]) => {
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
   * The exemption's own guard, in three parts, because an exemption nobody
   * checks is just a hole.
   *
   * 1. It is **one** file. A future ticket that wants a second caret has to
   *    change this number, which is where the argument belongs.
   * 2. That file exists and is being scanned — an exemption naming a path that
   *    has been renamed away silently stops exempting anything, and the rest of
   *    this suite would then be green for the wrong reason.
   * 3. It really draws both glyphs. #426's deliverable is a caret that *flips*;
   *    a file exempted for a caret it no longer renders is a stale hole.
   */
  it('exempts exactly one file, and that file is really in the scanned tree', () => {
    expect(EXEMPT).toHaveLength(1);

    for (const exempt of EXEMPT) {
      expect(files.map(([file]) => file)).toContain(exempt);
    }
  });

  it('draws both glyphs on the vendor-type trigger, and only inside an aria-hidden span', () => {
    const [picker] = EXEMPT as [string];
    const code = withoutComments(files.find(([file]) => file === picker)?.[1] as string);

    for (const caret of CARETS) {
      expect(code, `${picker} should render ${caret}`).toContain(caret);
    }

    /*
     * And every occurrence is inside the `CARETS` declaration — nowhere else,
     * and never inlined into JSX where it could land in a control's accessible
     * name. D25 found two chips announcing "All categories black down-pointing
     * small triangle, button" for exactly that reason.
     *
     * The declaration is **blanked by shape rather than matched by its exact
     * text**, and deliberately: pinning the line verbatim would make this fail
     * on a Prettier reflow, which is a formatting change reporting itself as a
     * caret escaping. What is asserted is that nothing draws a glyph once the
     * declaration is removed.
     *
     * That the caret element carries `aria-hidden` is asserted on the *rendered
     * node* in `category-select.test.tsx` — a file-wide substring here would
     * pass on any unrelated `aria-hidden` in the same file.
     */
    const declaration = /const CARETS\s*=[\s\S]*?as const;/.exec(code);

    expect(declaration, 'the glyphs should live in one named declaration').not.toBeNull();

    const withoutDeclaration = code.replace((declaration as RegExpExecArray)[0], '');

    for (const caret of CARETS) {
      expect(withoutDeclaration, `${picker} should draw ${caret} only via CARETS`).not.toContain(
        caret,
      );
    }
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
