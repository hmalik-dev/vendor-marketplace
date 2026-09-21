import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { destructiveStatements, findDestructiveMigrations, MIGRATION_BASELINE } from './check.js';

const DROP_COLUMN = 'ALTER TABLE "users" DROP COLUMN "nickname";';
const DRIZZLE_DIR = fileURLToPath(new URL('../../../db/drizzle', import.meta.url));

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'migrations-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(name: string, sql: string): void {
  writeFileSync(path.join(dir, name), sql);
}

describe('destructiveStatements', () => {
  it.each([
    ['DROP COLUMN', DROP_COLUMN, ['DROP']],
    ['DROP TYPE', 'DROP TYPE "role";', ['DROP']],
    ['DELETE FROM', 'delete\n  from "users";', ['DELETE FROM']],
    [
      'a column type change',
      'ALTER TABLE "t" ALTER COLUMN "c" SET DATA TYPE integer;',
      ['ALTER COLUMN ... TYPE'],
    ],
    ['SET NOT NULL', 'ALTER TABLE "t" ALTER COLUMN "c" SET NOT NULL;', ['SET NOT NULL']],
    ['a rename', 'ALTER TABLE "users" RENAME COLUMN "bio" TO "about";', ['RENAME']],
  ])('flags %s', (_name, sql, expected) => {
    expect(destructiveStatements(sql)).toEqual(expected);
  });

  it('passes additive statements and ignores prose in comments', () => {
    const sql = [
      '-- never DROP anything here, and DELETE FROM is not run',
      '/* SET NOT NULL is later */',
      'CREATE INDEX "i" ON "t" ("c");',
      'ALTER TABLE "t" ADD COLUMN "c" text;',
      'ALTER TYPE "role" ADD VALUE \'x\';',
    ].join('\n');

    expect(destructiveStatements(sql)).toEqual([]);
  });
});

describe('findDestructiveMigrations', () => {
  it('fails a migration past the baseline that drops a column', () => {
    write('0072_drop.sql', DROP_COLUMN);

    expect(findDestructiveMigrations(dir, 71)).toEqual([
      { file: '0072_drop.sql', statements: ['DROP'] },
    ]);
  });

  it('passes the same migration once it carries the escape with a reason', () => {
    write('0072_drop.sql', `-- allow-destructive: nickname was never read\n${DROP_COLUMN}`);

    expect(findDestructiveMigrations(dir, 71)).toEqual([]);
  });

  it('does not take an escape without a reason', () => {
    write('0072_drop.sql', `-- allow-destructive:\n${DROP_COLUMN}`);

    expect(findDestructiveMigrations(dir, 71)).toHaveLength(1);
  });

  it('leaves a migration at or before the baseline alone', () => {
    write('0071_old.sql', DROP_COLUMN);
    write('0017_older.sql', DROP_COLUMN);

    expect(findDestructiveMigrations(dir, 71)).toEqual([]);
  });

  it('passes the repository as it stands', () => {
    expect(findDestructiveMigrations(DRIZZLE_DIR)).toEqual([]);
  });

  it('records a baseline that names a migration that exists', () => {
    const numbers = readdirSync(DRIZZLE_DIR)
      .map((file) => /^(\d+)_.*\.sql$/.exec(file)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number);

    expect(numbers).toContain(MIGRATION_BASELINE);
  });
});
