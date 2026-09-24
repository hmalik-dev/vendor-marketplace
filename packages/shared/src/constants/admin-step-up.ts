/**
 * The controls on an admin's irreversible actions (VEN-500).
 *
 * Neon Auth has no second factor, so a stolen admin session used to be enough
 * to ban every vendor and refund every booking. Two limits stand in the way
 * until provider MFA is ruled on (`vendor-marketplace-decisions.md`, D-admin-2FA):
 * a step-up the session cannot mint alone, and a ceiling on how many accounts
 * one admin can end per hour.
 */

/** How long an emailed step-up code can be entered. */
export const STEP_UP_CODE_TTL_MS = 10 * 60_000;

/** How long a verified step-up authorises irreversible routes, per admin. */
export const STEP_UP_GRANT_TTL_MS = 10 * 60_000;

/** Wrong codes tolerated before the challenge is void and a new one is needed. */
export const STEP_UP_MAX_ATTEMPTS = 5;

/** Digits in the emailed code. */
export const STEP_UP_CODE_LENGTH = 6;

/** Challenges one admin may request per hour, so the mailbox is not a flood target. */
export const STEP_UP_CHALLENGES_PER_HOUR = 6;

/** Bans, account closures and data exports one admin may complete per rolling hour. */
export const ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR = 10;

/** The audit actions that count against {@link ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR}. */
export const ADMIN_CEILING_ACTIONS = [
  'user_banned',
  'user_closed',
  'admin_account_closed',
  'user_data_exported',
  'tax_report_exported',
] as const;
