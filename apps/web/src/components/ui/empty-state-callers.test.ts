import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The other half of the guard #261 asked for.
 *
 * `empty-state.test.tsx` proves the component defaults to the glyph. This
 * proves no *caller* opts out of it. Together they mean a tenth `EmptyState`
 * cannot be added without the glyph — by omission it inherits the default, and
 * deliberately it fails here.
 *
 * A source read rather than a render, because the alternative is mounting nine
 * screens with their data, auth and router to assert one span. The strings
 * matched are exact and only meaningful inside JSX, so there is nothing for
 * them to collide with.
 */

const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function componentFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        found.push(...componentFiles(full));
      }
      continue;
    }

    if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      found.push(full);
    }
  }

  return found;
}

/** `<EmptyState` opening a JSX element, not the substring inside a longer name. */
const USAGE = /<EmptyState[\s/>]/g;

describe('EmptyState call sites', () => {
  const files = componentFiles(WEB_SRC)
    // The component's own file matches `<EmptyState` through its default
    // `icon = <EmptyStateGlyph />`, so counting it would let the floor below be
    // met by the definition rather than by any caller.
    .filter((file) => !file.endsWith(path.join('ui', 'empty-state.tsx')))
    .map((file) => ({
      path: path.relative(WEB_SRC, file),
      source: readFileSync(file, 'utf8'),
    }));

  it('finds the call sites at all, so an empty sweep cannot pass vacuously', () => {
    const usages = files.reduce(
      (total, file) => total + (file.source.match(USAGE)?.length ?? 0),
      0,
    );

    /*
     * Counts usages rather than files, so consolidating two callers into one
     * file does not fail this for a reason nobody cares about. A floor, not a
     * number to maintain upward — it exists so a broken directory walk fails
     * loudly instead of reporting an empty sweep as a pass.
     */
    expect(usages).toBeGreaterThanOrEqual(9);
  });

  it('has none that removes the glyph', () => {
    const optedOut = files
      .filter((file) => file.source.includes('icon={null}'))
      .map((file) => file.path);

    expect(optedOut).toEqual([]);
  });
});
