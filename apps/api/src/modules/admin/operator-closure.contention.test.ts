import { users } from '@vendor-marketplace/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { createTestHarness, signInAs, type TestHarness } from '../../testing/test-server.js';
import { OPERATOR_RETIREMENT_LOCK, retireOperatorById } from '../users/users.dao.js';

/**
 * Two operators closing each other at once — the last-operator refusal's race
 * (VEN-391).
 *
 * `closeAccount` reads "is another operator still live?" before it retires, and
 * both closures pass that read while the other is uncommitted. Without the
 * advisory lock in `retireOperatorById` both retirements commit and nobody can
 * reach the console. PGlite is one connection and would pass with the lock
 * deleted, so this runs on a real Postgres (`db-schema.md`) — and it holds the
 * first closure open by hand, because two requests fired together overlap only
 * when the scheduler happens to agree, which proved nothing when tried.
 */
describe('two operators closing each other at once', () => {
  const ADMIN_ONE = 'user_closing_admin_one';
  const ADMIN_TWO = 'user_closing_admin_two';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let adminOneId: string;
  let adminTwoId: string;

  /** Operator two's retirement, under the shared lock, held open until `release`. */
  function holdRetirement() {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let markRetired!: () => void;
    const retired = new Promise<void>((resolve) => (markRetired = resolve));

    const settled = harness!.database.db.transaction(async (tx) => {
      await tx.execute(OPERATOR_RETIREMENT_LOCK);
      await tx
        .update(users)
        .set({ deletedAt: sql`now()` })
        .where(eq(users.id, adminTwoId));
      markRetired();
      await released;
    });

    return { retired, release, settled };
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

    throw new Error('The closure never blocked on the held retirement');
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const authUserId of [ADMIN_ONE, ADMIN_TWO]) {
      harness.clerkUsers.set(authUserId, {
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

  afterAll(async () => {
    await harness?.close();
    await database?.close();
  });

  it('makes the second retirement wait for the first, then refuses it', async () => {
    const first = holdRetirement();
    await first.retired;

    /*
     * The second closure's retirement of operator one, at the DAO rather than
     * through the route: the route first authenticates operator two, and that
     * read waits on the row the held transaction has just retired — so the lock
     * waiter observed would be the session, not the retirement.
     */
    const second = retireOperatorById(harness!.database.db, adminOneId);

    // A closure that finishes before the first commits did not take the lock.
    const raced = await Promise.race([second.then(() => 'finished' as const), lockWaiter()]);
    expect(raced).toBe('waiting');

    first.release();
    await first.settled;

    expect(await second).toBe('last-operator');

    const live = await harness!.database.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)));
    expect(live).toEqual([{ id: adminOneId }]);
  });
});
