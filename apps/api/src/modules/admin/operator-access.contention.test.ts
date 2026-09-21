import { adminActions, users } from '@vendor-marketplace/db/schema';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, signInAs, type TestHarness } from '../../testing/test-server.js';
import { setUserRole } from '../../testing/set-user-role.js';
import { OPERATOR_RETIREMENT_LOCK } from '../users/users.dao.js';
import { grantOperator, revokeOperator } from './admin-operators.service.js';

/**
 * Operator grant and revoke racing the other ways out of the live set
 * (VEN-506).
 *
 * The competing write is held open by hand under `OPERATOR_RETIREMENT_LOCK`,
 * as `operator-ban.contention.test.ts` does, so the grant or revoke overlaps
 * it for certain. Real Postgres, because PGlite is one connection and passes
 * with the lock deleted.
 */
describe('operator grant and revoke against a competing change to the live set', () => {
  const ONE = 'user_opaccess_one';
  const TWO = 'user_opaccess_two';
  const CANDIDATE = 'user_opaccess_candidate';
  const NOW = new Date('2026-09-21T12:00:00Z');

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let oneId: string;
  let twoId: string;
  let candidateId: string;
  let held: { release: () => void; settled: Promise<void> } | undefined;

  const db = () => harness!.database.db;

  /** A write to `userId` under the shared lock, held open until `release`. */
  function holdUnderLock(userId: string, change: { isBanned: true }) {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let markWritten!: () => void;
    const written = new Promise<void>((resolve) => (markWritten = resolve));

    const settled = db().transaction(async (tx) => {
      await tx.execute(OPERATOR_RETIREMENT_LOCK);
      await tx.update(users).set(change).where(eq(users.id, userId));
      markWritten();
      await released;
    });

    held = { release, settled };
    return { written, release, settled };
  }

  /** Resolves once exactly one statement in this database is waiting on a lock. */
  async function lockWaiter(): Promise<'waiting'> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const rows = await db().execute<{ pid: number }>(
        sql`select pid from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`,
      );

      if (rows.length === 1) {
        return 'waiting';
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error('The operator change never blocked on the held write');
  }

  const outcome = async (work: Promise<unknown>): Promise<number | 'done'> =>
    work.then(
      () => 'done' as const,
      (error: { statusCode: number }) => error.statusCode,
    );

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const authUserId of [ONE, TWO, CANDIDATE]) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'Operator',
        roleHint: 'customer',
        avatarUrl: null,
      });
    }

    oneId = await signInAs(harness, ONE, true);
    twoId = await signInAs(harness, TWO, true);
    candidateId = await signInAs(harness, CANDIDATE);
  });

  beforeEach(async () => {
    await setUserRole(db(), 'admin', eq(users.id, oneId));
    await setUserRole(db(), 'admin', eq(users.id, twoId));
    await setUserRole(db(), 'customer', eq(users.id, candidateId));
    await db().update(users).set({ isBanned: false, bannedAt: null });
    // The log is append-only, so a grant row from an earlier test stays; the
    // latest one for `twoId` is always the customer grant below.
    await db()
      .insert(adminActions)
      .values({
        actorId: oneId,
        action: 'operator_granted',
        subjectType: 'user',
        subjectId: twoId,
        detail: { previousRole: 'customer' },
      });
  });

  afterEach(async () => {
    held?.release();
    await held?.settled;
    held = undefined;
  });

  afterAll(async () => {
    await harness?.close();
    await database?.close();
  });

  it('makes a revoke wait for a ban of the other operator, then refuses it with a 409', async () => {
    const otherBan = holdUnderLock(oneId, { isBanned: true });
    await otherBan.written;

    const revoke = outcome(revokeOperator(db(), oneId, twoId, NOW));

    const raced = await Promise.race([revoke.then(() => 'finished' as const), lockWaiter()]);
    expect(raced).toBe('waiting');

    otherBan.release();
    await otherBan.settled;

    expect(await revoke).toBe(409);
    const live = await db()
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), isNull(users.deletedAt), eq(users.isBanned, false)));
    expect(live).toEqual([{ id: twoId }]);
  });

  it('makes a grant wait for a ban of its target, then refuses it with a 409', async () => {
    const targetBan = holdUnderLock(candidateId, { isBanned: true });
    await targetBan.written;

    const grant = outcome(grantOperator(db(), oneId, `${CANDIDATE}@example.com`, NOW));

    const raced = await Promise.race([grant.then(() => 'finished' as const), lockWaiter()]);
    expect(raced).toBe('waiting');

    targetBan.release();
    await targetBan.settled;

    expect(await grant).toBe(409);
    const [candidate] = await db()
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, candidateId));
    expect(candidate!.role).toBe('customer');
  });

  it('still revokes while another operator stays live', async () => {
    expect(await outcome(revokeOperator(db(), oneId, twoId, NOW))).toBe('done');
    const [two] = await db().select({ role: users.role }).from(users).where(eq(users.id, twoId));
    expect(two!.role).toBe('customer');
  });
});
