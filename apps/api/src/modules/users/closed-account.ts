import type { NewUserRow, UserRow } from '@vendor-marketplace/db/schema';

/**
 * What a closed account's row says about the person once they have gone
 * (VEN-614).
 *
 * The row itself stays: bookings, payouts, reviews, messages and legal
 * acceptances hold foreign keys to it, and tax and dispute obligations keep
 * those for seven years. Everything on it that identifies the person does not.
 *
 * The address becomes `closed+<id>@invalid`: unique per row, and RFC 2606's
 * `.invalid` can never deliver, so a stray notification cannot reach anyone.
 * The name becomes "Former customer" (or vendor, or operator), which is what
 * every surface that prints a counterparty's full name then shows, messages
 * included, as ruled on the ticket.
 */
export function closedAccountFields(
  user: Pick<UserRow, 'id' | 'role'>,
): Pick<
  NewUserRow,
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'avatarUrl'
  | 'bio'
  | 'city'
  | 'state'
  | 'pendingEmail'
  | 'emailSyncFailedAt'
> {
  return {
    email: `closed+${user.id}@invalid`,
    firstName: 'Former',
    lastName: user.role === 'admin' ? 'operator' : user.role,
    phone: null,
    avatarUrl: null,
    bio: null,
    city: null,
    state: null,
    pendingEmail: null,
    emailSyncFailedAt: null,
  };
}

/**
 * A closed reviewer on a vendor's public reviews. Spelled out rather than
 * abbreviated from the row, which would print "Former c.".
 */
export const CLOSED_REVIEWER_NAME = 'Former customer';
