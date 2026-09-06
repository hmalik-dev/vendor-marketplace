import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { elements, sourceFiles, type SourceFile } from '@/testing/source-scan';

/**
 * The three accessibility defects a source scan can actually catch.
 *
 * None is visible on screen, none fails a render test, and none is something a
 * reviewer reliably notices — which is why all three shipped:
 *
 * 1. **One `<main>` per page.** `app/layout.tsx` wraps every route in
 *    `<main id="main">`, so a `<main>` anywhere else nests a landmark inside
 *    itself. Three routes did it — the booking request detail, checkout and the
 *    confirmed page. Landmark navigation announced two main regions, `Skip to
 *    content` landed on the layout wrapper rather than on the screen, and every
 *    `role=main` locator went ambiguous: Playwright's own `main` locator threw
 *    a strict-mode violation on those routes rather than finding either one.
 *
 * 2. **`aria-pressed` never lands on a link.** A link has no pressed state, so
 *    the attribute is a contradiction a reader resolves by ignoring: the
 *    filter reads as an ordinary link and nothing says which one is in effect.
 *    Two admin filter rows did this.
 *
 * 3. **An icon-only button has a name.** A `<button>` whose only child is an
 *    `aria-hidden` icon has an empty accessible name, so a screen reader
 *    announces "button" and stops. There is nothing to see and nothing to test
 *    for at render time — the button works perfectly for anyone who can see it.
 *
 * A grep beats a paragraph asking a future reader to remember, and beats an
 * `axe` pass too: `axe` only ever sees the routes something thought to render.
 */

/** The one file that is *supposed* to render the landmark, repo-relative. */
const LAYOUT = path.join('app', 'layout.tsx');

/**
 * The two tags that render a button here: the native one, and the primitive
 * that wraps it.
 *
 * `<Button size="icon">` is a button as far as a reader is concerned, and a
 * case-sensitive scan for `<button` misses every one of them.
 */
const BUTTON_TAGS = ['button', 'Button'] as const;

/**
 * An element carrying `aria-hidden`, self-closing or not — the backreference
 * ties the closer to whatever tag opened it, so an icon, a hidden `<span>` and
 * a hidden `<svg>` wrapper are all one case rather than three regexes with
 * different tag coverage.
 */
const HIDDEN = /<([A-Za-z][\w-]*)\b[^>]*\baria-hidden\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g;

/**
 * Anything on the tag that could give the button a name.
 *
 * A spread counts: `{...props}` may well carry an `aria-label` from the caller,
 * and this guard cannot follow it there. That is the one deliberate hole, and
 * it is narrower than the class of defect it would otherwise report falsely.
 */
const NAMED = /\b(?:aria-label|aria-labelledby|title)\s*=|\{\.\.\./;

/** The tree, walked and read once for all four checks below. */
let files: SourceFile[] = [];

beforeAll(async () => {
  files = await sourceFiles();
});

/** The 1-indexed line `index` falls on, for a failure that can be opened. */
function lineAt(code: string, index: number | undefined): number {
  return code.slice(0, index).split('\n').length;
}

describe('landmarks and icon buttons', () => {
  it('finds the source it is meant to be guarding', () => {
    // Guards the guard: a scan that matched nothing would pass forever while
    // the rules it encodes went unenforced.
    expect(files.length).toBeGreaterThan(100);
  });

  it('renders <main> in the root layout and nowhere else', () => {
    const renderers = files.filter((file) => /<main\b/.test(file.code)).map((file) => file.name);

    expect(renderers).toEqual([LAYOUT]);
  });

  /*
   * A link has no pressed state, so `aria-pressed` on one is a contradiction a
   * reader resolves by ignoring it — the filter reads as an ordinary link and
   * nothing says which one is in effect. Two admin filter rows did this;
   * `aria-current` is the attribute that means "this is the view you are on".
   *
   * Scoped to the opening tag, so a `<button aria-pressed>` three lines below a
   * `<Link>` is not read as one.
   */
  it('never puts aria-pressed on a link', () => {
    const offenders: string[] = [];

    for (const { name, code } of files) {
      for (const match of code.matchAll(/<(?:Link|a)\b([^>]*)>/g)) {
        if (/\baria-pressed\s*=/.test(match[1] ?? '')) {
          offenders.push(`${name}:${lineAt(code, match.index)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /** Every button in the tree that has provably nothing for a reader to read. */
  function iconOnlyButtons(): { where: string; named: boolean }[] {
    const found: { where: string; named: boolean }[] = [];

    for (const { name, code } of files) {
      for (const tag of BUTTON_TAGS) {
        for (const element of elements(code, tag)) {
          /*
           * "Icon-only" means every child is hidden from assistive technology.
           * A button with any text node, any interpolation or any unhidden
           * element in it may well have a name from its content, and this
           * guard does not try to evaluate that — it only refuses the case
           * where there is provably nothing to read.
           */
          if (element.children.replace(HIDDEN, '').trim() !== '') {
            continue;
          }

          found.push({
            where: `${name}:${element.line}`,
            named: NAMED.test(element.attributes),
          });
        }
      }
    }

    return found;
  }

  /*
   * Guards the guard, and this one is not ceremony.
   *
   * The first version of this rule matched the opening tag with
   * `/<button\b([^>]*)>/`, which stops at the first `>` — and an inline
   * `onClick={() => …}` puts one inside the tag. The captured attributes were
   * a truncated prefix and the "children" started with the tag's own leftover
   * attribute text, so almost every icon button looked like it had visible
   * content. It passed, and it was defending nothing.
   *
   * The check that catches that is not "does it pass": it is "does it find the
   * cases at all". Deleting every accessible name in the tree must leave this
   * rule with real work to do.
   */
  it('actually finds the icon-only buttons it is meant to be reading', () => {
    const buttons = iconOnlyButtons();

    expect(buttons.length).toBeGreaterThanOrEqual(7);
    // And every one of them is named — which is the rule below, stated as the
    // reason this count is allowed to be non-zero.
    expect(buttons.filter((button) => !button.named)).toEqual([]);
  });

  it('gives every icon-only button an accessible name', () => {
    const offenders = iconOnlyButtons()
      .filter((button) => !button.named)
      .map((button) => button.where);

    expect(offenders).toEqual([]);
  });
});
