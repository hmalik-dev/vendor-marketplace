import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { insertDisposableAdmin, removeDisposableAdmin } from './e2e-admin.js';
import { users } from './schema/index.js';
import { createTestDatabase, type TestDatabase } from './testing/test-db.js';

const ADMIN = {
  authUserId: 'user_disposable_admin',
  email: 'e2e-admin-1757000000000-42+auth_test@example.com',
};

describe('the disposable E2E admin', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
  });

  afterAll(async () => {
    await database?.close();
  });

  it('mints an admin row and removes it again', async () => {
    const { userId } = await insertDisposableAdmin(database.db, ADMIN);

    const [row] = await database.db
      .select({ role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    expect(row).toEqual({ role: 'admin', email: ADMIN.email });

    expect(await removeDisposableAdmin(database.db, ADMIN)).toBe(1);
    expect(await database.db.select({ id: users.id }).from(users)).toEqual([]);
  });

  it.each([
    'admin+auth_test@example.com',
    'e2e-admin-1+auth_test@example.com.evil',
    'E2E-ADMIN-1+auth_test@example.com',
  ])('refuses to touch %s, which it did not mint', async (email) => {
    await expect(insertDisposableAdmin(database.db, { ...ADMIN, email })).rejects.toThrow(
      'is not a disposable admin address',
    );
    await expect(removeDisposableAdmin(database.db, { ...ADMIN, email })).rejects.toThrow(
      'is not a disposable admin address',
    );
  });
});
