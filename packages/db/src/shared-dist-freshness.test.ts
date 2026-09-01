import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * `packages/db` resolves `@vendor-marketplace/shared` through its **compiled**
 * `dist`, not its source — the package's `exports` map points there. So a
 * `dist` built before the last edit to `src` hands this suite a constant the
 * repository no longer declares, and the test that reads it fails naming a
 * symbol that is perfectly correct in source.
 *
 * The reproduction, 2026-08-31: rebase a lane onto a `main` that changed
 * `packages/shared/src/constants`, then run this suite. `seed-demo.test.ts` >
 * "writes every notification type the product defines" failed with the seed
 * writing 13 types against a 12-type constant, the missing one being
 * `tag_suggestion_approved` — both halves present and correct in source.
 *
 * It cost two sessions, in two different lanes, because the failure names the
 * *other* ticket's symbol and points at the seed: the natural reading is "that
 * merge broke main", not "my build output is old". A written rule was what
 * failed both times, so this is a test.
 *
 * `pnpm test` runs `^build` first and this can never fire there. It fires where
 * it bit — `vitest` run directly in the package, which is what everybody does
 * while iterating.
 */

const SHARED = join(import.meta.dirname, '..', '..', 'shared');
const SRC = join(SHARED, 'src');
const DIST = join(SHARED, 'dist');

const REBUILD = 'pnpm --filter @vendor-marketplace/shared build';

interface Stamp {
  readonly path: string;
  readonly mtimeMs: number;
}

/** Every file under `root`, with when it was last written, oldest first. */
function stamps(root: string, keep: (path: string) => boolean = () => true): readonly Stamp[] {
  return readdirSync(root, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(keep)
    .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
}

/*
 * Only the files the build actually reads. `tsconfig.build.json` excludes
 * every `.test.ts` under `src`, so a shared test file can never appear in
 * `dist` — and counting one as a source made editing a `packages/shared`
 * test fail `packages/db`, with a message blaming a build that was current.
 */
const SOURCES = stamps(SRC, (path) => !path.endsWith('.test.ts'));

/** `dist` may not exist at all — a lane installs long before it ever builds. */
const BUILT = readdirSync(SHARED).includes('dist') ? stamps(DIST) : [];

describe('the compiled @vendor-marketplace/shared this package imports', () => {
  it('has been built, from a source tree the scan can actually see', () => {
    // A walk that matches nothing would make the comparison below vacuous.
    expect(SOURCES.length, `${SRC} scan matched no files`).toBeGreaterThan(5);
    expect(BUILT.length, `${DIST} is missing or empty — run: ${REBUILD}`).toBeGreaterThan(0);
  });

  it('is newer than the sources it was built from', () => {
    const source = SOURCES.at(-1);
    const built = BUILT.at(-1);

    /*
     * Newest against newest, not newest-source against *oldest*-build.
     * `tsc` never deletes an output whose source was renamed away, so one
     * orphan left in `dist` would be the oldest file there for ever — failing
     * this permanently, and failing it in a way the rebuild it prescribes
     * cannot clear. `tsconfig.build.json` sets neither `composite` nor
     * `incremental`, so every build rewrites every output: the newest file in
     * `dist` is the build time.
     */
    expect(
      (built?.mtimeMs ?? 0) >= (source?.mtimeMs ?? Infinity),
      `packages/shared/dist is older than its source, so this package is importing ` +
        `constants the repository no longer declares. A failure naming a symbol that ` +
        `looks correct in src is this, not the ticket it names.\n` +
        `  newest source: ${source?.path}\n` +
        `  newest build:  ${built?.path ?? '(nothing built)'}\n` +
        `  fix: ${REBUILD}`,
    ).toBe(true);
  });
});
