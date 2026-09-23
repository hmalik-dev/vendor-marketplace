import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';

const KEY = 'k'.repeat(40);

describe('POST /internal/session-generation (VEN-628)', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ env: { WEB_TIER_KEY: KEY } });
  });

  afterEach(async () => {
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  function bump(authUserId: string, key: string | null = KEY) {
    return harness.app.inject({
      method: 'POST',
      url: '/internal/session-generation',
      headers: key ? { [WEB_TIER_KEY_HEADER]: key } : {},
      payload: { authUserId },
    });
  }

  it('bumps the named user’s invalidation timestamp', async () => {
    await harness.database.db.insert(users).values({
      authUserId: 'auth-bump-1',
      email: 'bump@example.com',
      role: 'customer',
      firstName: 'Ada',
      lastName: 'Reyes',
    });

    const response = await bump('auth-bump-1');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ invalidated: true });
    const [row] = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.authUserId, 'auth-bump-1'));
    expect(row?.sessionsInvalidatedAt).not.toBeNull();
  });

  it('answers 200 for an auth subject with no row, and writes nothing', async () => {
    const response = await bump('no-such-subject');

    expect(response.statusCode).toBe(200);
    expect(await harness.database.db.select().from(users)).toHaveLength(0);
  });

  it('answers 401 without the web tier key and to a wrong one', async () => {
    expect((await bump('auth-x', null)).statusCode).toBe(401);
    expect((await bump('auth-x', 'w'.repeat(40))).statusCode).toBe(401);
  });

  it('is not found with no web tier key configured', async () => {
    const local = await createTestHarness({ env: { WEB_TIER_KEY: undefined } });
    try {
      const response = await local.app.inject({
        method: 'POST',
        url: '/internal/session-generation',
        payload: { authUserId: 'auth-x' },
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await local.close();
    }
  });
});
