import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { sourceFiles, TS_AND_TSX, WEB_SOURCE, type SourceFile } from '@/testing/source-scan';

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

/** The components tree, walked and read once for every check below. */
let files: SourceFile[] = [];
/** The whole web source tree, for the rules that a route or a page can break too. */
let allFiles: SourceFile[] = [];

beforeAll(async () => {
  [files, allFiles] = await Promise.all([
    sourceFiles(COMPONENTS_DIR),
    sourceFiles(WEB_SOURCE, TS_AND_TSX),
  ]);
});

/**
 * An element declaring an indicator **of its own** — not one it paints for a
 * descendant.
 *
 * The `has-[…]:` and `group-…:` variants are deliberately excluded: those draw
 * on an ancestor for a control that is focused somewhere else, and that control
 * is the thing that must opt out, in whichever file defines it.
 */
const OWN_INDICATOR =
  /(?<![\]:\w-])focus-visible:(?:ring-[1-9]|inset-ring-[1-9]|outline-(?:[1-9]|\[)|border-clay-400)|\bFIELD_FOCUS\b/;

/** The one escape hatch. `@/lib/focus` and `app/globals.css` say why. */
const OPTS_OUT = /\bdata-focus-own\b/;

/**
 * `@/lib/focus` is where the treatments are *written*; it renders nothing and
 * has no element to hang the attribute on. Every other file that names them is
 * applying them.
 */
const DEFINES_THE_TREATMENTS = 'lib/focus.ts';

function declaresOwnIndicator({ name, code }: SourceFile): boolean {
  return name !== DEFINES_THE_TREATMENTS && OWN_INDICATOR.test(code);
}

describe('focus rings paint', () => {
  it('finds the components it is meant to be guarding', async () => {
    // Guards the guard: a scan that matched nothing would pass forever while
    // the rule it encodes went unenforced.
    expect(files.length).toBeGreaterThan(10);
  });

  it('never restores an outline width on focus without its line style', () => {
    const offenders: string[] = [];
    for (const { name, code } of files) {
      for (const [index, line] of code.split('\n').entries()) {
        if (SUPPRESSES.test(line) && RESTORES_WIDTH.test(line) && !RESTORES_STYLE.test(line)) {
          offenders.push(`${name}:${index + 1}`);
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
  /*
   * #383, and the defect the user reported: *"multiple (including an outdated
   * focus) on the inputs"*.
   *
   * `globals.css` puts the unbordered treatment on every `:focus-visible` that
   * has not claimed its own, and a component cannot partly override it —
   * `ring-*`, `inset-ring-*`, `ring-offset-*` and `outline` are four separate
   * properties, so overriding one leaves the other three painting. A plain text
   * input measured **three** concentric edges that way and the search bar
   * stacked **four**. Seven components hit this; three of them found it and
   * turned the base rule off by hand, each in its own idiom, and nothing made
   * the fourth do the same.
   *
   * So: declare your own indicator and you must also carry `data-focus-own`.
   * File-scoped rather than element-scoped, because half these class lists live
   * in a `const` at module scope while the attribute is on the JSX below it —
   * the pairing is what is checkable here, and the rendered proof that each
   * node paints exactly one indicator is `e2e/focus-indicator.spec.ts`.
   */
  it('never declares its own focus indicator without opting out of the base rule', () => {
    const offenders = allFiles
      .filter((file) => declaresOwnIndicator(file) && !OPTS_OUT.test(file.code))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it('finds the declarations that rule is meant to be pairing', () => {
    // Guards the guard, the lesson #411 recorded: a source rule that matches
    // nothing passes forever while defending nothing.
    const declaring = allFiles.filter(declaresOwnIndicator);

    expect(declaring.length).toBeGreaterThanOrEqual(8);
  });

  /*
   * The same idiom, written twice, is two idioms — which is the second half of
   * what the user was seeing: the same field type rendered a different ring
   * depending on which file built it.
   *
   * `border-ring` and `ring-ring/50` are shadcn's own tokens, never
   * re-tokenised in five files; `rgba(180,85,47,…)` is `clay-400` written so no
   * token change can reach it. Both go through `@/lib/focus` now.
   */
  it('routes every focus colour through a token, not a second source', () => {
    const offenders: string[] = [];

    for (const { name, code } of allFiles) {
      /*
       * Stripe's Elements render in a cross-origin iframe that no stylesheet of
       * ours reaches, so its appearance rules are hand-written hexes by
       * necessity. The file is allowed the literal and `checkout-screen.tsx`
       * carries the comment tying the value back to the token.
       */
      if (name.endsWith('checkout/checkout-screen.tsx')) {
        continue;
      }

      if (/\b(?:border-ring|ring-ring)\b/.test(code) || /rgba\(\s*180\s*,/.test(code)) {
        offenders.push(name);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never transitions the property its focus ring is painted with', () => {
    const offenders: string[] = [];
    for (const { name, code } of files) {
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
        offenders.push(name);
      }
    }

    expect(offenders).toEqual([]);
  });
});
