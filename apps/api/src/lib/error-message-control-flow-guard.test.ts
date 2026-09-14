import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * No production module **decides** anything on the text of a message.
 *
 * VEN-385. `reviews.service.ts` turned a failed insert into "you have already
 * reviewed this booking" when the error's message contained the unique index's
 * name — and Drizzle's wrapper message is `Failed query: ${query}\nparams:
 * ${params}`, every bound value inlined. A review whose own text named the index
 * made a cancelled, deadlocked or disconnected insert answer 409, with nothing
 * written and nothing logged as a fault. The driver fields (`code`,
 * `constraint` / `constraint_name`) are what a branch reads;
 * `violatesUniqueConstraint` is the one reader.
 *
 * **Reading a message to show or log it is fine and is not flagged** — only
 * comparing, matching or searching it, which is what turns someone's input into
 * a branch.
 *
 * A tripwire, not a proof: it reads source text, so a message laundered through
 * an unrelated variable name, or code hidden behind a string literal containing
 * `/*`, gets past it. The shapes below are the ones that shipped or nearly did.
 */
const SEARCH = String.raw`\s*(?:\?\.|\.)\s*(?:includes|startsWith|endsWith|match|matchAll|search|indexOf|lastIndexOf)\s*\(`;

const MESSAGE_CONTROL_FLOW = [
  // `error.message.includes('…')`, `.startsWith`, `.match(/…/)` and kin — and
  // a destructured `message.includes(…)`, which is the same read.
  new RegExp(String.raw`\bmessage` + SEARCH),
  // `/…/.test(error.message)`, `pattern.exec(link.message ?? '')`.
  /\.(?:test|exec)\s*\([^)]*\bmessage\b/,
  // The whole error stringified carries the same inlined parameters.
  new RegExp(
    String.raw`\b(?:String|JSON\.stringify)\s*\(\s*(?:err|error|cause|reason)\w*\s*\)` + SEARCH,
  ),
  // `error.message === '…'` either way round — but not a `typeof` or presence check.
  /\.message\s*[!=]==?(?!=|\s*(?:['"]string['"]|undefined\b|null\b))/,
  /[!=]==?\s*[\w$.?]*\.message\b/,
];

/** Comments carry prose about the rule, which is not a violation of it. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Matched snippets, whitespace collapsed so a call split across lines still counts. */
function offencesIn(source: string): string[] {
  const code = withoutComments(source).replace(/\s+/g, ' ');

  return MESSAGE_CONTROL_FLOW.flatMap((pattern) =>
    [...code.matchAll(new RegExp(pattern.source, 'g'))].map((match) =>
      code.slice(Math.max(0, match.index - 40), match.index + match[0].length + 20),
    ),
  );
}

/** Searches that decide nothing about the error, each with why. */
const ALLOWED: Record<string, { count: number; reason: string }> = {
  'lib/log-error-serializer.ts': {
    count: 1,
    reason:
      "Finds Drizzle's own `\\nparams:` tail to cut the bound values out of a log line — " +
      'a search for the redaction boundary, never for a value, and it classifies nothing.',
  },
};

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function productionFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'testing') {
        found.push(...(await productionFiles(full)));
      }
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      found.push(full);
    }
  }

  return found;
}

describe('error message control flow', () => {
  /*
   * Guards the guard, in both directions: the shapes that shipped must be
   * caught, including split across lines, and reading a message to log it must
   * not be.
   */
  it('flags a branch on message text and nothing else', () => {
    for (const offending of [
      "(typeof link.message === 'string' && link.message.includes(constraint))",
      '/reviews_booking_reviewer_key/.test(error.message)',
      'if (error.message\n  .startsWith("duplicate key")) {',
      "if (err?.message?.includes('users_email_key')) {",
      "if ('boom' === error.message) {",
      "const { message } = error; if (message.includes('reviews_booking_reviewer_key')) {",
      "if (/users_email_key/.test(error.message ?? '')) {",
      'if (String(error).includes(constraint)) {',
      'if (JSON.stringify(error).includes(constraint)) {',
    ]) {
      expect(offencesIn(offending), offending).not.toEqual([]);
    }

    for (const benign of [
      "return error instanceof Error ? error.message : 'unknown';",
      'const message = withoutParams(error.message);',
      "return typeof value?.message === 'string';",
      '// never write error.message.includes(name) here',
      'const paragraphs = fields.message.split("\\n");',
    ]) {
      expect(offencesIn(benign), benign).toEqual([]);
    }
  });

  it('finds the modules it is meant to be guarding', async () => {
    const files = (await productionFiles(SRC_DIR)).map((file) => path.relative(SRC_DIR, file));

    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(path.join('modules', 'reviews', 'reviews.service.ts'));
    expect(files).toContain(path.join('modules', 'users', 'users.dao.ts'));
    expect(files).toContain(path.join('lib', 'constraint-violation.ts'));
  });

  it('never branches on the text of a message in production code', async () => {
    const offenders: string[] = [];
    const allowedSeen: Record<string, number> = {};

    for (const file of await productionFiles(SRC_DIR)) {
      const relative = path.relative(SRC_DIR, file).split(path.sep).join('/');
      const snippets = offencesIn(await readFile(file, 'utf8'));

      if (relative in ALLOWED) {
        allowedSeen[relative] = snippets.length;
        continue;
      }

      offenders.push(...snippets.map((snippet) => `${relative}: …${snippet}…`));
    }

    expect(offenders).toEqual([]);
    // Pinned by count, so a second search added beside the allowed one fails.
    expect(allowedSeen).toEqual(
      Object.fromEntries(Object.entries(ALLOWED).map(([file, { count }]) => [file, count])),
    );
  });
});
