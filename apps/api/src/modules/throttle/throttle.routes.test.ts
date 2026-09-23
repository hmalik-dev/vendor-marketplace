import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';

const KEY = 'k'.repeat(40);

describe('POST /internal/throttle', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ env: { WEB_TIER_KEY: KEY } });
  });

  afterAll(async () => {
    await harness.close();
  });

  function charge(bucket: string, limit: number, key: string | null = KEY) {
    return harness.app.inject({
      method: 'POST',
      url: '/v1/internal/throttle',
      headers: key ? { [WEB_TIER_KEY_HEADER]: key } : {},
      payload: { bucket, windowMs: 60_000, limit },
    });
  }

  it('counts every call to one bucket and refuses the one past the limit', async () => {
    const results: boolean[] = [];

    for (let i = 0; i < 4; i += 1) {
      const response = await charge('sign-in|a@example.com', 3);
      expect(response.statusCode).toBe(200);
      results.push(response.json().throttled);
    }

    expect(results).toEqual([false, false, false, true]);
  });

  it('keeps buckets apart', async () => {
    for (let i = 0; i < 4; i += 1) await charge('one', 3);

    expect((await charge('two', 3)).json()).toEqual({ throttled: false });
  });

  it('answers 401 without the web tier key and to a wrong one', async () => {
    expect((await charge('x', 3, null)).statusCode).toBe(401);
    expect((await charge('x', 3, 'w'.repeat(40))).statusCode).toBe(401);
  });

  it('reads the count without adding a hit when record is false', async () => {
    const peek = () =>
      harness.app.inject({
        method: 'POST',
        url: '/v1/internal/throttle',
        headers: { [WEB_TIER_KEY_HEADER]: KEY },
        payload: { bucket: 'peek', windowMs: 60_000, limit: 1, record: false },
      });

    expect((await peek()).json()).toEqual({ throttled: false });
    await charge('peek', 1);
    // One hit spends a budget of one; a second peek must not have added any.
    expect((await peek()).json()).toEqual({ throttled: true });
    expect((await peek()).json()).toEqual({ throttled: true });
    expect((await charge('peek', 2)).json()).toEqual({ throttled: false });
  });

  it('refuses a keyless caller before reading its body', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/internal/throttle',
      headers: { 'content-type': 'application/json' },
      payload: 'x'.repeat(4_000),
    });

    // 401, not the 400 or 413 its body would earn: the key is checked first.
    expect(response.statusCode).toBe(401);
  });

  it('rejects a body outside the bounds', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/internal/throttle',
      headers: { [WEB_TIER_KEY_HEADER]: KEY },
      payload: { bucket: 'x', windowMs: 60_000, limit: 1_000_000 },
    });

    expect(response.statusCode).toBe(400);
  });

  it('does not exist where no web tier key is configured', async () => {
    const local = await createTestHarness({ env: { WEB_TIER_KEY: undefined } });

    try {
      const response = await local.app.inject({
        method: 'POST',
        url: '/v1/internal/throttle',
        headers: { [WEB_TIER_KEY_HEADER]: KEY },
        payload: { bucket: 'x', windowMs: 60_000, limit: 3 },
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await local.close();
    }
  });

  it('shares the count with a second instance over the same database', async () => {
    const second = await createTestHarness({
      database: harness.database,
      env: { WEB_TIER_KEY: KEY },
    });

    try {
      await charge('shared', 2);
      await charge('shared', 2);
      const response = await second.app.inject({
        method: 'POST',
        url: '/v1/internal/throttle',
        headers: { [WEB_TIER_KEY_HEADER]: KEY },
        payload: { bucket: 'shared', windowMs: 60_000, limit: 2 },
      });

      expect(response.json()).toEqual({ throttled: true });
    } finally {
      await second.app.close();
    }
  });
});
