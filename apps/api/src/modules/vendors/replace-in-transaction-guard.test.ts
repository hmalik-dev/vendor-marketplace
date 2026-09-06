import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * **`replaceVendorCategories` and `replaceVendorTags` are only ever called
 * inside a transaction.**
 *
 * Each is a `DELETE` followed by an `INSERT`, so between the two the vendor has
 * no categories and no tags at all. They used to open a transaction of their
 * own; #405 removed it, because every caller now runs inside the profile save's
 * transaction and a nested one is a `SAVEPOINT` / `RELEASE` pair that buys
 * nothing and holds the row locks two round trips longer.
 *
 * That trade is only sound while the premise holds, and the premise is a
 * sentence in a docstring — exactly the kind nobody re-reads. A caller added
 * outside a transaction would not fail, would not warn, and would silently
 * reintroduce "the profile write stands and its selections do not", which is
 * the defect #405 exists to close. So the premise is asserted instead: the
 * first argument must be a transaction handle.
 *
 * Deliberately syntactic. It reads the name being passed, not the type, because
 * `AppDatabase` is the type of both a pool and a transaction — that is what
 * lets a `tx` be handed to a DAO at all, and it is why the compiler cannot
 * answer this question.
 */
const GUARDED = ['replaceVendorCategories', 'replaceVendorTags'] as const;

/** What a Drizzle transaction handle is called in this codebase. */
const TRANSACTION_ARGUMENT = /^tx\b/;

const MODULES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await sourceFiles(full)));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      found.push(full);
    }
  }

  return found;
}

/** Every call to one of the guarded writers, with the argument it was handed. */
async function callSites(): Promise<{ where: string; argument: string }[]> {
  const found: { where: string; argument: string }[] = [];

  for (const file of await sourceFiles(MODULES_DIR)) {
    const source = await readFile(file, 'utf8');

    for (const name of GUARDED) {
      // The definition and the imports are not call sites.
      const calls = source.matchAll(new RegExp(`(?<!function )\\b${name}\\(([^,)]*)`, 'g'));

      for (const call of calls) {
        const line = source.slice(0, call.index).split('\n').length;
        found.push({
          where: `${path.relative(MODULES_DIR, file)}:${line}`,
          argument: call[1]!.trim(),
        });
      }
    }
  }

  return found;
}

describe('the wholesale-replace writers run inside a transaction', () => {
  it('finds the call sites it is meant to be guarding', async () => {
    const sites = await callSites();

    /*
     * Guards the guard. A regex that matched nothing, or a walk that read no
     * files, would pass the assertion below forever while the rule went
     * unenforced — `web-design-parity.md`'s "if nothing would make it fail, it
     * is not a check".
     */
    expect(sites.length).toBeGreaterThanOrEqual(4);
    expect(sites.some((site) => site.where.includes('vendors.service.ts'))).toBe(true);
  });

  it('never hands one the pool', async () => {
    const offenders = (await callSites()).filter(
      (site) => !TRANSACTION_ARGUMENT.test(site.argument),
    );

    expect(offenders.map((site) => `${site.where}: passed \`${site.argument}\``)).toEqual([]);
  });

  it('recognises the pool being passed', () => {
    expect(TRANSACTION_ARGUMENT.test('db')).toBe(false);
    expect(TRANSACTION_ARGUMENT.test('app.db')).toBe(false);
    expect(TRANSACTION_ARGUMENT.test('tx')).toBe(true);
  });
});
