import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The last migration written before destructive statements became a finding.
 *
 * A migration numbered above this is checked; this one and everything before it
 * is history that already ran (`0003`, `0008`, `0010`, `0016` and `0017` hold
 * hand-written `DROP`s and `DELETE FROM`s). It moves only when a migration
 * lands, never to excuse one: a destructive statement after launch takes the
 * escape comment below and a reason.
 */
export const MIGRATION_BASELINE = 71;

/** `-- allow-destructive: <reason>` anywhere in the file, with a reason. */
const ESCAPE = /^[ \t]*--[ \t]*allow-destructive:[ \t]*\S/m;

/**
 * What each pattern is looking for. Run on the file with its comments removed,
 * so prose about a `DROP` never fires; the escape is matched on the raw text.
 */
const DESTRUCTIVE: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'DROP', pattern: /\bDROP\b/i },
  { label: 'DELETE FROM', pattern: /\bDELETE\s+FROM\b/i },
  { label: 'ALTER COLUMN ... TYPE', pattern: /\bALTER\s+COLUMN\s+\S+\s+(?:SET\s+DATA\s+)?TYPE\b/i },
  { label: 'RENAME', pattern: /\bRENAME\b/i },
  { label: 'SET NOT NULL', pattern: /\bSET\s+NOT\s+NULL\b/i },
];

export interface DestructiveMigration {
  readonly file: string;
  readonly statements: readonly string[];
}

function withoutComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

/** The destructive statements a migration's SQL contains, by label. */
export function destructiveStatements(sql: string): string[] {
  const code = withoutComments(sql);

  return DESTRUCTIVE.filter(({ pattern }) => pattern.test(code)).map(({ label }) => label);
}

/** The leading number of `0072_name.sql`, or `null` for a file that is not one. */
function migrationNumber(file: string): number | null {
  const match = /^(\d+)_.*\.sql$/.exec(file);

  return match?.[1] === undefined ? null : Number(match[1]);
}

/**
 * Every migration newer than `baseline` that holds a destructive statement and
 * carries no escape. The deploy runs migrations while the previous release is
 * still serving, so a `DROP` or a tightened column can break it (VEN-463).
 */
export function findDestructiveMigrations(
  directory: string,
  baseline: number = MIGRATION_BASELINE,
): DestructiveMigration[] {
  const found: DestructiveMigration[] = [];

  for (const file of readdirSync(directory).sort()) {
    const number = migrationNumber(file);

    if (number === null || number <= baseline) {
      continue;
    }

    const sql = readFileSync(path.join(directory, file), 'utf8');
    const statements = destructiveStatements(sql);

    if (statements.length > 0 && !ESCAPE.test(sql)) {
      found.push({ file, statements });
    }
  }

  return found;
}
