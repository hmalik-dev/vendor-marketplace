import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { expectedMigrationCount } from '@vendor-marketplace/db';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppDatabase } from '../../lib/database.js';
import { healthRoutes, type HealthRoutesOptions } from './health.routes.js';

/**
 * VEN-565 — `/ready` as the role the API runs as in staging and production.
 *
 * The route suites run as the table owner, so a table the probe reads but
 * `app_api` cannot was invisible until a release connected as `app_api` and its
 * healthcheck answered 503. Here the probe runs on a connection whose role is
 * `app_api` — the `NOLOGIN` role migration 0061 creates and later migrations
 * grant to — over a real Postgres.
 */
let owner: PostgresTestDatabase;
let api: ReturnType<PostgresTestDatabase['connectAs']>;
let app: FastifyInstance;

/** A `/ready` route over `db` for `deployEnv`, with object storage up or down. */
async function readyApp(
  db: AppDatabase,
  deployEnv: HealthRoutesOptions['deployEnv'],
  storageUp = true,
): Promise<FastifyInstance> {
  const instance = Fastify();
  instance.setValidatorCompiler(validatorCompiler);
  instance.setSerializerCompiler(serializerCompiler);
  instance.decorate('db', db);
  instance.decorate('storage', {
    checkAvailable: async () => {
      if (!storageUp) {
        throw new Error('bucket unreachable');
      }
    },
  } as never);
  await instance.register(healthRoutes, { deployEnv });
  await instance.ready();

  return instance;
}

beforeAll(async () => {
  owner = await createPostgresTestDatabase({ poolSize: 2 });
  api = owner.connectAs('app_api');

  app = await readyApp(api as unknown as AppDatabase, 'staging');
}, 90_000);

afterAll(async () => {
  await app?.close();
  await owner?.close();
});

describe('GET /ready connected as app_api', () => {
  it('answers 200 with the database up once every migration is applied', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.json()).toMatchObject({
      status: 'ready',
      database: 'up',
      storage: 'up',
      rowLevelSecurity: 'enforced',
      reason: null,
    });
    expect(response.statusCode).toBe(200);
  });

  it('stays ready with storage down, reporting it in the body (VEN-671)', async () => {
    const storageDown = await readyApp(api as unknown as AppDatabase, 'production', false);

    try {
      const response = await storageDown.inject({ method: 'GET', url: '/ready' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'ready',
        database: 'up',
        storage: 'down',
        rowLevelSecurity: 'enforced',
      });
    } finally {
      await storageDown.close();
    }
  });

  it('reads the applied-migration count, and it is the shipped count', async () => {
    const rows = await api.execute<{ applied: number }>(
      sql`select count(*)::int as applied from drizzle.__drizzle_migrations`,
    );

    expect(rows[0]?.applied).toBe(expectedMigrationCount());
  });
});

describe('what app_api may do in the drizzle schema', () => {
  it.each([
    ['INSERT', `insert into drizzle.__drizzle_migrations (hash, created_at) values ('x', 1)`],
    ['UPDATE', `update drizzle.__drizzle_migrations set hash = 'x'`],
    ['DELETE', `delete from drizzle.__drizzle_migrations`],
    ['CREATE', `create table drizzle.app_api_probe (id int)`],
  ])('refuses %s', async (_verb, statement) => {
    await expect(api.execute(sql.raw(statement))).rejects.toMatchObject({
      cause: { code: '42501' },
    });
  });
});

/*
 * VEN-671 — the owner role carries BYPASSRLS, so an API left on it makes every
 * policy (migration 0061's `messages` rules) decorative while `/ready` stays
 * green. On staging and production that is now a named 503.
 */
describe('GET /ready under a role row-level security does not bind', () => {
  const OWNS_TABLES_ROLE = 'rls_owner_probe';
  const BYPASS_ROLE = 'rls_bypass_probe';
  // A login role granted the owning role skips RLS on tables that are not FORCEd, without owning any itself.
  const MEMBER_ROLE = 'rls_member_probe';

  // Roles belong to the cluster, not the throwaway database, so they outlive it and are dropped by name.
  const PROBE_ROLES = [MEMBER_ROLE, OWNS_TABLES_ROLE, BYPASS_ROLE];

  afterAll(async () => {
    for (const role of PROBE_ROLES) {
      await owner.db.execute(sql.raw(`drop owned by ${role}`));
      await owner.db.execute(sql.raw(`drop role ${role}`));
    }
  });

  beforeAll(async () => {
    // A run that died before its cleanup left these behind.
    for (const role of PROBE_ROLES) {
      await owner.db.execute(sql.raw(`drop role if exists ${role}`));
    }
    await owner.db.execute(sql.raw(`create role ${OWNS_TABLES_ROLE} nologin`));
    await owner.db.execute(sql.raw(`create table public.${OWNS_TABLES_ROLE}_table (id int)`));
    await owner.db.execute(
      sql.raw(`alter table public.${OWNS_TABLES_ROLE}_table owner to ${OWNS_TABLES_ROLE}`),
    );
    await owner.db.execute(sql.raw(`create role ${BYPASS_ROLE} nologin bypassrls`));
    await owner.db.execute(
      sql.raw(`create role ${MEMBER_ROLE} nologin inherit in role ${OWNS_TABLES_ROLE}`),
    );
    // What migration 0077 gives app_api, so the migration count reads and the role is the only variable.
    for (const role of [OWNS_TABLES_ROLE, BYPASS_ROLE]) {
      await owner.db.execute(sql.raw(`grant usage on schema drizzle to ${role}`));
      await owner.db.execute(sql.raw(`grant select on drizzle.__drizzle_migrations to ${role}`));
    }
  });

  async function readyAs(
    role: 'owner' | typeof BYPASS_ROLE | typeof OWNS_TABLES_ROLE | typeof MEMBER_ROLE,
    deployEnv: HealthRoutesOptions['deployEnv'],
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const db = role === 'owner' ? owner.db : owner.connectAs(role);
    const instance = await readyApp(db as unknown as AppDatabase, deployEnv);

    try {
      const response = await instance.inject({ method: 'GET', url: '/ready' });

      return { status: response.statusCode, body: response.json() };
    } finally {
      await instance.close();
    }
  }

  it.each(['staging', 'production'] as const)(
    'answers 503 naming BYPASSRLS on %s',
    async (deployEnv) => {
      const { status, body } = await readyAs(BYPASS_ROLE, deployEnv);

      expect(status).toBe(503);
      expect(body).toMatchObject({
        status: 'not_ready',
        database: 'up',
        rowLevelSecurity: 'bypassed',
      });
      expect(body.reason).toContain('BYPASSRLS');
    },
  );

  it('answers 503 for the table owner, which is a superuser here', async () => {
    const { status, body } = await readyAs('owner', 'production');

    expect(status).toBe(503);
    expect(body).toMatchObject({ status: 'not_ready', rowLevelSecurity: 'bypassed' });
  });

  it('answers 503 naming table ownership for a role that owns tables without BYPASSRLS', async () => {
    const { status, body } = await readyAs(OWNS_TABLES_ROLE, 'staging');

    expect(status).toBe(503);
    expect(body).toMatchObject({ status: 'not_ready', rowLevelSecurity: 'owner' });
    expect(body.reason).toContain('owner of the public tables');
  });

  it('answers 503 for a role that holds the owning role without owning a table itself', async () => {
    const { status, body } = await readyAs(MEMBER_ROLE, 'production');

    expect(status).toBe(503);
    expect(body).toMatchObject({ status: 'not_ready', rowLevelSecurity: 'owner' });
  });

  it('does not check the role on a local API, where the owner is the intended connection', async () => {
    const { status, body } = await readyAs('owner', 'local');

    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'ready', rowLevelSecurity: 'not_checked', reason: null });
  });
});
