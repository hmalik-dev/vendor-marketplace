import type { FastifyRateLimitOptions, FastifyRateLimitStore } from '@fastify/rate-limit';
import { rateLimitCounters } from '@vendor-marketplace/db/schema';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { postgresRateLimitStore } from './rate-limit-store.js';

const MINUTE = 60_000;
const PARAMS = {} as FastifyRateLimitOptions;

function incr(
  store: FastifyRateLimitStore,
  key: string,
): Promise<{ current: number; ttl: number }> {
  return new Promise((resolve, reject) => {
    store.incr(
      key,
      (error, result) => (error || !result ? reject(error) : resolve(result)),
      MINUTE,
      100,
    );
  });
}

/**
 * VEN-650 — the limiter's counters are one count across every instance. Two
 * stores built over one database stand in for two replicas.
 */
describe('the Postgres rate-limit store', () => {
  let database: TestDatabase;
  let nowMs = Date.parse('2026-09-23T12:00:00Z');

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
  });

  beforeEach(async () => {
    await database.db.delete(rateLimitCounters);
  });

  afterAll(async () => {
    await database.close();
  });

  function replica(): FastifyRateLimitStore {
    const Store = postgresRateLimitStore(database.db, { now: () => nowMs });
    return new Store(PARAMS);
  }

  it('counts one caller across two instances as one budget', async () => {
    const a = replica();
    const b = replica();

    expect(await incr(a, 'visitor:203.0.113.7')).toEqual({ current: 1, ttl: MINUTE });
    nowMs += 1_000;
    expect(await incr(b, 'visitor:203.0.113.7')).toEqual({ current: 2, ttl: MINUTE - 1_000 });
    expect(await incr(a, 'visitor:203.0.113.7')).toEqual({ current: 3, ttl: MINUTE - 1_000 });
    expect(await incr(b, 'visitor:198.51.100.1')).toEqual({ current: 1, ttl: MINUTE });
  });

  it('starts a fresh window once the last one has ended', async () => {
    const store = replica();

    await incr(store, 'visitor:a');
    await incr(store, 'visitor:a');
    nowMs += MINUTE;

    expect(await incr(store, 'visitor:a')).toEqual({ current: 1, ttl: MINUTE });
  });

  it('keeps a route’s own limit in a bucket apart from the API-wide one', async () => {
    const global = replica();
    const route = global.child({
      routeInfo: { method: 'POST', url: '/v1/conversations' },
    } as unknown as Parameters<FastifyRateLimitStore['child']>[0]);

    await incr(global, 'user-1');
    expect(await incr(route, 'user-1')).toEqual({ current: 1, ttl: MINUTE });

    const keys = await database.db.select({ key: rateLimitCounters.key }).from(rateLimitCounters);
    expect(keys.map((row) => row.key).sort()).toEqual(['POST/v1/conversations-user-1', 'user-1']);
  });

  it('drops windows that ended long ago as it counts', async () => {
    const store = replica();
    await incr(store, 'visitor:stale');
    nowMs += 2 * MINUTE;

    await incr(store, 'visitor:fresh');

    const keys = await database.db.select({ key: rateLimitCounters.key }).from(rateLimitCounters);
    expect(keys.map((row) => row.key)).toEqual(['visitor:fresh']);
  });
});
