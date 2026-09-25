import { sql } from 'drizzle-orm';
import { check, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums.js';

/**
 * The role a person chose on `/sign-up`, held until their first acceptance of
 * the Terms creates the account (VEN-662).
 *
 * Neon Auth refuses a `role` on `sign-up/email` (`FIELD_NOT_ALLOWED`, it is the
 * admin plugin's own field) and drops any other custom field, so the choice
 * cannot ride on the identity. The web tier's auth proxy records it here, keyed
 * by the id the provider's sign-up answer names, and `acceptTerms` consumes it.
 *
 * Keyed by the provider's id and never by an address: an address-keyed row
 * would let anyone pre-seed a role for an address they do not own. It holds
 * nothing else about the person — no email, no name, no IP.
 *
 * `verified_at` is set when the identity that chose the role proves the
 * address with its sign-up code (VEN-756). Only an unverified row is forgotten
 * by a password reset (VEN-663): a squatter never holds the code, so a row the
 * address verified was chosen by whoever reads that inbox.
 *
 * Rows past `expires_at` read as absent and are deleted as the next one is
 * written; there is no sweep.
 */
export const signUpRoles = pgTable(
  'sign_up_roles',
  {
    authUserId: varchar('auth_user_id', { length: 255 }).primaryKey(),
    role: userRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (table) => [
    // `admin` is granted by an admin, never chosen at sign-up.
    check('sign_up_roles_role_is_a_sign_up_role', sql`${table.role} IN ('customer', 'vendor')`),
  ],
).enableRLS();
