import { users } from '@vendor-marketplace/db/schema';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { bookingContextFor } from '../payments/payments.service.js';
import type { AuthIdentitySource } from './identity.js';
import { reconcileAuthUsers } from './auth-sync.reconcile.js';

/**
 * Two instances reconciling at once (VEN-480).
 *
 * The daily timer runs on every API instance and the in-process guard covers
 * only one of them, so what makes a second instance harmless is the
 * retirement's conditional claim. PGlite is one connection and cannot tell that
 * claim from its absence, so this runs on a real Postgres (`db-schema.md`).
 */
describe('two reconcile passes over one deleted identity', () => {
  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });
  });

  afterAll(async () => {
    await harness?.close();
    await database?.close();
  });

  it('retires the account exactly once between them', async () => {
    const db = harness!.database.db;

    for (const authUserId of ['user_kept', 'user_gone']) {
      await db.insert(users).values({
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Katherine',
        lastName: 'Johnson',
        role: 'customer',
      });
    }

    const source = {
      lookup: vi.fn<AuthIdentitySource['lookup']>(async (ids) =>
        ids.includes('user_kept')
          ? [
              {
                id: 'user_kept',
                email: 'user_kept@example.com',
                name: 'Katherine Johnson',
                image: null,
              },
            ]
          : [],
      ),
    };
    const pass = () =>
      reconcileAuthUsers(
        bookingContextFor(harness!.app, harness!.app.log, 'http://localhost:3000'),
        source,
        {},
        new Date(),
      );

    const [first, second] = await Promise.all([pass(), pass()]);

    expect(first.deleted + second.deleted).toBe(1);
    expect(first.flagged + second.flagged).toBe(0);

    const rows = await db.select().from(users).where(eq(users.authUserId, 'user_gone'));
    expect(rows[0]?.deletedAt).toBeInstanceOf(Date);
  });
});
