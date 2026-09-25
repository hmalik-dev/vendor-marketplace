import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * VEN-734: what a customer reads while booking, paying, messaging and editing
 * their profile is warm, short and US English. The copy lives in string
 * literals, template text and JSX text, so this reads exactly those through
 * the TypeScript parser: a comment is never a string, and a status value such
 * as the `cancelled` enum is an identifier or a bare token, not a sentence.
 */

const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SURFACE_DIRS = [
  'app/bookings',
  'app/messages',
  'app/customer',
  'components/bookings',
  'components/booking',
  'components/checkout',
  'components/customer',
  'components/messaging',
];
const SURFACE_FILES = [
  'lib/booking-entries.ts',
  'lib/refund-deadline.ts',
  'lib/settlement-copy.ts',
  'components/vendors/profile/review-form.tsx',
];

const TAILS =
  /\b(?:so that|which means|rather than|which is worth naming|so there is|so the whole|nothing is wrong with your account|this is temporary)\b/gi;

/** US forms the shared guard leaves to each slice, because code keeps the `cancelled` enum. */
const BRITISH = /\b(?:cancell(?:ed|ing)|any more|onwards)\b/gi;

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) return sourcesUnder(full);

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Every piece of text a string or JSX node carries, one space per whitespace run. A bare token like `'cancelled'` is a value, not copy. */
function copyIn(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isJsxText(node) ||
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const text = node.text.replace(/\s+/g, ' ').trim();

      if (/[A-Za-z]/.test(text) && !/^[a-z0-9_-]+$/.test(text)) found.push(text);
    }

    ts.forEachChild(node, visit);
  }

  visit(file);

  return found;
}

const files = [
  ...SURFACE_DIRS.flatMap((dir) => sourcesUnder(path.join(WEB_SRC, dir))),
  ...SURFACE_FILES.map((file) => path.join(WEB_SRC, file)),
].map((file) => ({
  relative: path.relative(WEB_SRC, file),
  copy: copyIn(file, readFileSync(file, 'utf8')),
}));

function matches(pattern: RegExp): string[] {
  return files.flatMap((file) =>
    file.copy.flatMap((text) =>
      [...text.matchAll(pattern)].map((match) => `${file.relative}: ${match[0]}`),
    ),
  );
}

function copyOf(relative: string): string {
  return files.find((file) => file.relative === relative)?.copy.join('\n') ?? '';
}

describe('customer copy', () => {
  it('reads the whole surface, so an empty sweep cannot pass', () => {
    expect(files.length).toBeGreaterThan(45);
    expect(copyOf('components/checkout/checkout-screen.tsx')).toContain('Confirm and pay');
  });

  it('reads strings and JSX text, and skips comments and enum values', () => {
    const source =
      "/* rather than */\n// so that\nconst s = status === 'cancelled';\nconst a = <p>It was\n  cancelled here</p>;\nconst b = `was cancelled ${x} any more`;";

    expect(copyIn('x.tsx', source)).toEqual(['It was cancelled here', 'was cancelled', 'any more']);
  });

  it('carries no justifying or reassuring tail', () => {
    expect(matches(TAILS)).toEqual([]);
  });

  it('spells cancel, anymore and onward the US way', () => {
    expect(matches(BRITISH)).toEqual([]);
  });

  it('pins the rewritten lines', () => {
    expect(copyOf('components/checkout/checkout-unavailable.tsx')).toContain(
      "It was canceled, declined or it expired. Your date isn't held.",
    );
    expect(copyOf('components/checkout/checkout-unavailable.tsx')).toContain(
      'needs to finish setting up payments. Try again later.',
    );
    expect(copyOf('components/messaging/messages-screen.tsx')).toContain(
      'A thread opens when you send a booking request.',
    );
    expect(copyOf('components/bookings/bookings-rail.tsx')).toContain(
      'A thread opens when you send a booking request.',
    );
    expect(copyOf('lib/booking-entries.ts')).toContain('Canceled');
  });
});
