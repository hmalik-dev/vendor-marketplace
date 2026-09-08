import { beforeAll, describe, expect, it } from 'vitest';

import { sourceFiles, type SourceFile, TS_AND_TSX, withoutComments } from './testing/source-scan';
import { inkGroundViolations, INK_GROUND, INK_TEXT, STONE_ROLES } from './testing/token-roles';

/**
 * #447 — the law that ends the need for a fourth per-call-site guard.
 *
 * The three that exist stay. Each also pins *which* of the legal ink tokens the
 * frame names, which is parity and cannot be derived from a role table, and a
 * negative assertion at a call site records that **this** site got it wrong
 * once — history the law does not carry. What the law replaces is writing a
 * new one every time the mistake recurs somewhere fresh.
 *
 * `testing/token-roles.ts` holds the reasoning. This file proves the guard can
 * fail: every clause is exercised against the source that actually shipped the
 * defect, because a guard nobody has watched fail is not a guard.
 */

/**
 * Dedent, because the guard reads top-level declarations at column zero.
 *
 * That anchor is deliberate — a nested `const` inside a function body must not
 * be mistaken for a top-level one, or it truncates the enclosing component's
 * chunk and the walk loses the rest of its body. Prettier puts every real
 * top-level declaration at column zero, so the fixtures have to sit there too
 * or they are testing a shape the codebase never has.
 */
function scan(code: string) {
  const lines = code
    .replace(/^\n/, '')
    .replace(/\n[ ]*$/, '')
    .split('\n');
  const indent = Math.min(
    ...lines.filter((line) => line.trim() !== '').map((line) => /^ */.exec(line)![0].length),
  );

  return inkGroundViolations({
    name: 'fixture.tsx',
    code: withoutComments(lines.map((line) => line.slice(indent)).join('\n')),
  });
}

describe('the ink-ground token guard fails on the defects it exists to catch', () => {
  it('catches a border token used as text on ink — #430 and #441', () => {
    const found = scan(`
      export function Band() {
        return (
          <section className="bg-stone-900">
            <p className="mt-3 text-cta text-stone-400">Grow your business</p>
          </section>
        );
      }
    `);

    expect(found).toHaveLength(1);
    expect(found[0]?.utility).toBe('text-stone-400');
    expect(found[0]?.reason).toContain('not an ink-ground text value');
  });

  it('catches a surface token used as a border on ink — the footer hairline, #441', () => {
    const found = scan(`
      export function Footer() {
        return (
          <footer className="bg-stone-950">
            <div data-slot="footer-legal" className="border-t border-stone-0/10 pt-4" />
          </footer>
        );
      }
    `);

    expect(found).toHaveLength(1);
    expect(found[0]?.utility).toBe('border-stone-0/10');
    expect(found[0]?.reason).toContain('not an ink-ground border value');
  });

  it('catches an alpha standing in for an ink step — the defect that minted the ramp', () => {
    const found = scan(`
      export function Band() {
        return (
          <section className="bg-stone-900">
            <p className="text-stone-50/78">Grow your business</p>
          </section>
        );
      }
    `);

    expect(found).toHaveLength(1);
    expect(found[0]?.utility).toBe('text-stone-50/78');
    expect(found[0]?.reason).toContain('the alpha is not');
  });

  it('reads a class string hoisted out of the subtree — the footer link columns', () => {
    const found = scan(`
      const LINK_CLASS = 'text-stone-400 underline-offset-4 hover:text-stone-50';

      export function Footer() {
        return (
          <footer className="bg-stone-950">
            <a className={cn(LINK_CLASS, 'font-semibold')}>About</a>
          </footer>
        );
      }
    `);

    expect(found.map((violation) => violation.utility)).toEqual(['text-stone-400']);
  });

  /*
   * The hole that made the first version of this guard nearly worthless, and
   * the reason the walk follows names transitively rather than reading the
   * subtree alone. `site-footer.tsx` is shaped exactly like this: `<footer>`
   * sits at the bottom and delegates to components declared above it, so
   * `COLUMN_HEADING` — the footer's micro-label colour — was never read.
   * Setting it to `text-stone-400` left the whole suite green.
   */
  /*
   * The same defect one scope up. The enclosing component's own body is not in
   * the subtree, and nothing names it — you are already inside it — so a class
   * constant bound there rather than at module scope was invisible too.
   */
  it('follows a class constant bound inside the enclosing component', () => {
    const found = scan(`
      export function Footer() {
        const legal = 'text-meta text-stone-400 underline-offset-4';

        return (
          <footer className="bg-stone-950">
            <a className={legal}>Terms</a>
          </footer>
        );
      }
    `);

    expect(found.map((violation) => violation.utility)).toEqual(['text-stone-400']);
  });

  it('follows a component declared beside the ink element, not only inside it', () => {
    const found = scan(`
      const COLUMN_HEADING = 'text-label font-semibold text-stone-400 uppercase';

      function FooterColumn({ heading }) {
        return <p className={COLUMN_HEADING}>{heading}</p>;
      }

      export function Footer() {
        return (
          <footer className="bg-stone-950">
            <FooterColumn heading="Browse" />
          </footer>
        );
      }
    `);

    expect(found.map((violation) => violation.utility)).toEqual(['text-stone-400']);
  });

  /*
   * `border-t-stone-0` is #441's hairline defect in the directional form, and
   * this repo writes that form (`ui/button.tsx`, `search/search-bar.tsx`). A
   * pattern knowing only `border-stone-0` would have read it as clean.
   */
  it('catches the directional border form as well as the undirected one', () => {
    const found = scan(
      '<footer className="bg-stone-950"><hr className="border-t-stone-0/10" /></footer>',
    );

    expect(found.map((violation) => violation.utility)).toEqual(['border-t-stone-0/10']);
  });

  it('does not treat a variant-prefixed fill as a ground', () => {
    /*
     * `hover:bg-stone-900` is a tint on some other ground. Reading it as a
     * ground would make the whole subtree an ink region and flag its correct
     * light-ground text — `tag-category-section.tsx` writes one.
     */
    expect(
      scan('<div className="hover:bg-stone-900"><p className="text-stone-600" /></div>'),
    ).toEqual([]);
  });

  it('names the ink region, not the offending line, so the ground is in the failure', () => {
    const found = scan(
      [
        '<div>',
        '  <section className="bg-stone-900">',
        '    <p className="text-stone-300" />',
        '  </section>',
        '</div>',
      ].join('\n'),
    );

    expect(found[0]?.line).toBe(2);
  });
});

describe('the ink-ground token guard passes what is correct', () => {
  it('accepts the ink text ramp and an alpha hairline', () => {
    const found = scan(`
      export function Band() {
        return (
          <section className="bg-stone-900">
            <h3 className="text-stone-50">Grow</h3>
            <p className="text-stone-480">Pitch</p>
            <p className="text-stone-540">Body</p>
            <div className="border-t border-stone-50/10 pt-4" />
          </section>
        );
      }
    `);

    expect(found).toEqual([]);
  });

  it('leaves a light ground alone, however dark the scrim above it', () => {
    const found = scan(`
      export function Card() {
        return (
          <div className="bg-stone-0 border-stone-300">
            <span className="text-stone-400" aria-hidden="true">&#9733;</span>
            <div className="absolute inset-0 bg-stone-900/40" />
            <p className="text-stone-600">Muted</p>
          </div>
        );
      }
    `);

    expect(found).toEqual([]);
  });

  it('treats a bare ink fill on a control as a ground and an alpha fill as a scrim', () => {
    expect(scan('<button className="bg-stone-900 text-stone-300">Go</button>')).toHaveLength(1);
    expect(scan('<div className="bg-stone-900/55 text-stone-300" />')).toEqual([]);
  });
});

describe('the stone ramp', () => {
  /** The tree, walked and read once for all three checks below. */
  let files: SourceFile[] = [];

  beforeAll(async () => {
    files = await sourceFiles(undefined, TS_AND_TSX);
  });

  it('has no element inside an ink region reaching for the wrong role', () => {
    const violations = files.flatMap(inkGroundViolations);

    expect(
      violations.map((violation) => `${violation.file}:${violation.line} ${violation.reason}`),
    ).toEqual([]);
  });

  it('pins the files carrying a bare ink fill, so a silent zero cannot pass', () => {
    /*
     * `toEqual([])` above cannot tell "read three ink regions and found nothing
     * wrong" from "matched no ink ground at all and read nothing" — and the
     * second is one typo away, because the ground pattern is the guard's only
     * entry point. So pin the corpus separately.
     *
     * Six files carry a bare ink fill. Four are JSX elements and are walked —
     * the closing band, the admin header, the footer and a `search-shell`
     * button whose own `text-stone-50` is legal. Two hold the fill in a plain
     * string rather than on an element, so they contribute no subtree:
     * `button.tsx`'s `ink` variant and `logo.tsx`'s mono fill. Both halves are
     * deliberate, and this list changing means the ground pattern's reach
     * changed.
     */
    const grounded = files
      .filter((file) => INK_GROUND.test(file.code))
      .map((file) => file.name)
      .sort();

    expect(grounded).toEqual([
      'app/page.tsx',
      'components/admin/admin-header.tsx',
      'components/brand/logo.tsx',
      'components/search/search-shell.tsx',
      'components/site-footer.tsx',
      'components/ui/button.tsx',
    ]);
  });

  it('draws every ink-ground text step from the ramp, so no step is decorative', () => {
    const code = files.map((file) => file.code).join('\n');
    const ramp = [...INK_TEXT].filter((token) => STONE_ROLES[token]?.roles.length === 1);

    for (const token of ramp) {
      expect(code, `${token} is declared for ink text and used nowhere`).toContain(`text-${token}`);
    }
  });

  /*
   * The entry point is pinned above; this pins the **reach**, which is the part
   * that failed silently twice.
   *
   * Both holes found in review were a coverage drop, not a wrong verdict: the
   * scan read a smaller region than anyone believed and answered "clean" about
   * source it had never looked at. Neither changed the grounded-file list, and
   * no fixture noticed, because a fixture only proves the guard works on the
   * shape the fixture has.
   *
   * So mutate the real files. Each token below is one a real ink region draws
   * through a different route — an inline attribute, a module-level constant,
   * and a constant reached only through a component declared beside the ink
   * element. Swapping any of them for `text-stone-400` is the literal #430/#441
   * defect, and the guard has to say so. If a future edit narrows the reach,
   * this fails and names which route went dark.
   */
  it.each([
    ['app/page.tsx', 'text-stone-480', 'the closing band pitch, inline on the element'],
    ['components/site-footer.tsx', 'text-stone-520', 'the footer links, via a module constant'],
    ['components/site-footer.tsx', 'text-stone-560', 'the micro-labels, via FooterColumn'],
  ])('still reaches %s %s — %s', (name, token) => {
    const file = files.find((candidate) => candidate.name === name);

    expect(file, `${name} is not in the scanned corpus`).toBeDefined();
    expect(file!.code, `${name} no longer draws ${token}`).toContain(token);

    const mutated = {
      name,
      code: file!.code.replace(token, 'text-stone-400'),
    };

    expect(
      inkGroundViolations(mutated).map((violation) => violation.utility),
      `${token} in ${name} is outside the guard's reach`,
    ).toEqual(['text-stone-400']);
  });
});
