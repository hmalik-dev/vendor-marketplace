import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { insertDisposableOperator, removeDisposableOperator } from './e2e-operator.js';
import { users } from './schema/index.js';
import { createTestDatabase, type TestDatabase } from './testing/test-db.js';

const OPERATOR = {
  clerkUserId: 'user_disposable_operator',
  email: 'e2e-operator-1757000000000-42+clerk_test@example.com',
};

describe('the disposable E2E operator', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
  });

  afterAll(async () => {
    await database?.close();
  });

  it('mints an operator row and removes it again', async () => {
    const { userId } = await insertDisposableOperator(database.db, OPERATOR);

    const [row] = await database.db
      .select({ role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    expect(row).toEqual({ role: 'admin', email: OPERATOR.email });

    expect(await removeDisposableOperator(database.db, OPERATOR)).toBe(1);
    expect(await database.db.select({ id: users.id }).from(users)).toEqual([]);
  });

  it.each([
    'admin+clerk_test@example.com',
    'e2e-operator-1+clerk_test@example.com.evil',
    'E2E-OPERATOR-1+clerk_test@example.com',
  ])('refuses to touch %s, which it did not mint', async (email) => {
    await expect(insertDisposableOperator(database.db, { ...OPERATOR, email })).rejects.toThrow(
      'is not a disposable operator address',
    );
    await expect(removeDisposableOperator(database.db, { ...OPERATOR, email })).rejects.toThrow(
      'is not a disposable operator address',
    );
  });
});
