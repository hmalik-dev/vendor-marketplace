import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Vitest runs with the package root as cwd, where vitest.config.ts sits. */
const APP_DIR = join(process.cwd(), 'src/app');

interface RouteFile {
  /** Path relative to `src/app`, e.g. `vendors/[slug]/page.tsx`. */
  path: string;
  /** The directory segments above it, e.g. `['vendors', '[slug]']`. */
  segments: string[];
}

function walk(directory: string, collected: RouteFile[] = []): RouteFile[] {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);

    if (statSync(absolute).isDirectory()) {
      walk(absolute, collected);
      continue;
    }

    const path = relative(APP_DIR, absolute);
    collected.push({ path, segments: path.split(sep).slice(0, -1) });
  }

  return collected;
}

const ROUTE_FILES = walk(APP_DIR);

const LOADING_SEGMENTS = ROUTE_FILES.filter((file) => file.path.endsWith(`${sep}loading.tsx`))
  .concat(ROUTE_FILES.filter((file) => file.path === 'loading.tsx'))
  .map((file) => file.segments);

const NOT_FOUND_PAGES = ROUTE_FILES.filter(
  (file) =>
    file.path.endsWith('page.tsx') &&
    readFileSync(join(APP_DIR, file.path), 'utf8').includes('notFound()'),
);

/** Is `ancestor` the same segment as `descendant`, or above it? */
function contains(ancestor: string[], descendant: string[]): boolean {
  return ancestor.every((segment, index) => descendant[index] === segment);
}

/*
 * `loading.tsx` is a Suspense boundary, and Next streams everything inside one:
 * the 200 shell is flushed before the page finishes rendering, so a `notFound()`
 * that runs afterwards cannot change the status any more.
 *
 * A root `loading.tsx` therefore turned **every** `notFound()` in the app into a
 * soft 404 — the correct body under HTTP 200, which search engines read as thin
 * duplicate content rather than a dead page. It was invisible because the body
 * was right the whole time; only the status was wrong.
 *
 * The rule this enforces: a loading boundary may not sit at or above a segment
 * whose page calls `notFound()`.
 */
describe('loading boundaries never wrap a notFound() route', () => {
  it('finds the routes it is meant to guard, so it cannot pass vacuously', () => {
    expect(NOT_FOUND_PAGES.length).toBeGreaterThan(0);
  });

  it('keeps the root segment free of a loading.tsx', () => {
    // The root is an ancestor of every route, so a loader here breaks them all.
    expect(LOADING_SEGMENTS.filter((segments) => segments.length === 0)).toEqual([]);
  });

  it.each(NOT_FOUND_PAGES.map((page) => page.path))('has no loading boundary above %s', (path) => {
    const page = NOT_FOUND_PAGES.find((candidate) => candidate.path === path);
    const offenders = LOADING_SEGMENTS.filter((segments) =>
      contains(segments, page?.segments ?? []),
    );

    expect(offenders.map((segments) => segments.join('/'))).toEqual([]);
  });
});
