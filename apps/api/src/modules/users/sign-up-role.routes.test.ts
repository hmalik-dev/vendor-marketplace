import { signUpRoles } from '@vendor-marketplace/db/schema';
import { WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { findSignUpRole } from './sign-up-roles.dao.js';

const KEY = 'k'.repeat(40);

describe('POST /internal/sign-up-role (VEN-662)', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ env: { WEB_TIER_KEY: KEY } });
  });

  afterEach(async () => {
    await harness.database.db.delete(signUpRoles);
  });

  afterAll(async () => {
    await harness.close();
  });

  function record(payload: Record<string, unknown>, key: string | null = KEY) {
    return harness.app.inject({
      method: 'POST',
      url: '/v1/internal/sign-up-role',
      headers: key ? { [WEB_TIER_KEY_HEADER]: key } : {},
      payload,
    });
  }

  it('stores the role against the identity, and nothing about the person', async () => {
    const response = await record({ authUserId: 'auth-a', role: 'vendor' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ recorded: true });
    const rows = await harness.database.db.select().from(signUpRoles);
    expect(rows.map(({ authUserId, role }) => ({ authUserId, role }))).toEqual([
      { authUserId: 'auth-a', role: 'vendor' },
    ]);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'authUserId',
      'createdAt',
      'expiresAt',
      'role',
    ]);
  });

  it('keeps the first choice: a second record for the same identity changes nothing', async () => {
    expect((await record({ authUserId: 'auth-a', role: 'customer' })).statusCode).toBe(200);

    const replay = await record({ authUserId: 'auth-a', role: 'vendor' });

    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ recorded: true });
    expect(await findSignUpRole(harness.database.db, 'auth-a')).toBe('customer');
  });

  it('keeps two identities apart', async () => {
    await record({ authUserId: 'auth-a', role: 'customer' });
    await record({ authUserId: 'auth-b', role: 'vendor' });

    expect(await findSignUpRole(harness.database.db, 'auth-a')).toBe('customer');
    expect(await findSignUpRole(harness.database.db, 'auth-b')).toBe('vendor');
    expect(await findSignUpRole(harness.database.db, 'auth-c')).toBeNull();
  });

  it.each([['admin'], ['Vendor'], [''], [null], [undefined]])(
    'refuses the role %j with a 400 and stores nothing',
    async (role) => {
      const response = await record({ authUserId: 'auth-a', role });

      expect(response.statusCode).toBe(400);
      expect(await harness.database.db.select().from(signUpRoles)).toEqual([]);
    },
  );

  it('refuses an empty identity with a 400', async () => {
    expect((await record({ authUserId: '', role: 'customer' })).statusCode).toBe(400);
  });

  it('answers 401 without the web tier key and to a wrong one, and stores nothing', async () => {
    expect((await record({ authUserId: 'auth-a', role: 'vendor' }, null)).statusCode).toBe(401);
    expect(
      (await record({ authUserId: 'auth-a', role: 'vendor' }, 'w'.repeat(40))).statusCode,
    ).toBe(401);
    expect(await harness.database.db.select().from(signUpRoles)).toEqual([]);
  });

  it('drops expired records as the next one is written, and reads them as absent', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await harness.database.db
      .insert(signUpRoles)
      .values({ authUserId: 'auth-old', role: 'vendor', expiresAt: eightDaysAgo });

    expect(await findSignUpRole(harness.database.db, 'auth-old')).toBeNull();

    await record({ authUserId: 'auth-new', role: 'customer' });

    expect(
      (await harness.database.db.select().from(signUpRoles)).map((row) => row.authUserId),
    ).toEqual(['auth-new']);
  });

  it('is not found with no web tier key configured', async () => {
    const local = await createTestHarness({ env: { WEB_TIER_KEY: undefined } });
    try {
      const response = await local.app.inject({
        method: 'POST',
        url: '/v1/internal/sign-up-role',
        payload: { authUserId: 'auth-a', role: 'vendor' },
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await local.close();
    }
  });
});
