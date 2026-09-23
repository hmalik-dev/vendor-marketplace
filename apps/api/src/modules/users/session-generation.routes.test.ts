import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

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
      url: '/v1/internal/session-generation',
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

  it('ends every live stream the user has open, and only theirs (VEN-670)', async () => {
    for (const authUserId of ['auth-stream-1', 'auth-stream-2']) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Stream',
        lastName: 'Reader',
        roleHint: 'customer',
        avatarUrl: null,
      });
    }
    const id = await signInAs(harness, 'auth-stream-1');
    const otherId = await signInAs(harness, 'auth-stream-2');

    const open = async (authUserId: string, userId: string) => {
      const ticket = await harness.app.inject({
        method: 'POST',
        url: '/v1/events/stream-ticket',
        headers: bearer(authUserId),
      });
      const before = harness.app.events.countFor(userId);
      const pending = harness.app.inject({
        method: 'GET',
        url: `/v1/events/stream?ticket=${ticket.json().ticket}`,
      });
      await vi.waitFor(() => expect(harness.app.events.countFor(userId)).toBe(before + 1));

      return { pending };
    };

    const streams = [await open('auth-stream-1', id), await open('auth-stream-1', id)];
    const bystander = await open('auth-stream-2', otherId);
    expect(harness.app.events.countFor(id)).toBe(2);

    expect((await bump('auth-stream-1')).statusCode).toBe(200);

    expect(harness.app.events.countFor(id)).toBe(0);
    expect(harness.app.events.countFor(otherId)).toBe(1);
    await Promise.all(streams.map((stream) => stream.pending));
    harness.app.events.closeFor(otherId);
    await bystander.pending;
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
        url: '/v1/internal/session-generation',
        payload: { authUserId: 'auth-x' },
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await local.close();
    }
  });
});
