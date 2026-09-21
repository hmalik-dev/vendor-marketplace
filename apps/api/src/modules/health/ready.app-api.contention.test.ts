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
import { healthRoutes } from './health.routes.js';

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

beforeAll(async () => {
  owner = await createPostgresTestDatabase({ poolSize: 2 });
  api = owner.connectAs('app_api');

  app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('db', api as unknown as AppDatabase);
  app.decorate('storage', { checkAvailable: async () => undefined } as never);
  await app.register(healthRoutes);
  await app.ready();
}, 90_000);

afterAll(async () => {
  await app?.close();
  await owner?.close();
});

describe('GET /ready connected as app_api', () => {
  it('answers 200 with the database up once every migration is applied', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.json()).toMatchObject({ status: 'ready', database: 'up', storage: 'up' });
    expect(response.statusCode).toBe(200);
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
