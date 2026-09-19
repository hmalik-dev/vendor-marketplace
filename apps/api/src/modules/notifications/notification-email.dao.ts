import { users } from '@vendor-marketplace/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '../../lib/database.js';

/**
 * The address stored for a live account, for mail about the person's **own**
 * action — the support and report acknowledgements.
 *
 * `deletedAt is null` is the guard: a user removed between the event and the
 * send has no inbox to reach. Returning `null` rather than throwing is what
 * lets the caller decide.
 *
 * It deliberately ignores `pending_email`. An acknowledgement carries nothing
 * about anyone else, and it answers a request the person made seconds ago, so
 * the stored address is the right one to answer even mid-repair. Notifications
 * read `findNotificationRecipient` instead, so neither can pick up the other's
 * rule by accident.
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

/**
 * Where a notification is emailed, or why it is not (VEN-386).
 *
 * **A diverged row gets no email.** `pending_email` set means the auth provider has given
 * this account a different address and `users_email_key` refused it (#462) —
 * so `email` is an address the person has moved off, and a notification
 * carries counterparty detail: names, event dates, booking specifics. The
 * collision means another row is stale, the auth webhook repairs it
 * (`auth-sync.service.ts`), and the window is one webhook hop; the in-app row is
 * already durable and carries the content, so nothing is queued for later.
 *
 * `null` for an account that is gone, as `findUserEmail`.
 */
export async function findNotificationRecipient(
  db: AppDatabase,
  userId: string,
): Promise<{ email: string } | { emailDiverged: true } | null> {
  const [row] = await db
    .select({ email: users.email, pendingEmail: users.pendingEmail })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  return row.pendingEmail === null ? { email: row.email } : { emailDiverged: true };
}
