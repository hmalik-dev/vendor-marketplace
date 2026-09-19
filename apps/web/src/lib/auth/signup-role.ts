import type { UserRole } from '@vendor-marketplace/shared';

/** The two roles a person can choose at sign-up. `admin` is never one of them. */
export type SignUpRole = Extract<UserRole, 'customer' | 'vendor'>;

export const SIGN_UP_ROLES: readonly SignUpRole[] = ['customer', 'vendor'];

/**
 * Neon Auth has no sign-up field for the role, so the choice is carried from
 * the sign-up form to the accept-terms screen — through email verification and
 * a sign-in, possibly in another tab — in `localStorage` under this key. The
 * API receives it on `POST /legal/terms/accept` and narrows it again.
 *
 * Storage rather than a cookie: the product writes no cookie of its own, and
 * the cookie notice says so (`no-cookie-consent.test.ts`). The value is a
 * hint and never leaves the browser except on that one request.
 */
export const SIGN_UP_ROLE_KEY = 'signup_role';

/** A choice older than this is stale, not a decision to honour. */
export const SIGN_UP_ROLE_TTL_MS = 24 * 60 * 60 * 1000;

/** Anything that is not one of the two sign-up roles is absent, never trusted. */
export function asSignUpRole(value: unknown): SignUpRole | null {
  return SIGN_UP_ROLES.find((role) => role === value) ?? null;
}

export function rememberSignUpRole(role: SignUpRole): void {
  try {
    window.localStorage.setItem(SIGN_UP_ROLE_KEY, JSON.stringify({ role, at: Date.now() }));
  } catch {
    // Storage blocked: the API narrows a missing role to `customer`.
  }
}

/** Reads the remembered role, validated and expiry-checked on every read. */
export function readSignUpRole(): SignUpRole | null {
  try {
    const raw = window.localStorage.getItem(SIGN_UP_ROLE_KEY);
    const stored = raw === null ? null : (JSON.parse(raw) as { role?: unknown; at?: unknown });

    if (!stored || typeof stored.at !== 'number' || Date.now() - stored.at > SIGN_UP_ROLE_TTL_MS) {
      return null;
    }

    return asSignUpRole(stored.role);
  } catch {
    return null;
  }
}

export function clearSignUpRole(): void {
  try {
    window.localStorage.removeItem(SIGN_UP_ROLE_KEY);
  } catch {
    // Nothing to clear.
  }
}
