import { users } from '@vendor-marketplace/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '../../lib/database.js';

/**
 * The address a notification is emailed to.
 *
 * `deletedAt is null` is the guard the ticket's edge case asks for: a user
 * removed between the event and the send has no inbox to reach, and the in-app
 * row is already durable. Returning `null` rather than throwing is what lets
 * the caller skip quietly instead of failing an operation that has committed.
 */
export async function findUserEmail(
  db: AppDatabase,
  userId: string,
): Promise<{ email: string } | null> {
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return row ?? null;
}
