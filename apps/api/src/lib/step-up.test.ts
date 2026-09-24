import {
  STEP_UP_CODE_TTL_MS,
  STEP_UP_GRANT_TTL_MS,
  STEP_UP_MAX_ATTEMPTS,
} from '@vendor-marketplace/shared';
import { stepUpChallenges, users } from '@vendor-marketplace/db/schema';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StepUpStore } from './step-up.js';

const NOW = new Date('2026-09-23T12:00:00Z');

/** A code other than the one issued: the digits shifted by one. */
function wrong(code: string): string {
  return code
    .split('')
    .map((digit) => String((Number(digit) + 1) % 10))
    .join('');
}

/**
 * VEN-650 — step-up state is one state across every instance. Two stores over
 * one database stand in for two replicas behind the load balancer.
 */
describe('the step-up store across instances', () => {
  let database: TestDatabase;
  let adminId: string;
  let a: StepUpStore;
  let b: StepUpStore;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
    const [row] = await database.db
      .insert(users)
      .values({
        authUserId: 'user_step_up_store',
        email: 'admin@example.com',
        role: 'admin',
        firstName: 'Op',
        lastName: 'Erator',
      })
      .returning({ id: users.id });
    adminId = row!.id;
    a = new StepUpStore(database.db);
    b = new StepUpStore(database.db);
  });

  beforeEach(async () => {
    await a.revoke(adminId);
  });

  afterAll(async () => {
    await database.close();
  });

  it('spends on one instance the code another issued, and every instance honours the grant', async () => {
    const { code, expiresAt } = await a.issue(adminId, NOW);
    expect(expiresAt).toEqual(new Date(NOW.getTime() + STEP_UP_CODE_TTL_MS));

    expect(await b.verify(adminId, code, NOW)).toEqual(
      new Date(NOW.getTime() + STEP_UP_GRANT_TTL_MS),
    );
    expect(await a.isFresh(adminId, NOW)).toBe(true);
    expect(await b.isFresh(adminId, new Date(NOW.getTime() + STEP_UP_GRANT_TTL_MS))).toBe(false);
    // Spent: the same code does not mint a second grant anywhere.
    expect(await a.verify(adminId, code, NOW)).toBeNull();
  });

  it('counts wrong guesses across instances and voids the code at the limit', async () => {
    const { code } = await a.issue(adminId, NOW);

    for (let attempt = 1; attempt < STEP_UP_MAX_ATTEMPTS; attempt += 1) {
      const store = attempt % 2 === 0 ? a : b;
      expect(await store.verify(adminId, wrong(code), NOW)).toBeNull();
    }
    const [pending] = await database.db.select().from(stepUpChallenges);
    expect(pending?.attempts).toBe(STEP_UP_MAX_ATTEMPTS - 1);

    expect(await a.verify(adminId, wrong(code), NOW)).toBeNull();
    // The last allowed attempt voided it, so even the right code is refused now.
    expect(await b.verify(adminId, code, NOW)).toBeNull();
    expect(await database.db.select().from(stepUpChallenges)).toEqual([]);
  });

  it('refuses an expired code, and a newer code replaces the older one', async () => {
    const first = await a.issue(adminId, NOW);
    const second = await b.issue(adminId, NOW);

    if (first.code !== second.code) {
      expect(await a.verify(adminId, first.code, NOW)).toBeNull();
    }
    expect(
      await a.verify(adminId, second.code, new Date(NOW.getTime() + STEP_UP_CODE_TTL_MS)),
    ).toBeNull();
    expect(await b.isFresh(adminId, NOW)).toBe(false);
  });

  it('leaves a live grant alone when a pending code is cancelled', async () => {
    const { code } = await a.issue(adminId, NOW);
    await b.verify(adminId, code, NOW);
    await a.issue(adminId, NOW);

    await b.cancelChallenge(adminId);

    expect(await a.isFresh(adminId, NOW)).toBe(true);
    expect(await database.db.select().from(stepUpChallenges)).toEqual([]);
  });
});
