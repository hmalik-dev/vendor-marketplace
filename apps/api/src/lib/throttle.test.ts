import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { throttleHits } from '@vendor-marketplace/db/schema';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import { chargeThrottle, purgeThrottleHits } from './throttle.js';

const WINDOW = 60_000;
const T0 = new Date('2026-06-01T12:00:00Z');
const later = (ms: number): Date => new Date(T0.getTime() + ms);

let database: TestDatabase;

async function rows(bucket: string): Promise<number> {
  const [row] = await database.db
    .select({ n: count() })
    .from(throttleHits)
    .where(eq(throttleHits.bucket, bucket));

  return row?.n ?? 0;
}

describe('chargeThrottle', () => {
  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
  });

  afterAll(async () => {
    await database.close();
  });

  it('refuses the call past the limit and no earlier', async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i += 1) {
      results.push(await chargeThrottle(database.db, 'limit', WINDOW, 3, T0));
    }

    expect(results).toEqual([false, false, false, true]);
  });

  it('forgives a bucket once its window has passed — a throttle, not a ban list', async () => {
    for (let i = 0; i < 4; i += 1) await chargeThrottle(database.db, 'window', WINDOW, 3, T0);

    expect(await chargeThrottle(database.db, 'window', WINDOW, 3, later(WINDOW - 1))).toBe(true);
    expect(await chargeThrottle(database.db, 'window', WINDOW, 3, later(WINDOW + 1))).toBe(false);
    expect(await rows('window')).toBe(1);
  });

  it('adds no rows once a bucket is over, so a flood cannot grow the table', async () => {
    for (let i = 0; i < 3; i += 1) await chargeThrottle(database.db, 'flood', WINDOW, 3, T0);
    for (let i = 0; i < 50; i += 1) {
      expect(await chargeThrottle(database.db, 'flood', WINDOW, 3, T0)).toBe(true);
    }

    expect(await rows('flood')).toBe(3);
  });

  it('reads without recording, and refuses once the budget is spent', async () => {
    expect(await chargeThrottle(database.db, 'peek', WINDOW, 2, T0, false)).toBe(false);
    await chargeThrottle(database.db, 'peek', WINDOW, 2, T0);
    await chargeThrottle(database.db, 'peek', WINDOW, 2, T0);

    expect(await chargeThrottle(database.db, 'peek', WINDOW, 2, T0, false)).toBe(true);
    expect(await rows('peek')).toBe(2);
  });

  it('purges buckets nobody has charged for a day and keeps recent ones', async () => {
    await chargeThrottle(database.db, 'old', WINDOW, 3, T0);
    await chargeThrottle(database.db, 'fresh', WINDOW, 3, later(86_400_000 - 1_000));

    await purgeThrottleHits(database.db, later(86_400_000 + 1_000));

    expect(await rows('old')).toBe(0);
    expect(await rows('fresh')).toBe(1);
  });
});
