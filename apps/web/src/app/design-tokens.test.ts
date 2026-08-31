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

/** Every source file a class can be written in — `.css` included. */
function sourceFiles(): [string, string][] {
  const root = join(process.cwd(), 'src');

  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    .sort()
    .map((entry) => [join('src', entry), readFileSync(join(root, entry), 'utf8')]);
}

describe('every colour class names a step the theme defines', () => {
  const ramps = definedSteps();

  it('reads a real ramp out of the theme, so the scan cannot be vacuous', () => {
    // If this ever reads zero ramps the guard below passes on nothing.
    expect(ramps.size).toBeGreaterThanOrEqual(5);
    expect(ramps.get('stone')?.has('900')).toBe(true);
    expect(ramps.get('clay')?.has('400')).toBe(true);
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
   * The four this guard found on its first run, each owned by **#376**.
   *
   * A ratchet, not an allowlist: the list only ever shrinks, and #376's
   * acceptance is that these are deleted rather than amended. They are recorded
   * here rather than fixed in the lane that found them because they sit on three
   * surfaces that lane touches nothing else in — two of which carry their own
   * frames, so the right step is a measurement rather than a guess.
   */
  const KNOWN_UNDEFINED_STEPS = [
    'src/app/bookings/[requestId]/checkout/page.tsx — bg-sage-500 (sage has no 500)',
    'src/components/bookings/booking-confirmed.tsx — text-sage-700 (sage has no 700)',
    'src/components/checkout/checkout-screen.tsx — bg-sage-500 (sage has no 500)',
    'src/components/portfolio/portfolio-manager.tsx — text-steel-700 (steel has no 700)',
  ] as const;

  it('finds none in the app’s own source beyond the four #376 owns', () => {
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
