import { signUpRoles } from '@vendor-marketplace/db/schema';
import { WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { findSignUpRole, markSignUpRoleVerified, recordSignUpRole } from './sign-up-roles.dao.js';

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
      'verifiedAt',
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

describe('POST /internal/sign-up-role/verified (VEN-756)', () => {
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

  function mark(payload: Record<string, unknown>, key: string | null = KEY) {
    return harness.app.inject({
      method: 'POST',
      url: '/v1/internal/sign-up-role/verified',
      headers: key ? { [WEB_TIER_KEY_HEADER]: key } : {},
      payload,
    });
  }

  async function verifiedAt(): Promise<Record<string, Date | null>> {
    const rows = await harness.database.db.select().from(signUpRoles);
    return Object.fromEntries(rows.map((row) => [row.authUserId, row.verifiedAt]));
  }

  it('marks that identity’s record and no other, keeping its role', async () => {
    await recordSignUpRole(harness.database.db, 'auth-a', 'vendor');
    await recordSignUpRole(harness.database.db, 'auth-b', 'customer');

    const response = await mark({ authUserId: 'auth-a' });

    expect([response.statusCode, response.json()]).toEqual([200, { verified: true }]);
    const marked = await verifiedAt();
    expect(marked['auth-a']).toBeInstanceOf(Date);
    expect(marked['auth-b']).toBeNull();
    expect(await findSignUpRole(harness.database.db, 'auth-a')).toBe('vendor');
  });

  it('keeps the first mark', async () => {
    const first = new Date('2026-09-20T10:00:00.000Z');
    await recordSignUpRole(harness.database.db, 'auth-a', 'vendor', first);
    await markSignUpRoleVerified(harness.database.db, 'auth-a', first);

    expect((await mark({ authUserId: 'auth-a' })).statusCode).toBe(200);

    expect((await verifiedAt())['auth-a']).toEqual(first);
  });

  it('answers the same for an unknown identity and stores nothing', async () => {
    const response = await mark({ authUserId: 'auth-unknown' });

    expect([response.statusCode, response.json()]).toEqual([200, { verified: true }]);
    expect(await verifiedAt()).toEqual({});
  });

  it('answers 401 without the web tier key and to a wrong one, and marks nothing', async () => {
    await recordSignUpRole(harness.database.db, 'auth-a', 'vendor');

    expect((await mark({ authUserId: 'auth-a' }, null)).statusCode).toBe(401);
    expect((await mark({ authUserId: 'auth-a' }, 'w'.repeat(40))).statusCode).toBe(401);
    expect(await verifiedAt()).toEqual({ 'auth-a': null });
  });

  it('refuses an empty identity with a 400', async () => {
    expect((await mark({ authUserId: '' })).statusCode).toBe(400);
  });
});

describe('DELETE /internal/sign-up-role (VEN-663)', () => {
  let harness: TestHarness;

  const SQUATTED = 'auth-squatted';

  beforeAll(async () => {
    harness = await createTestHarness({ acceptTerms: false, env: { WEB_TIER_KEY: KEY } });
    harness.authUsers.set(SQUATTED, {
      authUserId: SQUATTED,
      email: 'owner@example.com',
      firstName: 'Ada',
      lastName: 'Reyes',
      roleHint: null,
      avatarUrl: null,
    });
  });

  afterEach(async () => {
    await harness.database.db.delete(signUpRoles);
  });

  afterAll(async () => {
    await harness.close();
  });

  function forget(payload: Record<string, unknown>, key: string | null = KEY) {
    return harness.app.inject({
      method: 'DELETE',
      url: '/v1/internal/sign-up-role',
      headers: key ? { [WEB_TIER_KEY_HEADER]: key } : {},
      payload,
    });
  }

  async function recordedIds(): Promise<string[]> {
    return (await harness.database.db.select().from(signUpRoles)).map((row) => row.authUserId);
  }

  it('forgets that identity’s record and no other', async () => {
    await recordSignUpRole(harness.database.db, SQUATTED, 'customer');
    await recordSignUpRole(harness.database.db, 'auth-other', 'vendor');

    const response = await forget({ authUserId: SQUATTED });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ forgotten: true });
    expect(await recordedIds()).toEqual(['auth-other']);
  });

  it('keeps a record the address verified before the reset, and the Terms read still states it', async () => {
    await recordSignUpRole(harness.database.db, SQUATTED, 'vendor');
    await markSignUpRoleVerified(harness.database.db, SQUATTED);

    const response = await forget({ authUserId: SQUATTED });

    expect([response.statusCode, response.json()]).toEqual([200, { forgotten: true }]);
    expect(await recordedIds()).toEqual([SQUATTED]);
    const status = await harness.app.inject({
      method: 'GET',
      url: '/v1/legal/terms',
      headers: bearer(SQUATTED),
    });
    expect(status.json()).toMatchObject({ account: { exists: false }, signUpRole: 'vendor' });
  });

  it('answers the same for an unknown identity and changes nothing', async () => {
    await recordSignUpRole(harness.database.db, 'auth-other', 'vendor');

    const response = await forget({ authUserId: 'auth-unknown' });

    expect([response.statusCode, response.json()]).toEqual([200, { forgotten: true }]);
    expect(await recordedIds()).toEqual(['auth-other']);
  });

  it('answers 401 without the web tier key and to a wrong one, and deletes nothing', async () => {
    await recordSignUpRole(harness.database.db, SQUATTED, 'customer');

    expect((await forget({ authUserId: SQUATTED }, null)).statusCode).toBe(401);
    expect((await forget({ authUserId: SQUATTED }, 'w'.repeat(40))).statusCode).toBe(401);
    expect(await recordedIds()).toEqual([SQUATTED]);
  });

  it('refuses an empty identity with a 400', async () => {
    expect((await forget({ authUserId: '' })).statusCode).toBe(400);
  });

  it('leaves the Terms read with no recorded role for that identity', async () => {
    await recordSignUpRole(harness.database.db, SQUATTED, 'customer');
    const status = () =>
      harness.app.inject({ method: 'GET', url: '/v1/legal/terms', headers: bearer(SQUATTED) });
    expect((await status()).json()).toMatchObject({ signUpRole: 'customer' });

    await forget({ authUserId: SQUATTED });

    const after = await status();
    expect(after.statusCode).toBe(200);
    expect(after.json()).toMatchObject({ account: { exists: false }, signUpRole: null });
  });
});
