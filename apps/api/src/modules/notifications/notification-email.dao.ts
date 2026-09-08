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
 *
 * **This column can be known-stale, and today that changes nothing here**
 * (#462). When Clerk sends an address `users_email_key` refuses,
 * `updateUserByClerkId` records it in `pending_email` and leaves `email` at the
 * old value, so a row can be flagged as disagreeing with the identity provider
 * while this read still returns the old address — and these messages carry
 * counterparty detail: names, event dates, booking specifics.
 *
 * Holding, redirecting or continuing is a product ruling and has not been made,
 * so nothing here reads `pending_email`: continuing to send is the behaviour
 * that was already in place, and quietly changing it would be this lane
 * choosing the answer. `/admin/customers?flag=email-stale` is what tells an
 * operator which accounts are in that state meanwhile. Once the ruling exists,
 * this function is where it goes.
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
