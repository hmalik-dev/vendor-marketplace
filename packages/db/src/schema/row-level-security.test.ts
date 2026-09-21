import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../testing/test-db.js';

const SCHEMA_REVIEW = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/schema-review.md',
);
const REVIEW_CLASSES = ['user-owned', 'public-read', 'operator-only', 'system'];
const SCRATCH_TABLE = 'rls_scratch_table';

let testDb: TestDatabase;

async function publicTables(): Promise<{ name: string; rls: boolean }[]> {
  const result = await testDb.client.query<{ name: string; rls: boolean }>(
    `select c.relname as name, c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname`,
  );

  return result.rows;
}

/** The guard: what a new table must not be. Names every offender. */
async function tablesWithoutRls(): Promise<string[]> {
  return (await publicTables()).filter((table) => !table.rls).map((table) => table.name);
}

/** Rows of docs/schema-review.md that open with a backticked table name and a class. */
function reviewedTables(): { name: string; cls: string }[] {
  return readFileSync(SCHEMA_REVIEW, 'utf8')
    .split('\n')
    .map((line) => /^\|\s*`([a-z_]+)`\s*\|\s*([a-z-]+)\s*\|/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ name: match[1] ?? '', cls: match[2] ?? '' }));
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
}, 60_000);

afterAll(async () => {
  await testDb.close();
});

describe('row level security on every public table', () => {
  it('is enabled on all tables the migrations create', async () => {
    expect(await tablesWithoutRls()).toEqual([]);
  });

  it('leaves PUBLIC holding no privilege on any table', async () => {
    const result = await testDb.client.query<{ name: string }>(
      `select c.relname as name
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace,
         lateral aclexplode(c.relacl) a
        where n.nspname = 'public' and c.relkind = 'r' and a.grantee = 0`,
    );

    expect(result.rows).toEqual([]);
  });

  it('names a table created without it', async () => {
    await testDb.client.exec(`create table ${SCRATCH_TABLE} (id int)`);

    try {
      expect(await tablesWithoutRls()).toEqual([SCRATCH_TABLE]);
    } finally {
      await testDb.client.exec(`drop table ${SCRATCH_TABLE}`);
    }
  });

  it('does not force it, so the owning connection is unaffected', async () => {
    const result = await testDb.client.query<{ forced: number }>(
      `select count(*)::int as forced from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relforcerowsecurity`,
    );

    expect(result.rows[0]?.forced).toBe(0);
  });
});

describe('a role that is not the owner', () => {
  beforeAll(async () => {
    await testDb.client.exec(`create role rls_probe`);
    await testDb.client.exec(
      `insert into users (auth_user_id, email, role, first_name, last_name)
       values ('rls-auth-1', 'rls@example.test', 'customer', 'Rls', 'Probe')`,
    );
  });

  async function countAs(role: string | null): Promise<number> {
    if (role) {
      await testDb.client.exec(`set role ${role}`);
    }

    try {
      const result = await testDb.client.query<{ n: number }>(
        'select count(*)::int as n from users',
      );

      return result.rows[0]?.n ?? -1;
    } finally {
      await testDb.client.exec('reset role');
    }
  }

  it('is refused outright without a grant', async () => {
    await expect(countAs('rls_probe')).rejects.toThrow(/permission denied for table users/);
  });

  it('sees no rows with a grant, while the owner sees the one it wrote', async () => {
    await testDb.client.exec('grant select on users to rls_probe');

    expect(await countAs('rls_probe')).toBe(0);
    expect(await countAs(null)).toBe(1);
  });
});

describe('docs/schema-review.md', () => {
  it('has exactly one classified row per public table', async () => {
    const reviewed = reviewedTables();
    const names = reviewed.map((row) => row.name).sort();
    const tables = (await publicTables()).map((table) => table.name);

    expect(
      tables.filter((name) => !names.includes(name)),
      'tables with no row',
    ).toEqual([]);
    expect(
      names.filter((name) => !tables.includes(name)),
      'rows with no table',
    ).toEqual([]);
    expect(
      names.filter((name, i) => names[i - 1] === name),
      'duplicated rows',
    ).toEqual([]);
    expect(
      reviewed.filter((row) => !REVIEW_CLASSES.includes(row.cls)).map((row) => row.name),
      'rows with no valid class',
    ).toEqual([]);
  });
});
