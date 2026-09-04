import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Every colour class in this app names a step the shared theme defines.
 *
 * The defect this exists for: `text-stone-800` shipped on the category picker
 * at a time when the ramp had no 800 step, so Tailwind fell through to its own
 * *cool* stone and the chip measured `oklch(0.268 0.007 34.298)` — a colour
 * from no palette in this product, on a screen under a parity gate, invisible
 * to every test.
 *
 * The guard that caught it asserted "the theme defines no `--color-stone-800`",
 * which was the wrong statement: it pinned one absent number rather than the
 * rule, and #15 then legitimately needed that step for frame `13`'s inverted
 * header. This is the rule instead — **a class may only name a step the theme
 * defines** — over every ramp and every file type the classes live in.
 *
 * It lives in its own file rather than inside a component's parity test,
 * because it guards the theme rather than any one screen: buried there it was
 * findable by nobody and would have been deleted with that component.
 */

const require = createRequire(import.meta.url);
const themeCss = readFileSync(
  require.resolve('@vendor-marketplace/config/tailwind/theme.css'),
  'utf8',
);
const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** Every `--color-<ramp>-<step>` the theme declares, as `ramp -> steps`. */
function definedSteps(): Map<string, Set<string>> {
  const ramps = new Map<string, Set<string>>();

  for (const [, ramp, step] of themeCss.matchAll(/--color-([a-z]+)-(\d+):/g)) {
    const steps = ramps.get(ramp as string) ?? new Set<string>();
    steps.add(step as string);
    ramps.set(ramp as string, steps);
  }

  return ramps;
}

/**
 * Utilities that take a colour. Written out rather than matched loosely,
 * because `-stone-` preceded by a hyphen is exactly what a lazy pattern misses:
 * `ring-offset-stone-800` is a real class and its ramp segment is not at a word
 * boundary.
 */
const COLOUR_UTILITIES = [
  'accent',
  'bg',
  'border',
  'caret',
  'decoration',
  'divide',
  'fill',
  'from',
  'outline',
  'placeholder',
  'ring',
  'ring-offset',
  'shadow',
  'stroke',
  'text',
  'to',
  'via',
];

/**
 * Comments stripped, so the scan reads code and not prose.
 *
 * The scanner cannot otherwise tell the two apart, and the consequence is
 * backwards: a comment explaining that a class **was** removed reads as the
 * class still being there. #386 hit exactly that — documenting the fix
 * re-triggered the guard on the file it had just fixed, and the workaround was
 * to write the class name in prose, which is a worse comment written to please
 * a test.
 *
 * A guard that fires on correct code is one somebody eventually deletes, so the
 * fix belongs here rather than in every comment that has to name a class.
 * Deliberately crude — it removes block comments and line comments and nothing
 * else, which is enough, because a class name inside a string that merely
 * *looks* like a comment is still a class name and should still be flagged.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Every source file a class can be written in — `.css` included. */
function sourceFiles(): [string, string][] {
  const root = join(process.cwd(), 'src');

  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    .sort()
    .map((entry) => [join('src', entry), withoutComments(readFileSync(join(root, entry), 'utf8'))]);
}

describe('every colour class names a step the theme defines', () => {
  const ramps = definedSteps();

  it('reads a real ramp out of the theme, so the scan cannot be vacuous', () => {
    // If this ever reads zero ramps the guard below passes on nothing.
    expect(ramps.size).toBeGreaterThanOrEqual(5);
    expect(ramps.get('stone')?.has('900')).toBe(true);
    expect(ramps.get('clay')?.has('400')).toBe(true);
  });

  /*
   * The stripper's own guard, in both directions. Without the second half it
   * could be made to pass by stripping everything.
   */
  it('reads code and not prose, so documenting a fix cannot re-trigger it', () => {
    const pattern = new RegExp(
      `(?:${COLOUR_UTILITIES.join('|')})-(${[...ramps.keys()].join('|')})-(\\d+)`,
      'g',
    );
    const hits = (source: string): string[] =>
      [...withoutComments(source).matchAll(pattern)].map(([match]) => match);

    // A comment explaining that the class was removed is not the class.
    expect(hits('/* was text-sage-950, now sage-600 */')).toEqual([]);
    expect(hits('// hovered to text-steel-950 once')).toEqual([]);
    // The class itself is still found, comment or no comment.
    expect(hits('className="text-sage-950"')).toEqual(['text-sage-950']);
    expect(hits('/* removed */ className="text-sage-950"')).toEqual(['text-sage-950']);
    // A URL is not a comment: `//` after a colon must survive.
    expect(hits('const url = "https://x.test"; // text-sage-950')).toEqual([]);
    expect(hits('a("https://x.test/text-sage-950")')).toEqual(['text-sage-950']);
  });

  it('flags a step the theme does not define', () => {
    // Proves the failure case: `sage-950` is not in the ramp.
    const pattern = new RegExp(
      `(?:${COLOUR_UTILITIES.join('|')})-(${[...ramps.keys()].join('|')})-(\\d+)`,
      'g',
    );
    const hits = [...'class="bg-sage-950"'.matchAll(pattern)].map(
      ([, ramp, step]) => `${ramp as string}-${step as string}`,
    );

    expect(hits).toEqual(['sage-950']);
    expect(ramps.get('sage')?.has('950')).toBe(false);
  });

  /**
   * Empty, and that is the point: the ratchet reached zero.
   *
   * The guard found four undefined steps on its first run. **#387** deleted the
   * two checkout `bg-sage-500` sites once it made frame `05 Checkout` reachable
   * for the end-to-end customer and could measure the dot rather than guess at
   * a ramp step — both frame occurrences draw `#5E6B4F`, which is `sage-400`.
   * **#386** deleted the other two after measuring them the same way:
   * `booking-confirmed.tsx`'s `text-sage-700` became `sage-600`, and
   * `portfolio-manager.tsx`'s `hover:text-steel-700` was dropped outright,
   * because `steel` has nothing below 600 and no frame draws one.
   *
   * A ratchet, not an allowlist: entries are deleted rather than amended, and
   * the list only ever shrinks. It is now empty, so the next undefined step is
   * a failure rather than a line added here.
   */
  const KNOWN_UNDEFINED_STEPS: readonly string[] = [];

  it('finds none at all in the app’s own source', () => {
    const pattern = new RegExp(
      `(?:${COLOUR_UTILITIES.join('|')})-(${[...ramps.keys()].join('|')})-(\\d+)`,
      'g',
    );
    const undefinedSteps = [...sourceFiles(), ['src/app/globals.css', globalsCss] as const]
      .flatMap(([file, contents]) =>
        [...contents.matchAll(pattern)]
          .filter(([, ramp, step]) => !ramps.get(ramp as string)?.has(step as string))
          .map(
            ([match, ramp, step]) =>
              `${file} — ${match} (${ramp as string} has no ${step as string})`,
          ),
      )
      // The same class in twenty files is one finding, not twenty.
      .filter((entry, index, all) => all.indexOf(entry) === index);

    expect(undefinedSteps).toEqual([...KNOWN_UNDEFINED_STEPS]);
  });

  /*
   * The corpus floor, and with the ratchet at zero it is the only thing left
   * holding this guard to reality: `toEqual([])` cannot tell "scanned twelve
   * hundred classes, every one defined" from "scanned nothing". The theme read
   * is already guarded twice this way; the source read was not, and the
   * comment stripper is exactly the code that can shrink it silently — making
   * its quantifier greedy takes the scan from ~1220 matches to ~308 while
   * every assertion in this file still passes.
   */
  it('reads a real corpus, so an empty result cannot come from an empty scan', () => {
    const pattern = new RegExp(
      `(?:${COLOUR_UTILITIES.join('|')})-(${[...ramps.keys()].join('|')})-(\\d+)`,
      'g',
    );
    const files = sourceFiles();
    const matches = files.flatMap(([, contents]) => [...contents.matchAll(pattern)]);

    expect(files.length).toBeGreaterThan(150);
    expect(matches.length).toBeGreaterThan(1000);
    // A class that is definitely there, so the scan is reading source and not
    // an accidentally-empty string.
    expect(matches.some(([match]) => match === 'text-stone-900')).toBe(true);
  });

  /*
   * The ratchet's own guard. Without it an exemption could outlive its defect
   * and quietly become permission, which is how an allowlist rots.
   */
  it('carries no exemption for a step that is now defined', () => {
    const stale = KNOWN_UNDEFINED_STEPS.filter((entry) => {
      const [, ramp, step] = /\((\w+) has no (\d+)\)/.exec(entry) ?? [];

      return ramp !== undefined && step !== undefined && ramps.get(ramp)?.has(step) === true;
    });

    expect(stale).toEqual([]);
  });
});

/*
 * The same trap, one namespace over.
 *
 * `--color-stone-800` was a step somebody wrote that the theme did not define,
 * which Tailwind silently resolved to its own cool built-in. `rounded-xs` is
 * the identical mistake against the radius scale: `theme.css` declares
 * `sm/md/lg/panel/xl/2xl`, Tailwind ships `--radius-xs: 0.125rem`, and a class
 * naming it compiles, renders, and rounds at 2px from a scale that is not this
 * product's — with no error and nothing in the suite able to notice.
 *
 * Found by `diff-reviewer` on #373, which had just closed the colour half. The
 * two live sites are ratcheted rather than fixed: both are focus-ring roundings
 * on inline links, and 2px against the scale's smallest step of 6px is a
 * visible difference on a control that hugs its text — a design call rather
 * than a mechanical substitution. What matters is that they are now visible and
 * that no third one can appear unnoticed.
 */
describe('every radius class names a step the theme defines', () => {
  /** Every `--radius-<name>` the theme declares. */
  const steps = new Set(
    [...themeCss.matchAll(/--radius-([a-z0-9-]+):/g)].map((match) => match[1] as string),
  );

  /**
   * The two live when the radius half of this guard was written.
   *
   * A ratchet, not an allowlist: it only ever shrinks. Neither is fixed here
   * because the substitution is not mechanical — see the block comment above.
   */
  const KNOWN_UNDEFINED_RADII = [
    'src/app/bookings/[requestId]/page.tsx — rounded-xs',
    'src/components/vendors/profile/about-pane.tsx — rounded-xs',
  ] as const;

  it('reads a real scale out of the theme, so the scan cannot be vacuous', () => {
    expect(steps.size).toBe(6);
    expect(steps.has('panel')).toBe(true);
    expect(steps.has('xs')).toBe(false);
  });

  it('finds none beyond the two already recorded', () => {
    /*
     * `full` and `none` are Tailwind keywords rather than scale steps. An
     * arbitrary `rounded-[Npx]` is excluded by the pattern — inline-value debt
     * is a different finding from a class naming a step that does not exist.
     */
    const keywords = new Set(['full', 'none']);
    /*
     * `rounded[-side][-step]`, where the step is not an arbitrary value. The
     * side segment has to be optional *and* allowed to stand alone — `rounded-t`
     * is a whole class, and a pattern that requires a step after the side reads
     * the `t` of `rounded-t-[18px]` as the step name.
     */
    const SIDES = new Set([
      't',
      'r',
      'b',
      'l',
      's',
      'e',
      'tl',
      'tr',
      'br',
      'bl',
      'ss',
      'se',
      'ee',
      'es',
    ]);
    const undefinedRadii = [...sourceFiles(), ['src/app/globals.css', globalsCss] as const]
      .flatMap(([file, contents]) =>
        [...contents.matchAll(/\brounded((?:-[a-z0-9]+)*)(-\[)?/g)].flatMap(
          ([, tail, arbitrary]) => {
            if (arbitrary !== undefined) {
              return [];
            }

            const segments = (tail as string).split('-').filter(Boolean);
            const step =
              segments.length > 1 || !SIDES.has(segments[0] ?? '') ? segments.at(-1) : undefined;

            return step === undefined || keywords.has(step) || steps.has(step)
              ? []
              : [`${file} — rounded-${step}`];
          },
        ),
      )
      .filter((entry, index, all) => all.indexOf(entry) === index)
      .sort();

    expect(undefinedRadii).toEqual([...KNOWN_UNDEFINED_RADII]);
  });

  it('carries no exemption for a step that is now defined', () => {
    const stale = KNOWN_UNDEFINED_RADII.filter((entry) => {
      const [, step] = /rounded-([a-z0-9-]+)$/.exec(entry) ?? [];

      return step !== undefined && steps.has(step);
    });

    expect(stale).toEqual([]);
  });
});
