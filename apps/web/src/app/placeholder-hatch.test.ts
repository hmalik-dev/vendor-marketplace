import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The hatch is an editor primitive. The labelled `Placeholder` component is
 * gone — **D26**.
 *
 * `03-components.md:176` states it: "The labelled placeholder is a build-time
 * device, not a live empty state." D17 ruling 2 settled the public half — a
 * coverless vendor gets a neutral tone block, not a hatch and not a
 * developer-facing label naming the shot the product is waiting for.
 *
 * What was left was a component nobody rendered. `<Placeholder>` had zero call
 * sites, so it could only ever be reintroduced by accident, on the surface
 * where it is forbidden — the frames still draw hatched swatches, and the
 * obvious way to reproduce one is to reach for the component named after it.
 * Deleting it removes that route. The `placeholder-hatch` utility stays,
 * because the upload drop zone genuinely draws the frames' gradient.
 *
 * This guard is the other half: the hatch may appear on an editor surface and
 * nowhere else. Without it, "editor only" is a sentence in a design file that
 * nothing checks.
 */

/** Surfaces a vendor edits, as opposed to surfaces a customer reads. */
const EDITOR_SURFACES = ['src/components/image-upload.tsx'] as const;

/** Every non-test source file under `src`, as `[repo-relative path, contents]`. */
function sourceFiles(): [string, string][] {
  const root = join(process.cwd(), 'src');

  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    .sort()
    .map((entry) => [join('src', entry), readFileSync(join(root, entry), 'utf8')]);
}

describe('the hatch is an editor primitive (D26)', () => {
  const files = sourceFiles();

  it('reads the tree it is scanning, so the check cannot be vacuous', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some(([, source]) => source.includes('placeholder-hatch'))).toBe(true);
  });

  it('draws the hatch only on the surfaces a vendor edits', () => {
    const drawn = files
      .filter(([, source]) => source.includes("'placeholder-hatch'"))
      .map(([file]) => file);

    expect(drawn).toEqual([...EDITOR_SURFACES]);
  });

  /*
   * The component, not the utility. Asserted by absence of the file rather than
   * of a string: a reintroduced `Placeholder` would be a new file, and a scan
   * for its name would pass right up until the moment someone wrote one.
   */
  it('ships no labelled Placeholder component', () => {
    expect(files.map(([file]) => file)).not.toContain('src/components/ui/placeholder.tsx');
    expect(files.some(([, source]) => source.includes('data-slot="placeholder"'))).toBe(false);
    /*
     * The rendered accessible name, not the bare phrase: `filter-bar.tsx` has a
     * doc comment reading "Placeholder for the search field", about an input's
     * placeholder attribute, and a substring scan reads that as a hit.
     */
    expect(files.some(([, source]) => source.includes('aria-label={`Placeholder for '))).toBe(
      false,
    );
  });
});
