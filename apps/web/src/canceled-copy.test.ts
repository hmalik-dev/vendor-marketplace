import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * VEN-753: every screen says "canceled" with one l. Code keeps the `cancelled`
 * enum, so `us-english.test.ts` cannot hold source to the single-l form; this
 * reads only what a person can see — string literals, template text and JSX
 * text, through the TypeScript parser — so a comment, an identifier and a bare
 * `'cancelled'` status value never count.
 */

const WEB_SRC = path.dirname(fileURLToPath(import.meta.url));
/** Copy written outside the web app that the web app shows: the demo seed's notifications reach the bell. */
const SHOWN_ELSEWHERE = [path.resolve(WEB_SRC, '../../../packages/db/src/seed-demo.ts')];

const DOUBLE_L = /\bcancell(?:ed|ing)\b/i;

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) return sourcesUnder(full);

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Every piece of visible text that spells it with two l's. A bare token like `'cancelled'` is a value, not copy. */
function doubleLIn(fileName: string, source: string): string[] {
  // A `.ts` file read as TSX parses a `<T>` cast as JSX and swallows code into text.
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];

  function visit(node: ts.Node): void {
    // A module path names a file, not a sentence.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;

    if (
      ts.isJsxText(node) ||
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const text = node.text.replace(/\s+/g, ' ').trim();
      // A bare token in a string is a value; in JSX text it is shown, even as one word.
      const isValue = !ts.isJsxText(node) && /^[a-z0-9_-]+$/.test(text);

      if (!isValue && DOUBLE_L.test(text)) found.push(text);
    }

    ts.forEachChild(node, visit);
  }

  visit(file);

  return found;
}

describe('canceled on screen', () => {
  it('reads a label, a sentence and JSX text, and leaves the enum value alone', () => {
    const source = [
      "const status = 'cancelled';",
      '// cancelled in a comment',
      'const a = <KeyValue label="Cancelled by">x</KeyValue>;',
      'const b = `${n} bookings cancelled`;',
      'const c = <p>It was cancelled.</p>;',
      'const d = <StatusPill>cancelled</StatusPill>;',
    ].join('\n');

    expect(doubleLIn('x.tsx', source)).toEqual([
      'Cancelled by',
      'bookings cancelled',
      'It was cancelled.',
      'cancelled',
    ]);
  });

  it('finds no double-l form in any web screen', () => {
    const files = [...sourcesUnder(WEB_SRC), ...SHOWN_ELSEWHERE];
    const offenders = files.flatMap((file) =>
      doubleLIn(file, readFileSync(file, 'utf8')).map(
        (text) => `${path.relative(WEB_SRC, file)}: ${text}`,
      ),
    );

    // The scan has to have read the screens this ticket fixed, or it passed on nothing.
    expect(files.map((file) => path.relative(WEB_SRC, file))).toEqual(
      expect.arrayContaining([
        'app/admin/bookings/[bookingId]/page.tsx',
        'app/admin/cases/[caseId]/page.tsx',
        'app/vendor/bookings/page.tsx',
        'components/vendor/complete-booking.tsx',
        'components/admin/vendor-table.tsx',
        '../../../packages/db/src/seed-demo.ts',
      ]),
    );
    expect(offenders).toEqual([]);
  });
});
