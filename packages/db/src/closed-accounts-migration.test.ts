import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users } from './schema/index.js';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * `0089` against accounts closed before closure anonymised the row (VEN-614).
 *
 * Data-only and re-runnable, so the suite migrates to head, writes the legacy
 * rows, and applies it again — the same shape as `image-keys-migration.test.ts`.
 */
const THIS_MIGRATION = '0089_closed_accounts_forget_the_person';

const CLOSED_CUSTOMER = '7a1c2b0a-1111-4222-8333-944445555666';
const CLOSED_ADMIN = '7a1c2b0a-2222-4222-8333-944445555666';
const LIVE = '7a1c2b0a-3333-4222-8333-944445555666';

let testDb: TestDatabase;

async function applyMigration(): Promise<void> {
  const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${THIS_MIGRATION}.sql`), 'utf8');

  for (const statement of body.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) {
      await testDb.db.execute(sql.raw(statement));
    }
  }
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
});

afterAll(async () => {
  await testDb.close();
});

describe('0089 against accounts closed before the scrub', () => {
  it('forgets the person on a closed row, and leaves a live one alone', async () => {
    const closedAt = new Date('2026-09-01T00:00:00Z');
    const person = {
      phone: '512-555-0142',
      avatarUrl: 'customer-profile/x/me.webp',
      bio: 'Planning my wedding!',
      city: 'Austin',
      state: 'TX',
      pendingEmail: 'next@example.com',
      emailSyncFailedAt: closedAt,
    };

    await testDb.db.insert(users).values([
      {
        id: CLOSED_CUSTOMER,
        authUserId: 'legacy_closed_customer',
        email: 'priya@example.com',
        role: 'customer',
        firstName: 'Priya',
        lastName: 'Nair',
        deletedAt: closedAt,
        ...person,
      },
      {
        id: CLOSED_ADMIN,
        authUserId: 'legacy_closed_admin',
        email: 'ops@example.com',
        role: 'admin',
        firstName: 'Ola',
        lastName: 'Ops',
        deletedAt: closedAt,
      },
      {
        id: LIVE,
        authUserId: 'legacy_live',
        email: 'sam@example.com',
        role: 'vendor',
        firstName: 'Sam',
        lastName: 'Lee',
        ...person,
      },
    ]);

    await applyMigration();

    const [customer] = await testDb.db.select().from(users).where(eq(users.id, CLOSED_CUSTOMER));
    expect(customer).toMatchObject({
      email: `closed+${CLOSED_CUSTOMER}@invalid`,
      firstName: 'Former customer',
      lastName: '',
      phone: null,
      avatarUrl: null,
      bio: null,
      city: null,
      state: null,
      pendingEmail: null,
      emailSyncFailedAt: null,
      authUserId: 'legacy_closed_customer',
      deletedAt: closedAt,
    });

    const [admin] = await testDb.db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, CLOSED_ADMIN));
    expect(admin).toEqual({
      email: `closed+${CLOSED_ADMIN}@invalid`,
      firstName: 'Former operator',
    });

    const [live] = await testDb.db.select().from(users).where(eq(users.id, LIVE));
    expect(live).toMatchObject({
      email: 'sam@example.com',
      firstName: 'Sam',
      lastName: 'Lee',
      ...person,
    });

    const [before] = await testDb.db
      .select({ updatedAt: users.updatedAt })
      .from(users)
      .where(eq(users.id, CLOSED_CUSTOMER));
    await applyMigration();
    const [after] = await testDb.db
      .select({ updatedAt: users.updatedAt })
      .from(users)
      .where(eq(users.id, CLOSED_CUSTOMER));
    expect(after).toEqual(before);
  });
});
