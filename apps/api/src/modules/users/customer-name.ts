import { hasPersonalName } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { nameRequiredError } from '../../lib/errors.js';
import { findUserById } from './users.dao.js';

/**
 * Refuses a customer whose account has no real first and last name (VEN-701).
 *
 * Called by every customer write that projects the name to another user — a
 * booking request, a first message, a review — so a direct call cannot route
 * around the name step. Vendors and admins are never passed in: a vendor's name
 * lives in the profile editor and no vendor flow is gated on it.
 */
export async function requireCustomerName(db: AppDatabase, userId: string): Promise<void> {
  const customer = await findUserById(db, userId);

  if (!customer || !hasPersonalName(customer)) {
    throw nameRequiredError();
  }
}
