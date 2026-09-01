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

/**
 * The same collapse, one layer up: **no server-side module reads the local
 * calendar day.**
 *
 * `todayDateString` is the *client's* day — its own docstring says it is "only
 * ever meaningful on the client" and that "nothing server-side compares against
 * it" — and `dashboard.service.ts` compared against it anyway. Every bound it
 * fed was then matched against a `date` column or pinned to `T00:00:00.000Z`,
 * so the vendor dashboard reported a **local month with UTC edges**: west of
 * UTC a vendor's `earningsThisMonthCents` silently lost every payment taken
 * after 19:00 on the last day of the month (#391).
 *
 * The DAO scan above could not see it, because the offending call was in a
 * service. This is the same rule at the layer the defect actually lived in: the
 * API has no visitor timezone to consult, so the only calendar day it may
 * compute is the UTC one, from `toDateString`.
 *
 * Tests are exempt. A test may legitimately construct a local day to prove a
 * UTC-anchored figure does *not* move with it — `dashboard-month-window.test.ts`
 * pins `TZ` and does exactly that.
 */
const CLIENT_ONLY_TODAY = [
  // The helper itself. This is what `dashboard.service.ts` imported.
  /\btodayDateString\b/,
  /*
   * And the hand-rolled forms, which are the obvious way to reintroduce it
   * without tripping the name. `getFullYear`/`getMonth`/`getDate`/`getHours`
   * all read the local zone; their `getUTC*` twins do not and are used
   * legitimately in `availability.service.ts`.
   */
  /\.get(?:FullYear|Month|Date|Hours)\(\)/,
  /\btoLocaleDate|\btoLocaleString\b/,
];

/**
 * `Intl.DateTimeFormat` with no `timeZone` formats in the process's zone.
 *
 * Judged over the whole constructor call rather than the line it opens on: both
 * existing instances — `booking-requests.service.ts` and `messaging.service.ts`
 * — do pin `timeZone: 'UTC'`, several lines down inside a multi-line options
 * object. A line-scoped pattern flagged both, which is how a guard earns a
 * reputation for crying wolf and gets deleted.
 */
const INTL_FORMATTER = /Intl\.DateTimeFormat\(/;
const PINNED_ZONE = /timeZone\s*:/;
/** Options objects in this repo run to five lines; eight leaves headroom. */
const OPTIONS_WINDOW = 8;

const API_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function serverSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await serverSourceFiles(full)));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      found.push(full);
    }
  }

  return found;
}

describe('server-side calendar-day discipline', () => {
  it('finds the source it is meant to be guarding', async () => {
    const files = await serverSourceFiles(API_SRC);

    // Guards the guard, as above: a scan matching nothing passes forever.
    expect(files.length).toBeGreaterThan(0);
    expect(files.map((file) => path.relative(API_SRC, file))).toContain(
      path.join('modules', 'vendors', 'dashboard.service.ts'),
    );
  });

  it('never reads the local calendar day outside a test', async () => {
    const files = await serverSourceFiles(API_SRC);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const lines = source.split('\n');

      for (const [index, line] of lines.entries()) {
        // Prose explaining why the rule exists is not a violation of it.
        const code = line.replace(/^\s*(\*|\/\/|\/\*).*$/, '');

        const unpinnedFormatter =
          INTL_FORMATTER.test(code) &&
          !PINNED_ZONE.test(lines.slice(index, index + OPTIONS_WINDOW).join('\n'));

        if (CLIENT_ONLY_TODAY.some((pattern) => pattern.test(code)) || unpinnedFormatter) {
          offenders.push(`${path.relative(API_SRC, file)}:${index + 1}: ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
