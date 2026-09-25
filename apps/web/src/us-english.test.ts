import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * US English, everywhere a person reads. `31-content-voice.md` rules it
 * ("inquiry, canceled, color, favorite"); this is the guard that keeps a
 * British form from coming back.
 *
 * Two kinds of source are read:
 *
 * - the legal pages, whole, because every word in them is shown;
 * - the TypeScript under the three source roots, comments and tests removed,
 *   because a comment is not shown and a test may quote the form it forbids.
 *
 * A match is a **whole word**. `honourVendorHold` is an identifier and stays;
 * `honour` on its own in a string is a sentence and goes. This file is a test,
 * so the scan never reads its own needles.
 */

const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = path.resolve(WEB_SRC, '../../..');

const SOURCE_ROOTS = ['apps/web/src', 'apps/api/src', 'packages/shared/src'];
const LEGAL_CONTENT = 'apps/web/content';

const BRITISH_FORMS = [
  'licences?',
  'licencing',
  '(?:un)?recognis(?:e|ed|es|ing)',
  'colours?',
  'behaviours?',
  'organis(?:e|ed|es|ing|ation|ations)',
  'favours?',
  'favourable',
  'enquir(?:y|ies|e|ed|es)',
  'catalogues?',
  'defences?',
  'honours?',
  'neighbours?',
  'programmes?',
  'cheques?',
  'whilst',
  'amongst',
  'centre[sd]?',
  'centring',
];

/**
 * The legal pages also hold prose where "cancelled" is a spelling and not a
 * status value, which is the case in code. Code keeps `'cancelled'` as a
 * database enum value, so only the content is held to the single-l form.
 */
const CONTENT_ONLY_FORMS = ['cancell(?:ed|ing)'];

/**
 * Values a library or a database owns, named by file so an identifier never
 * needs a workaround. `sharp` reads `position: 'centre'`.
 */
const ALLOWED: readonly { file: string; word: string }[] = [
  { file: 'apps/api/src/lib/images.ts', word: 'centre' },
];

const BRITISH_WORDS = new RegExp(
  `(?<![A-Za-z0-9_$])(?:${BRITISH_FORMS.join('|')})(?![A-Za-z0-9_$])`,
  'gi',
);
const CONTENT_WORDS = new RegExp(
  `(?<![A-Za-z0-9_$])(?:${[...BRITISH_FORMS, ...CONTENT_ONLY_FORMS].join('|')})(?![A-Za-z0-9_$])`,
  'gi',
);

function filesUnder(dir: string, pattern: RegExp): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        found.push(...filesUnder(full, pattern));
      }
      continue;
    }

    if (pattern.test(entry.name) && !/\.test(?:-d)?\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }

  return found;
}

/** Same reading as `apostrophe-form.test.ts`: what a reader could see. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();

      return trimmed.startsWith('//') || trimmed.startsWith('*') ? '' : line;
    })
    .join('\n');
}

interface Sighting {
  where: string;
  word: string;
}

function sightings(relative: string, text: string, words: RegExp): Sighting[] {
  const found: Sighting[] = [];

  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(words)) {
      const word = match[0].toLowerCase();

      if (!ALLOWED.some((entry) => entry.file === relative && entry.word === word)) {
        found.push({ where: `${relative}:${index + 1}`, word });
      }
    }
  });

  return found;
}

const codeFiles = SOURCE_ROOTS.flatMap((root) =>
  filesUnder(path.join(REPO_ROOT, root), /\.tsx?$/),
).map((file) => ({
  relative: path.relative(REPO_ROOT, file),
  text: withoutComments(readFileSync(file, 'utf8')),
}));

const contentFiles = filesUnder(path.join(REPO_ROOT, LEGAL_CONTENT), /\.md$/).map((file) => ({
  relative: path.relative(REPO_ROOT, file),
  text: readFileSync(file, 'utf8'),
}));

describe('US English', () => {
  it('reads the sources at all, so an empty sweep cannot pass vacuously', () => {
    expect(codeFiles.length).toBeGreaterThan(300);
    expect(contentFiles.map((file) => path.basename(file.relative)).sort()).toEqual([
      'cookies.md',
      'privacy.md',
      'terms.md',
      'vendor-agreement.md',
    ]);
    expect(codeFiles.some((file) => file.text.includes('position:'))).toBe(true);
  });

  it('finds a British form, by file and line, in text that would show one', () => {
    expect(sightings('x.md', 'one\nthe licence ends', CONTENT_WORDS)).toEqual([
      { where: 'x.md:2', word: 'licence' },
    ]);
    expect(sightings('x.ts', "'a recognised mode'", BRITISH_WORDS)).toEqual([
      { where: 'x.ts:1', word: 'recognised' },
    ]);
    expect(sightings('x.ts', 'honourVendorHold: true', BRITISH_WORDS)).toEqual([]);
  });

  it('has no British spelling in the legal pages', () => {
    const found = contentFiles.flatMap((file) =>
      sightings(file.relative, file.text, CONTENT_WORDS),
    );

    expect(found).toEqual([]);
  });

  it('has no British spelling in a user-facing string', () => {
    const found = codeFiles.flatMap((file) => sightings(file.relative, file.text, BRITISH_WORDS));

    expect(found).toEqual([]);
  });

  it("allows sharp's own 'centre' by name, and only there", () => {
    const images = codeFiles.find((file) => file.relative === 'apps/api/src/lib/images.ts');

    expect(images?.text).toContain("position: 'centre'");
    expect(sightings('apps/api/src/lib/images.ts', "position: 'centre'", BRITISH_WORDS)).toEqual(
      [],
    );
    expect(sightings('apps/api/src/lib/other.ts', "position: 'centre'", BRITISH_WORDS)).toEqual([
      { where: 'apps/api/src/lib/other.ts:1', word: 'centre' },
    ]);
  });
});
