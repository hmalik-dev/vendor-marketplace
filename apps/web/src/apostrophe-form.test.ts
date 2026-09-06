import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * One apostrophe, everywhere. `31-content-voice.md` rules it: the product
 * writes the **straight** apostrophe `'` (U+0027), never the curly `’`
 * (U+2019) and never `&rsquo;`.
 *
 * The design contract settles which one — across every frame's UI strings the
 * straight form appears 124 times and the curly form once — and this guard is
 * what stops the answer drifting back. Before it, `/sign-up` wrote `&apos;`
 * while the 404 and the 500 wrote `&rsquo;`, so the same contraction rendered
 * in two glyphs depending on who typed it, and #366 was filed for it. A ruling
 * with no executable guard is one the next screen re-litigates.
 *
 * **Prose in comments is not user-facing**, so comments are stripped before the
 * check. A design note that quotes a frame is allowed to quote it accurately.
 *
 * A source read rather than a render, for the same reason
 * `empty-state-callers.test.ts` is one: the alternative is mounting every
 * screen in the product with its data, auth and router to assert one character.
 */

const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = path.resolve(WEB_SRC, '../../..');

/**
 * Every root that holds a string a person reads.
 *
 * **`apps/api/src` is in the list, and was the reviewer's finding.** The sweep
 * started at the two roots the *screens* live in, which reads as "repo-wide"
 * and is not: `booking-requests.service.ts` composes the notification titles
 * the bell renders, and `support-email.ts` writes an email body. Copy that
 * reaches an inbox is as user-facing as copy that reaches a pane, and the rule
 * in `31-content-voice.md` is the product's rather than the frontend's.
 *
 * The test lives under `apps/web` because that is where the rule was ruled and
 * where most of the copy is; the paths are resolved from the repo root so it
 * can reach past its own package.
 */
const SOURCE_ROOTS = ['apps/web/src', 'apps/api/src', 'packages/shared/src'].map((relative) =>
  path.join(REPO_ROOT, relative),
);

const CURLY_APOSTROPHE = '’';

function sourceFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        found.push(...sourceFiles(full));
      }
      continue;
    }

    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      continue;
    }

    found.push(full);
  }

  return found;
}

/**
 * Everything a reader could see, with the commentary taken out.
 *
 * Block comments go first and wholesale, which also removes JSX comments —
 * `{/* … *\/}` is a block comment wearing braces. Line comments are only
 * stripped where the trimmed line *starts* with `//` or `*`, because a blanket
 * `//` rule would eat the rest of any line holding a URL and could hide a real
 * violation behind `https://`.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart();

      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');
}

describe('apostrophe form', () => {
  const files = SOURCE_ROOTS.flatMap(sourceFiles).map((file) => ({
    path: path.relative(REPO_ROOT, file),
    code: withoutComments(readFileSync(file, 'utf8')),
  }));

  it('reads the sources at all, so an empty sweep cannot pass vacuously', () => {
    /*
     * A floor, not a number to maintain. It exists so a broken directory walk
     * fails loudly rather than reporting nothing-found as nothing-wrong — the
     * "before trusting a check, ask what state would make it fail" rule.
     */
    expect(files.length).toBeGreaterThan(300);
    expect(files.some((file) => file.code.includes('&apos;'))).toBe(true);

    /*
     * And that each root really contributed, so a path that stopped resolving
     * cannot quietly shrink the sweep back to the two it started with.
     */
    for (const root of ['apps/web/src', 'apps/api/src', 'packages/shared/src']) {
      expect(
        files.some((file) => file.path.startsWith(root)),
        root,
      ).toBe(true);
    }
  });

  it('has no curly apostrophe in any user-facing string', () => {
    const offenders = files
      .filter((file) => file.code.includes(CURLY_APOSTROPHE))
      .map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it('has no &rsquo; entity, which is the same character escaped', () => {
    const offenders = files
      .filter((file) => file.code.includes('&rsquo;'))
      .map((file) => file.path);

    expect(offenders).toEqual([]);
  });
});
