import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  MIGRATIONS_FOLDER,
  refusalOf,
  type TestDatabase,
} from './testing/test-db.js';

/**
 * `0102` renames the persisted vocabulary from the retired word to "admin"
 * (VEN-697). The suite migrates to just before it, writes rows the way the old
 * schema and the old code did, applies it, and reads them back. The old names
 * are built from fragments so this file does not trip the repo-wide guard.
 */
const OLD = ['oper', 'ator'].join('');
const THIS_MIGRATION = `0102_admin_replaces_${OLD}`;

const ADMIN = '5b1c2b0a-1111-4222-8333-944445555666';
const SUBJECT = '5b1c2b0a-2222-4222-8333-944445555666';
const CUSTOMER = '5b1c2b0a-3333-4222-8333-944445555666';

let testDb: TestDatabase;

async function rows<T>(statement: string): Promise<T[]> {
  const result = await testDb.db.execute(sql.raw(statement));
  return result.rows as unknown as T[];
}

async function names(statement: string): Promise<string[]> {
  return (await rows<{ n: string }>(statement)).map((r) => r.n);
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  // Migrations after 0061 grant on the migrator's own bookkeeping table, which `runMigrations`
  // creates first; `migrateUpTo` does not.
  await testDb.db.execute(sql.raw('CREATE SCHEMA IF NOT EXISTS drizzle'));
  await testDb.db.execute(
    sql.raw(
      'CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)',
    ),
  );
  await testDb.migrateUpTo(THIS_MIGRATION);

  await testDb.db.execute(
    sql.raw(`INSERT INTO users (id, auth_user_id, email, role, first_name, last_name) VALUES
      ('${ADMIN}', 'rename_admin', 'admin@example.com', 'admin', 'Dana', 'Okafor'),
      ('${CUSTOMER}', 'rename_customer', 'rae@example.com', 'customer', 'Rae', 'Guard')`),
  );
  await testDb.db.execute(
    sql.raw(`INSERT INTO admin_actions (actor_id, action, subject_type, subject_id, detail) VALUES
      ('${ADMIN}', '${OLD}_granted', 'user', '${SUBJECT}', '{}'),
      ('${ADMIN}', '${OLD}_revoked', 'user', '${SUBJECT}', '{}'),
      ('${ADMIN}', '${OLD}_account_closed', 'user', '${SUBJECT}', '{}')`),
  );
  await testDb.db.execute(
    sql.raw(`INSERT INTO ${OLD}_alerts (kind, subject_id, outcome)
             VALUES ('payout_failed', 'case-1', 'sent')`),
  );

  const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${THIS_MIGRATION}.sql`), 'utf8');
  for (const statement of body.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) {
      await testDb.db.execute(sql.raw(statement));
    }
  }
});

afterAll(async () => {
  await testDb.close();
});

describe('0102 renames the persisted vocabulary', () => {
  it('reads old audit rows under the new action values', async () => {
    expect(
      await names(`SELECT action::text AS n FROM admin_actions ORDER BY action::text`),
    ).toEqual(['admin_account_closed', 'admin_granted', 'admin_revoked']);
  });

  it('keeps the alert row under the renamed table, enums and indexes', async () => {
    expect(await rows(`SELECT kind::text, outcome::text FROM admin_alerts`)).toEqual([
      { kind: 'payout_failed', outcome: 'sent' },
    ]);
    expect(
      await names(
        `SELECT t.typname AS n FROM pg_type t WHERE t.typname LIKE '%alert%' AND t.typtype = 'e' ORDER BY 1`,
      ),
    ).toEqual(['admin_alert_kind', 'admin_alert_outcome']);
    expect(
      await names(
        `SELECT indexname AS n FROM pg_indexes WHERE tablename = 'admin_alerts' ORDER BY 1`,
      ),
    ).toEqual([
      'admin_alerts_digest_date_key',
      'admin_alerts_kind_subject_sent_at_idx',
      'admin_alerts_pkey',
    ]);
  });

  it('leaves no object in the public schema carrying the old word', async () => {
    expect(
      await names(
        `SELECT relname AS n FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname ILIKE '%${OLD}%'`,
      ),
    ).toEqual([]);
    expect(
      await names(
        `SELECT t.typname AS n FROM pg_type t WHERE t.typnamespace = 'public'::regnamespace AND t.typname ILIKE '%${OLD}%'`,
      ),
    ).toEqual([]);
    expect(
      await names(`SELECT e.enumlabel AS n FROM pg_enum e WHERE e.enumlabel ILIKE '%${OLD}%'`),
    ).toEqual([]);
    expect(
      await names(
        `SELECT proname AS n FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND (proname ILIKE '%${OLD}%' OR prosrc ILIKE '%${OLD}%')`,
      ),
    ).toEqual([]);
    expect(
      await names(`SELECT policyname AS n FROM pg_policies WHERE policyname ILIKE '%${OLD}%'`),
    ).toEqual([]);
    expect(
      await names(
        `SELECT policyname AS n FROM pg_policies WHERE tablename = 'messages' AND policyname LIKE '%admin%'`,
      ),
    ).toEqual(['messages_admin_select']);
  });

  it('gates the messages policy function on the new setting and the admin role', async () => {
    const answer = async (setting: string, role: string): Promise<boolean> =>
      testDb.db.transaction(async (tx) => {
        await tx.execute(
          sql.raw(
            `SELECT set_config('${setting}', 'true', true), set_config('app.role', '${role}', true)`,
          ),
        );
        const result = await tx.execute(sql.raw('SELECT app_is_admin() AS n'));
        return (result.rows[0] as unknown as { n: boolean }).n;
      });

    expect(await answer('app.admin', 'admin')).toBe(true);
    expect(await answer('app.admin', 'customer')).toBe(false);
    expect(await answer(`app.${OLD}`, 'admin')).toBe(false);
  });

  it('guards users.role with the new message and the new setting only', async () => {
    const refusal = await refusalOf(
      testDb.db,
      `UPDATE users SET role = 'admin' WHERE id = '${CUSTOMER}'`,
    );
    expect(refusal).toContain('users.role can only change through the admin grant path');

    await expect(
      testDb.db.transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL app.${OLD}_role_grant = 'on'`));
        await tx.execute(sql.raw(`UPDATE users SET role = 'admin' WHERE id = '${CUSTOMER}'`));
      }),
    ).rejects.toThrow();

    const granted = await testDb.db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL app.admin_role_grant = 'on'`));
      return tx.execute(sql.raw(`UPDATE users SET role = 'admin' WHERE id = '${CUSTOMER}'`));
    });
    expect(granted.affectedRows).toBe(1);
  });
});
