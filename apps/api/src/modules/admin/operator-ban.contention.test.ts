import { users } from '@vendor-marketplace/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { createTestHarness, signInAs, type TestHarness } from '../../testing/test-server.js';
import type { BookingContext } from '../payments/payments.service.js';
import { OPERATOR_RETIREMENT_LOCK } from '../users/users.dao.js';
import { LAST_OPERATOR_BAN_REFUSAL, setUserBanned } from './admin.service.js';

/**
 * A ban racing another way out of the live operator set (VEN-417).
 *
 * Exactly two operators. One bans the other while that one closes, or bans,
 * the first. Each request's read still counts its own actor as live, so without
 * `OPERATOR_RETIREMENT_LOCK` on the ban both commit and nobody can reach the
 * console. The competing write is held open by hand under the lock — two
 * requests fired together overlap only when the scheduler agrees — and the ban
 * is driven through the service, below the route whose session read would
 * otherwise be the waiter observed. Real Postgres, because PGlite is one
 * connection and passes with the lock deleted.
 */
describe('banning an operator while the other operator leaves the live set', () => {
  const ADMIN_ONE = 'user_banning_admin_one';
  const ADMIN_TWO = 'user_banning_admin_two';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let adminOneId: string;
  let adminTwoId: string;
  /** The write a failed assertion left open, so it cannot hang the next test's reset. */
  let held: { release: () => void; settled: Promise<void> } | undefined;

  function context(): BookingContext {
    return {
      db: harness!.database.db,
      stripe: harness!.stripe,
      hub: harness!.app.events,
      log: harness!.app.log,
      mail: {
        db: harness!.database.db,
        email: harness!.email,
        log: harness!.app.log,
        webOrigin: 'http://localhost:3000',
        background: harness!.app.background,
      },
    };
  }

  /** Operator two's write against operator one, under the shared lock, held open until `release`. */
  function holdUnderLock(change: { deletedAt: ReturnType<typeof sql> } | { isBanned: true }) {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let markWritten!: () => void;
    const written = new Promise<void>((resolve) => (markWritten = resolve));

    const settled = harness!.database.db.transaction(async (tx) => {
      await tx.execute(OPERATOR_RETIREMENT_LOCK);
      await tx.update(users).set(change).where(eq(users.id, adminOneId));
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
      const rows = await harness!.database.db.execute<{ pid: number }>(
        sql`select pid from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`,
      );

      if (rows.length === 1) {
        return 'waiting';
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error('The ban never blocked on the held write');
  }

  /** Operator one bans operator two; resolves to the outcome rather than throwing. */
  async function banTwo(): Promise<{ status: number; message: string } | 'banned'> {
    try {
      await setUserBanned(
        context(),
        adminOneId,
        adminTwoId,
        true,
        new Date('2026-09-15T12:00:00Z'),
      );
      return 'banned';
    } catch (error) {
      const { statusCode, message } = error as { statusCode: number; message: string };
      return { status: statusCode, message };
    }
  }

  async function liveOperators() {
    return harness!.database.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), isNull(users.deletedAt), eq(users.isBanned, false)));
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const authUserId of [ADMIN_ONE, ADMIN_TWO]) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'Operator',
        roleHint: 'customer',
        avatarUrl: null,
      });
    }

    adminOneId = await signInAs(harness, ADMIN_ONE, true);
    adminTwoId = await signInAs(harness, ADMIN_TWO, true);
  });

  beforeEach(async () => {
    await harness!.database.db
      .update(users)
      .set({ deletedAt: null, isBanned: false, bannedAt: null })
      .where(eq(users.role, 'admin'));
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

  it('makes a ban wait for a closure of its actor, then refuses it with a 409', async () => {
    const closure = holdUnderLock({ deletedAt: sql`now()` });
    await closure.written;

    const ban = banTwo();

    // A ban that finishes before the closure commits did not take the lock.
    const raced = await Promise.race([ban.then(() => 'finished' as const), lockWaiter()]);
    expect(raced).toBe('waiting');

    closure.release();
    await closure.settled;

    expect(await ban).toEqual({ status: 409, message: LAST_OPERATOR_BAN_REFUSAL });
    expect(await liveOperators()).toEqual([{ id: adminTwoId }]);
  });

  it('makes a ban wait for a ban of its actor, then refuses it with a 409', async () => {
    const otherBan = holdUnderLock({ isBanned: true });
    await otherBan.written;

    const ban = banTwo();

    const raced = await Promise.race([ban.then(() => 'finished' as const), lockWaiter()]);
    expect(raced).toBe('waiting');

    otherBan.release();
    await otherBan.settled;

    expect(await ban).toEqual({ status: 409, message: LAST_OPERATOR_BAN_REFUSAL });
    expect(await liveOperators()).toEqual([{ id: adminTwoId }]);
  });

  it('still bans an operator while another operator stays live', async () => {
    expect(await banTwo()).toBe('banned');
    expect(await liveOperators()).toEqual([{ id: adminOneId }]);
  });
});
