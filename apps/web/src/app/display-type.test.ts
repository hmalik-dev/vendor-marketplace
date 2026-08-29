import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const themeCss = readFileSync(
  require.resolve('@vendor-marketplace/config/tailwind/theme.css'),
  'utf8',
);
// Vitest runs with the package root as cwd, which is where vitest.config.ts sits.
const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
/*
 * The screens bundle in `design/`, found by suffix rather than named: the file
 * carries the product name, and `brand-literals.test.ts` forbids that literal
 * in this tree. Matching on the suffix also survives a rebrand of the bundle.
 */
const designDirectory = join(process.cwd(), '../../design');
const framesFile = readdirSync(designDirectory).filter((entry) =>
  entry.endsWith('Screens.dc.html'),
);

if (framesFile.length !== 1) {
  throw new Error(`Expected exactly one screens frame file in design/, found ${framesFile.length}`);
}

const frames = readFileSync(join(designDirectory, framesFile[0] as string), 'utf8');

/**
 * The smallest size Instrument Serif may be set at. `01-foundations.md` states
 * it as a rule of the type system — "Never below 16px" — not as a preference.
 */
const SERIF_FLOOR_PX = 16;

/**
 * The classes that opt an element into Instrument Serif. Keeping this list
 * short is the point: a `--font-heading: var(--font-display)` alias used to sit
 * in `@theme inline`, which generated a third name for the same face and put
 * shadcn's dialog title into Serif at 13.5px where this guard could not see it.
 * `no second name for the display face` below is what keeps the list honest.
 */
const SERIF_HOOKS = ['font-display', 'display-heading'] as const;

/**
 * Hoisted out of the filter: recompiling these per region says nothing. `-` is
 * excluded on both sides as well as word characters, so the `next/font`
 * variable name `--font-display-face` in `layout.tsx` is not read as a class.
 */
const SERIF_PATTERNS = SERIF_HOOKS.map((hook) => new RegExp(`(?<![\\w-])${hook}(?![\\w-])`));

/**
 * Every `--text-*` step in the shared scale, in px. The `--text-*--line-height`
 * companions are excluded by requiring the value to be a length. `rem` is read
 * as well as `px` because the scale belongs to another package — expressing a
 * step in `rem` is a legitimate edit there, and it must not silently drop a
 * step out of this map and make the floor guard vacuous for it.
 */
const SIZE_TOKENS = new Map<string, number>([
  ...[...themeCss.matchAll(/--text-([a-z0-9-]+):\s*([\d.]+)(px|rem);/g)].map(
    (match): [string, number] => [
      `text-${match[1] as string}`,
      Number.parseFloat(match[2] as string) * (match[3] === 'rem' ? 16 : 1),
    ],
  ),
  // `/suspended` still reaches for a stock Tailwind step rather than a project
  // token; moving it onto the shared scale is the type scale's own work.
  ['text-3xl', 30],
]);

/**
 * Two components size their own serif text from a numeric prop through the
 * `style` attribute, so no class states their size and the guard below cannot
 * read it. Both are listed rather than skipped: a third one appearing is a
 * change that has to be looked at, not absorbed.
 */
const SIZED_OUTSIDE_THE_CLASS_SYSTEM = [
  'src/components/brand/logo.tsx',
  'src/components/ui/avatar.tsx',
];

interface ClassNameUse {
  readonly file: string;
  readonly line: number;
  readonly value: string;
}

/**
 * A `className`, either quoted or as a `{...}` expression. The expression form
 * is matched to two levels of nesting, which covers every `cn()` call and
 * ternary in the tree with room to spare.
 */
const CLASS_NAME = /className=(?:"([^"]*)"|\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\})/g;

/**
 * A plain string or template literal. Class strings do not only appear inline:
 * `site-footer.tsx` keeps one in a `const` and passes the identifier, and the
 * hook and the size then live in that literal rather than in any `className=`.
 * Reading both shapes is what stops a serif hook hiding behind a constant.
 */
const STRING_LITERAL = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g;

/**
 * Every region of the app's source that could carry Tailwind classes. `cn()`
 * calls and ternaries are captured whole — a size and a font hook regularly sit
 * in different string literals of one expression, and splitting them loses the
 * pairing that this file is about.
 */
function classNameUses(): ClassNameUse[] {
  const uses: ClassNameUse[] = [];

  for (const [file, source] of sourceFiles()) {
    const spans: { start: number; end: number; value: string }[] = [];

    for (const pattern of [CLASS_NAME, STRING_LITERAL]) {
      for (const match of source.matchAll(pattern)) {
        const value = match.slice(1).find((group) => group !== undefined);

        if (value !== undefined) {
          spans.push({ start: match.index, end: match.index + match[0].length, value });
        }
      }
    }

    /*
     * A `className={cn('font-display …', big ? 'text-[19px]' : 'text-display-sm')}`
     * yields the whole attribute AND each literal inside it. Only the attribute
     * pairs the hook with the size, so a span wholly inside another is dropped —
     * otherwise the inner literal reads as a serif class with no size at all.
     */
    for (const span of spans) {
      const contained = spans.some(
        (other) => other !== span && other.start <= span.start && span.end <= other.end,
      );

      if (!contained) {
        uses.push({
          file,
          line: source.slice(0, span.start).split('\n').length,
          value: span.value,
        });
      }
    }
  }

  return uses;
}

/** Every non-test source file under `src`, as `[repo-relative path, contents]`. */
function sourceFiles(): [string, string][] {
  const root = join(process.cwd(), 'src');

  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    .sort()
    .map((entry) => [join('src', entry), readFileSync(join(root, entry), 'utf8')]);
}

/** Every font size a className states, in px, ignoring colour and other `text-*`. */
function sizesIn(value: string): number[] {
  return [...value.matchAll(/\btext-(?:\[([\d.]+)px\]|([a-z0-9-]+))/g)]
    .map(([, arbitrary, token]) =>
      arbitrary === undefined
        ? SIZE_TOKENS.get(`text-${token as string}`)
        : Number.parseFloat(arbitrary),
    )
    .filter((size): size is number => size !== undefined);
}

const serifUses = classNameUses().filter((use) =>
  SERIF_PATTERNS.some((pattern) => pattern.test(use.value)),
);

/** The body of the one rule this file is about, captured once. */
const displayHeadingRule = globalsCss.match(/\.display-heading\s*\{([^}]*)\}/)?.[1] ?? '';

/**
 * The frames' own display-heading tracking, read from the bundle rather than
 * restated here. Whitespace is tolerated around the brace and the colon: the
 * bundle ships minified today, but a re-export that pretty-prints it is a merge
 * this project expects, and it should not read as a typography failure.
 */
const frameTracking = Number.parseFloat(
  frames.match(/\.h2\s*\{[^}]*letter-spacing:\s*(-?[\d.]+)em/)?.[1] ?? 'NaN',
);

describe('display type is a role, not a heading level', () => {
  /*
   * The rule this replaces applied the display face and Tailwind's tight
   * tracking step (-0.025em) from `h1, h2, h3`. Those class names are spelled
   * out nowhere in this file on purpose: Tailwind v4 scans comments too, and
   * naming them here emits the utilities into the stylesheet as dead CSS.
   * Element type is document structure: a rail's `SELECTED` micro-label is an
   * `h2` because it heads a section, not because it should be set in Serif.
   *
   * The check is an allowlist rather than a list of forbidden selector shapes,
   * because enumerating the bad shapes is a game you lose: `body h1, body h2`
   * and `[data-auth-screen] .cl-formFieldLabel` both restore sub-floor Serif
   * while looking nothing like the rule that was removed. Asking instead which
   * selectors may carry the face has one answer, and it is the hook.
   */
  it('applies the display face from the hook and from nothing else', () => {
    // Comments are stripped first: the block above quotes the removed rule.
    const declarations = globalsCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const offenders: string[] = [];

    for (const rule of declarations.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const [selectors, body] = [rule[1] as string, rule[2] as string];

      if (!/font-display|--font-display/.test(body)) {
        continue;
      }

      for (const selector of selectors.split(',')) {
        const trimmed = selector.trim().replace(/\s+/g, ' ');

        // `@theme`/`@layer` heads are not selectors, and the theme block is
        // where `--font-display` is legitimately declared.
        if (trimmed === '' || trimmed.startsWith('@') || trimmed === '.display-heading') {
          continue;
        }

        offenders.push(`${trimmed} { ${body.trim()} }`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('offers one explicit hook for display type', () => {
    expect(displayHeadingRule).toMatch(/font-family:\s*var\(--font-display\)/);
  });

  /*
   * The invariant the whole mechanism rests on, and the one nothing else here
   * would notice breaking. Unlayered CSS beats layered CSS, and `components`
   * loses to `utilities` by declared layer order — so moving this rule out of
   * `@layer components` makes it start winning against the landing hero's
   * `tracking-[-.02em]` and the error screens' `-.015em`, with every other
   * assertion in this file still green.
   */
  it('keeps the hook inside the components layer, where a utility still beats it', () => {
    const componentsLayer = globalsCss.match(/@layer components\s*\{([\s\S]*?)\n\}/);

    expect(componentsLayer).not.toBeNull();
    expect(componentsLayer?.[1]).toContain('.display-heading');
  });

  /*
   * An alias generates a second utility for the same face, and the floor guard
   * below only knows the names in SERIF_HOOKS. `--font-heading` was exactly
   * that: one line in `@theme inline` that put shadcn's `DialogTitle` into
   * Instrument Serif at 13.5px, invisible to a guard looking for `font-display`.
   *
   * Both stylesheets are searched. The shared theme is as good a home for an
   * alias as this app's own file, and an alias declared there would reopen the
   * hole just as completely.
   */
  it('gives the display face no second name', () => {
    const aliases = [globalsCss, themeCss].flatMap((sheet) =>
      [...sheet.matchAll(/--font-([a-z-]+):\s*var\(--font-display\)/g)].map(
        (match) => `--font-${match[1] as string}`,
      ),
    );

    expect(aliases).toEqual([]);
  });
});

describe('Instrument Serif never renders below its floor', () => {
  /*
   * The whole-class guard for `01-foundations.md`'s "Never below 16px". It is
   * deliberately not a list of the micro-labels found once: it reads every
   * className in the app, so the next `h2`-as-micro-label reaching for the
   * serif hook fails here rather than in a parity sweep months later.
   *
   * It closes the rule only in company with the selector test above. That one
   * establishes that the display face can arrive *only* through an explicit
   * class; this one establishes that no such class sits on text under the
   * floor. Either alone leaves the other route open.
   */
  it('pairs every serif class with a size at or above the floor', () => {
    const tooSmall = serifUses
      .map((use) => ({ use, sizes: sizesIn(use.value) }))
      .filter(({ sizes }) => sizes.some((size) => size < SERIF_FLOOR_PX))
      .map(({ use, sizes }) => `${use.file}:${use.line} — ${Math.min(...sizes)}px`);

    expect(tooSmall).toEqual([]);
  });

  /*
   * Both halves of the guard read source with a regex, and a regex that stopped
   * matching passes silently. The scale in particular belongs to another
   * package: move it to `rem` or wrap a step in `calc()` and `SIZE_TOKENS`
   * empties, `sizesIn` returns nothing, and every size check above succeeds
   * without checking anything.
   */
  it('still resolves the scale and the classNames it checks against it', () => {
    expect(serifUses.length).toBeGreaterThan(40);
    expect(SIZE_TOKENS.size).toBeGreaterThan(8);
  });

  it('keeps the set of serif elements sized outside the class system fixed', () => {
    const unsized = [
      ...new Set(serifUses.filter((use) => sizesIn(use.value).length === 0).map((use) => use.file)),
    ].sort();

    expect(unsized).toEqual(SIZED_OUTSIDE_THE_CLASS_SYSTEM);
  });
});

describe('headings take their letter-spacing from the frames', () => {
  /*
   * The screens bundle in `design/` is the acceptance criterion, and it states
   * the display heading as a class rather than as a tag. Reading the value out
   * of the frame rather than restating it here means a design change fails this
   * test instead of drifting past it.
   */
  it('matches the frames’ display heading letter-spacing', () => {
    expect(frameTracking).not.toBeNaN();

    const ours = displayHeadingRule.match(/letter-spacing:\s*(-?[\d.]+)em/);

    expect(ours).not.toBeNull();
    expect(Number.parseFloat(ours?.[1] as string)).toBeCloseTo(frameTracking, 5);
  });

  /*
   * The workaround the hook exists to delete. The old blanket rule forced
   * -0.025em onto every heading, so each one that wanted the frame's value had
   * to restate the frame's number locally as an arbitrary tracking utility.
   *
   * The check is on the *value*, not on the hook, and that is the point: were
   * it written as "no `tracking-` on a `.display-heading`", every migrated site
   * could be reverted to the family hook plus that same local override — the
   * exact thing this criterion forbids — and match nothing. Restating the
   * frame's own number next to any serif hook is the defect, whichever hook it
   * is.
   */
  it('restates the frames’ tracking on no element at all', () => {
    const overridden = serifUses
      .filter((use) =>
        [...use.value.matchAll(/\btracking-\[(-?[\d.]+)em\]/g)].some(
          (match) => Math.abs(Number.parseFloat(match[1] as string) - frameTracking) < 1e-9,
        ),
      )
      .map((use) => `${use.file}:${use.line}`);

    expect(overridden).toEqual([]);
  });
});
