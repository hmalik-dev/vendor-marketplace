import { adminActions, users } from '@vendor-marketplace/db/schema';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { createTestHarness, signInAs, type TestHarness } from '../../testing/test-server.js';
import type { BookingContext } from '../payments/payments.service.js';
import { setUserBanned } from './admin.service.js';

/**
 * Banning one account twice at once writes one ban (VEN-636).
 *
 * Both requests read the target as not banned, so without the flag in the
 * update's condition each one commits its own `user_banned` row and the later
 * one moves `bannedAt`. Real Postgres: PGlite is one connection and cannot
 * overlap the two writes.
 */
describe('two admins banning the same customer at once', () => {
  const ADMIN_ONE = 'user_double_ban_admin_one';
  const ADMIN_TWO = 'user_double_ban_admin_two';
  const CUSTOMER = 'user_double_ban_customer';
  const FIRST = new Date('2026-09-15T12:00:00Z');

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let adminOneId: string;
  let adminTwoId: string;
  let customerId: string;

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

  async function banRows() {
    return harness!.database.db
      .select({ id: adminActions.id })
      .from(adminActions)
      .where(and(eq(adminActions.action, 'user_banned'), eq(adminActions.subjectId, customerId)));
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const [authUserId, roleHint] of [
      [ADMIN_ONE, 'customer'],
      [ADMIN_TWO, 'customer'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint,
        avatarUrl: null,
      });
    }

    adminOneId = await signInAs(harness, ADMIN_ONE, true);
    adminTwoId = await signInAs(harness, ADMIN_TWO, true);
    customerId = await signInAs(harness, CUSTOMER);
  });

  afterAll(async () => {
    await harness?.close();
    await database?.close();
  });

  it('writes one user_banned row however many bans overlap', async () => {
    const outcomes = await Promise.allSettled(
      [adminOneId, adminTwoId, adminOneId, adminTwoId, adminOneId, adminTwoId].map(
        (actorId, index) =>
          setUserBanned(context(), actorId, customerId, true, new Date(FIRST.getTime() + index)),
      ),
    );

    // A caller that read the flag after the winner committed resumes (200); one that read
    // it before is refused (409). Either way exactly one of them wrote the ban.
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        expect(outcome.reason).toMatchObject({
          statusCode: 409,
          message: 'That account is already banned',
        });
      }
    }

    expect(await banRows()).toHaveLength(1);
  });
});
