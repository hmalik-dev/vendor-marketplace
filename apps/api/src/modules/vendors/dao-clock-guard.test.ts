import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * No DAO derives a **calendar day** from the database connection.
 *
 * `nearby-availability.dao.ts` floored its candidate window on `CURRENT_DATE`,
 * which is not the server's day but the *session's* — collapsed to a day using
 * a `TimeZone` nothing in this repository sets. Under PGlite that session runs
 * on `Etc/GMT+5`, so from 00:00 UTC it sat a day behind the UTC day every other
 * layer counts in, and the endpoint offered customers a date that had already
 * gone. The failure was invisible for most of the working day and arrived every
 * evening, which is the worst shape a defect can have.
 *
 * **`now()` on its own is not the defect and is not flagged.** Writing an
 * `updated_at` or `read_at` from the database is correct: a `timestamptz` is an
 * absolute instant and carries no timezone opinion. The bug is only ever in the
 * collapse from instant to day — `CURRENT_DATE`, the `LOCAL*` forms, or a
 * `::date` / `AT TIME ZONE` applied to an instant — because that is the step
 * that consults the session.
 *
 * A comment asking the next author not to do it again would not survive. This
 * does: today is passed in as a bound parameter, from `app.clock()`, and a DAO
 * that reaches for the connection's clock instead fails here by name.
 */
const CONNECTION_CLOCK = [
  // Session-timezone-dependent by definition; there is no correct use here.
  /\bCURRENT_DATE\b/i,
  /\bLOCALTIMESTAMP\b/i,
  /\bLOCALTIME\b/i,
  /\bCURRENT_TIME\b(?!STAMP)/i,
  // An absolute instant is fine until something collapses it to a day.
  /\b(?:now\(\)|CURRENT_TIMESTAMP)\s*(?:::\s*date|AT\s+TIME\s+ZONE)/i,
];

const MODULES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function daoFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await daoFiles(full)));
    } else if (entry.name.endsWith('.dao.ts')) {
      found.push(full);
    }
  }

  return found;
}

describe('DAO clock discipline', () => {
  it('finds the DAOs it is meant to be guarding', async () => {
    const files = await daoFiles(MODULES_DIR);

    // Guards the guard: a scan that silently matched nothing would pass
    // forever while the rule it encodes went unenforced.
    expect(files.length).toBeGreaterThan(0);
    expect(files.map((file) => path.basename(file))).toContain('nearby-availability.dao.ts');
  });

  it('never collapses the connection clock into a calendar day', async () => {
    const files = await daoFiles(MODULES_DIR);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      for (const [index, line] of source.split('\n').entries()) {
        // Prose explaining why the rule exists is not a violation of it.
        const code = line.replace(/^\s*(\*|\/\/|\/\*).*$/, '');
        if (CONNECTION_CLOCK.some((pattern) => pattern.test(code))) {
          offenders.push(`${path.relative(MODULES_DIR, file)}:${index + 1}: ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
