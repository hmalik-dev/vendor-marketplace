import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **The viewer's day is only knowable in the viewer's browser.**
 *
 * `todayDateString` reads the caller's own wall clock, and its docstring says
 * in as many words that it "is only ever meaningful on the client". Four server
 * components called it anyway, where it returned the **Next.js process's** local
 * day — on a UTC host, the UTC day. West of UTC that made a vendor's current
 * evening render as already past: the availability calendar labelled the day
 * they were standing in "in the past", a PUT blocking it answered 200 and wrote
 * nothing, and the dashboard's "This week" began tomorrow. East of UTC the
 * booking-request form left yesterday pickable. #409.
 *
 * `dao-clock-guard.test.ts` polices the same collapse on the API side, where the
 * answer is the opposite: a server may only ever compute the **UTC** day. This
 * is the web half of that rule, and the answer here is different because a
 * browser *does* know the viewer's day — so a component that needs it takes the
 * server's day as a seed and re-anchors with `useViewerToday`.
 *
 * Tests are exempt: `use-viewer-today.test.tsx` calls the helper to state what
 * the hook is expected to return.
 */
const WEB_SOURCE = join(import.meta.dirname, '..');

/** `'use client'` or `"use client"`, as the very first statement in the file. */
const USE_CLIENT = /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/;

/**
 * The file with its comments removed.
 *
 * Without this the guard reads its own explanations: three of these files carry
 * a comment saying why they *stopped* calling `todayDateString()`, and a check
 * that a prose mention can trip is a check nobody can write a comment near.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * `src/testing/` holds helpers that only tests import — they pull in `vitest`
 * and never reach a bundle, so they are not production source and this guard
 * would be answering a question about them that has no meaning.
 */
const TEST_ONLY = 'testing';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const path = join(directory, item.name);

    if (item.isDirectory()) {
      return item.name === TEST_ONLY ? [] : sourceFiles(path);
    }

    return /\.tsx?$/.test(item.name) && !/\.test\.tsx?$/.test(item.name) ? [path] : [];
  });
}

/**
 * Reaching the helper at all, by any name.
 *
 * The call itself, and the import that would let a wrapper or an alias
 * (`import { todayDateString as day }`) make the call under a name no regex
 * could know. Matching the import is what makes the identifier check
 * unnecessary to get exactly right: a server file cannot use what it cannot
 * name, and it cannot name this without importing it.
 */
const REACHES_HELPER = [/\btodayDateString\s*\(/, /\btodayDateString\b[^\n]*from\s*['"]/];

describe('todayDateString outside a client component', () => {
  it('is never reached from a server component', () => {
    const offenders = sourceFiles(WEB_SOURCE)
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        const code = withoutComments(source);

        return REACHES_HELPER.some((pattern) => pattern.test(code)) && !USE_CLIENT.test(source);
      })
      .map((path) => path.slice(WEB_SOURCE.length + 1));

    expect(offenders).toEqual([]);
  });

  /* The alias route the call-shape pattern alone would miss. */
  it('catches an import under another name', () => {
    const aliased = "import { todayDateString as day } from '@vendor-marketplace/shared';\n";

    expect(REACHES_HELPER.some((pattern) => pattern.test(aliased))).toBe(true);
    expect(REACHES_HELPER.some((pattern) => pattern.test("import { pageTitle } from 'x';"))).toBe(
      false,
    );
  });

  /*
   * The guard is only worth having if it can fail, and the failure it has to
   * catch is a call in a file with no `'use client'` — including one where the
   * directive sits below an import, which does not make a client component.
   */
  it('recognises a directive only as the file’s first statement', () => {
    expect(USE_CLIENT.test("'use client';\n\nimport x from 'y';")).toBe(true);
    expect(USE_CLIENT.test('// A leading comment\n"use client";\n')).toBe(true);
    expect(USE_CLIENT.test("/* banner */\n'use client';\n")).toBe(true);
    expect(USE_CLIENT.test("import x from 'y';\n'use client';\n")).toBe(false);
    expect(USE_CLIENT.test("import { todayDateString } from 'z';\n")).toBe(false);
  });

  /* A comment about the helper is not a call to it, and a call is not a comment. */
  it('reads past comments to the code', () => {
    expect(withoutComments('/* todayDateString() */\nconst a = 1;')).not.toContain(
      'todayDateString',
    );
    expect(withoutComments('// todayDateString()\nconst a = 1;')).not.toContain('todayDateString');
    expect(withoutComments('const day = todayDateString();')).toContain('todayDateString()');
  });
});
