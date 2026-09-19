import { and, eq } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { users } from './schema/index.js';

type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>, TablesRelationalConfig>;

/**
 * A second, **disposable** operator for the browser pass that closes one
 * (VEN-391).
 *
 * Closing an operator deletes their Clerk identity, and the seed resolves the
 * persistent E2E admin's identity rather than creating it — so that account must
 * never be the target. The spec mints a throwaway `+clerk_test` identity through
 * Clerk's Backend API and hands its id here, which gives it an operator row.
 *
 * `role = 'admin'` is unreachable from inside the product, which is why this is
 * a database write at all. The address pattern is the fence: nothing here reads
 * or writes a row whose email is not one this helper's caller minted, so no
 * argument can promote or remove a seeded account.
 */
export const DISPOSABLE_OPERATOR_EMAIL = /^e2e-operator-[a-z0-9-]+\+clerk_test@example\.com$/;

function assertDisposable(email: string): void {
  if (!DISPOSABLE_OPERATOR_EMAIL.test(email)) {
    throw new Error(`${email} is not a disposable operator address; refusing to touch it.`);
  }
}

export async function insertDisposableOperator(
  db: Database,
  input: { authUserId: string; email: string },
): Promise<{ userId: string }> {
  assertDisposable(input.email);

  const [row] = await db
    .insert(users)
    .values({
      authUserId: input.authUserId,
      email: input.email,
      role: 'admin',
      firstName: 'Disposable',
      lastName: 'Operator',
    })
    .returning({ id: users.id });

  return { userId: row!.id };
}

/** Removes the row, closed or not. Returns how many rows went — `0` or `1`. */
export async function removeDisposableOperator(
  db: Database,
  input: { authUserId: string; email: string },
): Promise<number> {
  assertDisposable(input.email);

  const removed = await db
    .delete(users)
    .where(and(eq(users.authUserId, input.authUserId), eq(users.email, input.email)))
    .returning({ id: users.id });

  return removed.length;
}
