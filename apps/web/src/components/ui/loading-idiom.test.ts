import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "One idiom per screen, never two" — the loading table in `40-states.md`.
 *
 * A spinner says "this one control is busy"; a skeleton says "this content is
 * on its way and will land in this shape". A screen showing both is telling the
 * user two different stories about the same wait, and the eye goes to the
 * spinning thing, which is usually the less important one.
 *
 * The unit checked is the module, which is the closest static stand-in for a
 * screen: a component that imports both is one edit away from rendering both.
 * `ui/` primitives are exempt — they are where each idiom is *defined*, and a
 * barrel that exports both is not a screen.
 */
/*
 * Matched on how each idiom is actually reached: the spinner by its animation
 * class or the icon that carries it, the skeleton by the module it comes from
 * or a rendered `*Skeleton` tag. `\bSkeleton\b` would miss `VendorCardSkeleton`
 * entirely — there is no word boundary in front of a capital mid-identifier.
 *
 * `loading={…}` counts as a spinner because `Button` draws one from it. Without
 * that, the rule had a hole the moment the element loader moved inside a
 * component: a screen could render skeletons and a spinning button at once and
 * the check would see only the skeletons.
 *
 * The spinner lives in `ui/spinner.tsx` rather than beside the skeletons, so
 * importing it is not mistaken for importing a skeleton. That is what lets
 * `button.tsx` — which draws a spinner and no skeleton — be checked like any
 * other module instead of exempted.
 */
const SPINNER = /animate-spin|<Loader2\b|<Spinner\b|\bloading=\{/;
const SKELETON = /from '@\/components\/ui\/skeleton'|<\w*Skeleton\b/;

const EXEMPT = ['src/components/ui/skeleton.tsx', 'src/components/ui/sonner.tsx'];

function sourceFiles(directory: string, base: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    const relative = `${base}/${entry.name}`;

    if (entry.isDirectory()) {
      return sourceFiles(absolute, relative);
    }

    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [relative] : [];
  });
}

describe('loading idioms', () => {
  const root = join(process.cwd(), 'src');
  const files = sourceFiles(root, 'src').filter((file) => !EXEMPT.includes(file));

  it('finds the modules to check, so the guard cannot pass vacuously', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never renders a spinner and a skeleton in the same module', () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(join(process.cwd(), file), 'utf8');

      return SPINNER.test(source) && SKELETON.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
