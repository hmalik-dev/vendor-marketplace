import { users } from '@vendor-marketplace/db/schema';
import { sql, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

type UserRole = (typeof users.$inferSelect)['role'];

/**
 * Sets a fixture account's role the way the database now demands.
 *
 * `users.role` changes only inside a transaction that sets the admin-grant
 * setting (VEN-533), and no sign-in produces an admin, so a suite that needs
 * one has to take that path. It is a test helper on purpose: it stands in for
 * the admin grant (VEN-506) and nothing outside a test may call it.
 */
export async function setUserRole(
  db: PgDatabase<PgQueryResultHKT, Record<string, unknown>>,
  role: UserRole,
  where: SQL | undefined,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.operator_role_grant = 'on'`);
    await tx.update(users).set({ role }).where(where);
  });
}
