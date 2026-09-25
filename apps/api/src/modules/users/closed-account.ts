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
 * The name becomes "Former customer" (or vendor, or admin), whole in the
 * first name with an empty surname: surfaces that print a first name and an
 * initial (messages, a vendor's request row) would otherwise read "Former c",
 * and an empty surname is what each of them already renders as no initial.
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
    firstName: `Former ${user.role}`,
    lastName: '',
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
 * A closed reviewer on a vendor's public reviews, keyed off `deleted_at` rather
 * than read from the row, so an account closed before the row was anonymised
 * is not shown under its old name.
 */
export const CLOSED_REVIEWER_NAME = 'Former customer';
