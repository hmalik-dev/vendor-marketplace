import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDemoData } from '../seed-demo.js';
import { seedReferenceData } from '../seed.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../testing/postgres-test-db.js';
import { APPEND_ONLY_DELETE_TRIGGERS, resetDatabase, ResetRefusal, runResetCli } from './reset.js';

/*
 * The reset against the real server `DATABASE_URL` names (VEN-751): a
 * throwaway database per describe, migrated, filled by the demo seed and by
 * hand across more than twenty tables, with one admin whose rows must survive.
 */

const ADMIN_ID = randomUUID();
const ADMIN_AUTH_ID = randomUUID();

type Counts = Record<string, number>;

async function countEverything(sql: postgres.Sql): Promise<Counts> {
  const tables = await sql<{ name: string }[]>`
    SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const counts: Counts = {};
  for (const { name } of tables) {
    const [row] = await sql.unsafe<{ n: string }[]>(`SELECT count(*) AS n FROM "${name}"`);
    counts[name] = Number(row!.n);
  }
  const [migrations] = await sql<{ n: string }[]>`
    SELECT count(*) AS n FROM drizzle.__drizzle_migrations`;
  counts['drizzle.__drizzle_migrations'] = Number(migrations!.n);
  return counts;
}

async function guardsInPlace(sql: postgres.Sql): Promise<{ triggers: string[]; forced: boolean }> {
  const triggers = await sql<{ tgname: string; tgenabled: string }[]>`
    SELECT tgname, tgenabled FROM pg_trigger
     WHERE tgname IN ${sql(Object.values(APPEND_ONLY_DELETE_TRIGGERS))}`;
  const [messages] = await sql<{ forced: boolean }[]>`
    SELECT relforcerowsecurity AS forced FROM pg_class WHERE relname = 'messages'`;
  return {
    triggers: triggers.map((row) => `${row.tgname}:${row.tgenabled}`).sort(),
    forced: messages!.forced,
  };
}

const GUARDS_ON = {
  triggers: Object.values(APPEND_ONLY_DELETE_TRIGGERS)
    .map((name) => `${name}:O`)
    .sort(),
  forced: true,
};

/** The demo seed plus a row in every table it leaves empty. */
async function fill(database: PostgresTestDatabase, sql: postgres.Sql): Promise<void> {
  await seedReferenceData(database.db);
  await seedDemoData(database.db);

  const [customer] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE role = 'customer' ORDER BY email LIMIT 1`;
  const [vendor] = await sql<{ id: string; user_id: string }[]>`
    SELECT id, user_id FROM vendor_profiles ORDER BY slug LIMIT 1`;
  const [notification] = await sql<{ id: string }[]>`SELECT id FROM notifications LIMIT 1`;
  const [tag] = await sql<{ category: string }[]>`SELECT category FROM tags LIMIT 1`;

  const first = (type: string): string => `(enum_range(NULL::${type}))[1]`;

  await sql.unsafe(`
    INSERT INTO users (id, auth_user_id, email, role, first_name, last_name)
      VALUES ('${ADMIN_ID}', '${ADMIN_AUTH_ID}', 'reset-admin@example.test', 'admin', 'Reset', 'Admin');
    INSERT INTO legal_acceptances (document, version, document_sha256, acceptance_method, accepted_by_user_id, accepted_by_name)
      VALUES (${first('legal_document')}, '1', repeat('a', 64), ${first('legal_acceptance_method')}, '${ADMIN_ID}', 'Reset Admin'),
             (${first('legal_document')}, '1', repeat('b', 64), ${first('legal_acceptance_method')}, '${customer!.id}', 'A Customer');
    INSERT INTO admin_actions (actor_id, action, subject_type, subject_id)
      VALUES ('${ADMIN_ID}', ${first('admin_action')}, ${first('admin_action_subject')}, '${vendor!.id}');
    INSERT INTO step_up_challenges (admin_id, digest, expires_at) VALUES ('${ADMIN_ID}', 'digest', now() + interval '5 minutes');
    INSERT INTO step_up_grants (admin_id, expires_at) VALUES ('${ADMIN_ID}', now() + interval '5 minutes');
    INSERT INTO sign_up_roles (auth_user_id, role, expires_at) VALUES ('pending-auth-id', 'vendor', now() + interval '1 hour');
    INSERT INTO vendor_applications (email) VALUES ('waitlisted@example.test');
    INSERT INTO vendor_invites (email, invited_by) VALUES ('invited@example.test', '${ADMIN_ID}');
    INSERT INTO stream_tickets (fingerprint, user_id, expires_at) VALUES ('fp', '${customer!.id}', now() + interval '1 minute');
    INSERT INTO email_deliveries (notification_id, user_id, recipient_email, notification_type, outcome)
      VALUES ('${notification!.id}', '${customer!.id}', 'customer@example.test', 'booking_request', ${first('email_delivery_outcome')});
    INSERT INTO support_cases (reference, origin, message, sender_user_id) VALUES ('CASE-1', ${first('support_case_origin')}, 'Help', '${customer!.id}');
    INSERT INTO admin_alerts (kind, subject_id, outcome) VALUES (${first('admin_alert_kind')}, 'subject', ${first('admin_alert_outcome')});
    INSERT INTO stripe_webhook_failures (failure) VALUES ('signature mismatch');
    INSERT INTO email_send_days (day, sent) VALUES (current_date, 7);
    INSERT INTO throttle_hits (bucket) VALUES ('sign-in:1.2.3.4');
    INSERT INTO rate_limit_counters (key, hits, window_ends_at) VALUES ('ip:1.2.3.4', 3, now() + interval '1 minute');
    INSERT INTO realtime_events (payload) VALUES ('{}');
    INSERT INTO vendor_slug_aliases (slug, vendor_id) VALUES ('old-slug', '${vendor!.id}');
    INSERT INTO tag_suggestions (vendor_id, suggested_name, category) VALUES ('${vendor!.user_id}', 'Neon signs', '${tag!.category}');
    INSERT INTO platform_settings (id) VALUES (DEFAULT) ON CONFLICT DO NOTHING;
    UPDATE platform_settings SET updated_by = '${ADMIN_ID}';
  `);
}

async function openFilled(): Promise<{ database: PostgresTestDatabase; sql: postgres.Sql }> {
  const database = await createPostgresTestDatabase({ poolSize: 2 });
  const sql = postgres(database.url, { max: 1, onnotice: () => {} });
  await fill(database, sql);
  return { database, sql };
}

function capture(): { out: string[]; err: string[]; io: Parameters<typeof runResetCli>[2] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { out: (line) => out.push(line), err: (line) => err.push(line) } };
}

describe('pnpm db:reset leaves a database untouched when it does not delete', () => {
  let database: PostgresTestDatabase;
  let sql: postgres.Sql;
  let before: Counts;
  let env: NodeJS.ProcessEnv;

  beforeAll(async () => {
    ({ database, sql } = await openFilled());
    before = await countEverything(sql);
    env = { DATABASE_URL_UNPOOLED: database.url };
  }, 180_000);

  afterAll(async () => {
    await sql.end();
    await database.close();
  });

  it('fills more than twenty tables to begin with', () => {
    const filled = Object.entries(before).filter(([, count]) => count > 0);
    expect(filled.length).toBeGreaterThanOrEqual(25);
  });

  it('--dry-run prints the counts and changes nothing', async () => {
    const { out, err, io } = capture();

    const code = await runResetCli(
      ['--tier', 'local', '--confirm', database.name, '--dry-run'],
      env,
      io,
    );

    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(out.at(-1)).toBe('Dry run: nothing was deleted.');
    const reviews = out
      .find((line) => line.startsWith('reviews '))!
      .trim()
      .split(/\s+/);
    expect(reviews).toEqual(['reviews', String(before.reviews), '0']);
    const users = out
      .find((line) => line.startsWith('users '))!
      .trim()
      .split(/\s+/);
    const [admins] = await sql<
      { n: string }[]
    >`SELECT count(*) AS n FROM users WHERE role = 'admin'`;
    expect(users).toEqual(['users', String(before.users! - Number(admins!.n)), admins!.n]);
    expect(await countEverything(sql)).toEqual(before);
    expect(await guardsInPlace(sql)).toEqual(GUARDS_ON);
  });

  it.each([
    ['no --tier', ['--confirm', 'DB', '--yes'], /Refused: --tier must be one of/],
    ['no --confirm', ['--tier', 'local', '--yes'], /Refused: --confirm must name the database/],
    [
      'a wrong --confirm',
      ['--tier', 'local', '--confirm', 'some_other_db', '--yes'],
      /Refused: --confirm does not match the connected database/,
    ],
    [
      'a local database passed with --tier production',
      ['--tier', 'production', '--confirm', 'DB', '--yes'],
      /Refused: --tier production needs the ep-lucky-cherry-axtyizs9 endpoint; the connection is to localhost/,
    ],
    [
      'no --yes',
      ['--tier', 'local', '--confirm', 'DB'],
      /Refused: Nothing was deleted\. Re-run with --yes/,
    ],
  ])('refuses %s, exits 1 and deletes nothing', async (_case, argv, message) => {
    const { err, io } = capture();

    const code = await runResetCli(
      argv.map((arg) => (arg === 'DB' ? database.name : arg)),
      env,
      io,
    );

    expect(code).toBe(1);
    expect(err.join('\n')).toMatch(message);
    expect(await countEverything(sql)).toEqual(before);
  });

  it('refuses a staging URL passed with --tier production before it connects', async () => {
    const staging = new URL('postgresql://ep-jolly-poetry-ax8noqyz.us-east-2.aws.neon.tech/neondb');
    staging.username = 'owner';
    staging.password = 'fake-staging-pw';
    const { err, io } = capture();

    const code = await runResetCli(
      ['--tier', 'production', '--confirm', 'neondb', '--yes'],
      { DATABASE_URL_UNPOOLED: staging.toString() },
      io,
    );

    expect(code).toBe(1);
    expect(err.join('\n')).toMatch(/--tier production needs the ep-lucky-cherry-axtyizs9 endpoint/);
    expect(err.join('\n')).not.toContain('fake-staging-pw');
  });

  it('rolls everything back when the tenth table fails, guards included', async () => {
    const { out, err, io } = capture();
    const reached: string[] = [];

    const code = await runResetCli(
      ['--tier', 'local', '--confirm', database.name, '--yes'],
      env,
      io,
      (table, index) => {
        reached.push(table);
        if (index === 9) {
          throw new Error(`injected failure at ${table} on ${database.url}`);
        }
      },
    );

    expect(code).toBe(1);
    expect(reached).toHaveLength(10);
    expect(err).toEqual([
      `Reset failed, nothing changed: injected failure at ${reached[9]} on <connection string>`,
    ]);
    expect(await countEverything(sql)).toEqual(before);
    expect(await guardsInPlace(sql)).toEqual(GUARDS_ON);

    const password = decodeURIComponent(new URL(database.url).password);
    const printed = [...out, ...err].join('\n');
    expect(printed).not.toContain(database.url);
    if (password) {
      expect(printed).not.toContain(password);
    }
  });

  it('--auth refuses a database with no neon_auth schema', async () => {
    await expect(
      resetDatabase(sql, {
        confirm: database.name,
        yes: true,
        dryRun: false,
        auth: true,
        log: () => {},
      }),
    ).rejects.toThrow(ResetRefusal);
    expect(await countEverything(sql)).toEqual(before);
  });
});

describe('pnpm db:reset --yes', () => {
  let database: PostgresTestDatabase;
  let sql: postgres.Sql;
  let before: Counts;
  let after: Counts;
  let out: string[];
  let admins: string[];

  beforeAll(async () => {
    ({ database, sql } = await openFilled());
    before = await countEverything(sql);
    admins = (
      await sql<{ id: string }[]>`SELECT id FROM users WHERE role = 'admin' ORDER BY id`
    ).map((row) => row.id);
    const captured = capture();
    const code = await runResetCli(
      ['--tier', 'local', '--confirm', database.name, '--yes'],
      { DATABASE_URL_UNPOOLED: database.url },
      captured.io,
    );
    expect(captured.err).toEqual([]);
    expect(code).toBe(0);
    out = captured.out;
    after = await countEverything(sql);
  }, 180_000);

  afterAll(async () => {
    await sql.end();
    await database.close();
  });

  it('keeps reference data, settings, the send-day quota and the migrations table', () => {
    for (const table of [
      'categories',
      'tags',
      'us_cities',
      'platform_settings',
      'email_send_days',
      'drizzle.__drizzle_migrations',
    ]) {
      expect(after[table], table).toBe(before[table]);
    }
    expect(after.categories).toBeGreaterThan(0);
    expect(after.tags).toBeGreaterThan(0);
    expect(after.email_send_days).toBe(1);
  });

  it('keeps every admin and its own consent row, and nothing else of either table', async () => {
    expect(after.users).toBe(admins.length);
    expect(admins).toContain(ADMIN_ID);
    expect(before.users).toBeGreaterThan(admins.length);
    const kept = await sql<{ id: string }[]>`SELECT id FROM users WHERE role = 'admin' ORDER BY id`;
    expect(kept.map((row) => row.id)).toEqual(admins);
    expect(after.legal_acceptances).toBe(1);
    const [consent] = await sql<{ accepted_by_user_id: string }[]>`
      SELECT accepted_by_user_id FROM legal_acceptances`;
    expect(consent!.accepted_by_user_id).toBe(ADMIN_ID);
    const [settings] = await sql<
      { updated_by: string }[]
    >`SELECT updated_by FROM platform_settings`;
    expect(settings!.updated_by).toBe(ADMIN_ID);
  });

  it('empties every other table', () => {
    const kept = new Set([
      'categories',
      'tags',
      'us_cities',
      'platform_settings',
      'email_send_days',
      'users',
      'legal_acceptances',
      'drizzle.__drizzle_migrations',
    ]);
    const leftovers = Object.entries(after).filter(([table, count]) => !kept.has(table) && count);
    expect(leftovers).toEqual([]);
    expect(before.bookings).toBeGreaterThan(0);
    expect(before.booking_events).toBeGreaterThan(0);
    expect(before.messages).toBeGreaterThan(0);
    expect(before.admin_actions).toBe(1);
  });

  it('prints the exact number it deleted', () => {
    const deleted = Object.keys(before).reduce(
      (sum, table) => sum + before[table]! - after[table]!,
      0,
    );
    expect(out.at(-1)).toBe(`Reset ${database.name}: ${deleted} rows deleted.`);
  });

  it('leaves the append-only guards and forced row security on', async () => {
    expect(await guardsInPlace(sql)).toEqual(GUARDS_ON);
    await expect(sql`DELETE FROM legal_acceptances`).rejects.toThrow(/append-only/);
  });
});

describe('resetDatabase --auth', () => {
  let database: PostgresTestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    ({ database, sql } = await openFilled());
    // The shape of the neon_auth schema the directory suite also stands up.
    await sql.unsafe(`
      CREATE SCHEMA neon_auth;
      CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL);
      CREATE TABLE neon_auth.session (id text PRIMARY KEY, "userId" uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE);
    `);
    const customerAuthId = randomUUID();
    await sql`INSERT INTO neon_auth."user" VALUES
      (${ADMIN_AUTH_ID}, 'Reset Admin', 'reset-admin@example.test'),
      (${customerAuthId}, 'A Customer', 'customer@example.test')`;
    await sql`INSERT INTO neon_auth.session VALUES ('admin', ${ADMIN_AUTH_ID}), ('customer', ${customerAuthId})`;
  }, 180_000);

  afterAll(async () => {
    await sql.end();
    await database.close();
  });

  it('removes every identity but the admins, with their sessions', async () => {
    const lines: string[] = [];

    const result = await resetDatabase(sql, {
      confirm: database.name,
      yes: true,
      dryRun: false,
      auth: true,
      log: (line) => lines.push(line),
    });

    expect(result.deleted).toBe(true);
    expect(result.plan.find((row) => row.table === 'neon_auth."user"')).toEqual({
      table: 'neon_auth."user"',
      total: 2,
      keep: 1,
      delete: 1,
    });
    expect(await sql`SELECT id FROM neon_auth."user"`).toEqual([{ id: ADMIN_AUTH_ID }]);
    expect(await sql`SELECT id FROM neon_auth.session`).toEqual([{ id: 'admin' }]);
  });
});
