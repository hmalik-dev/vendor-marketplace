import { SIGN_UP_ROLES, type SignUpRole } from '@vendor-marketplace/shared';

export { SIGN_UP_ROLES, type SignUpRole };

/**
 * Neon Auth has no sign-up field for the role, so the choice is carried from
 * the sign-up form to the accept-terms screen — through email verification and
 * a sign-in, possibly in another tab — in `localStorage` under this key.
 *
 * **It is the choice made at sign-up, for one address.** The sign-up form tells
 * the person it can't be changed later, so the accept-terms screen states it
 * rather than asking again. It carries the address it was written for and is
 * read only for that address: one browser can hold a sign-up for A while B signs
 * in, and B must never inherit A's role. It can still be absent (another device,
 * blocked storage) or stale, and then the accept-terms screen asks; the server
 * stores the role that screen submits and still enforces the vendor gate.
 *
 * Storage rather than a cookie: the product writes no cookie of its own, and
 * the cookie notice says so (`no-cookie-consent.test.ts`).
 */
export const SIGN_UP_ROLE_KEY = 'signup_role';

/** A choice older than this is stale, not a decision to honour. */
export const SIGN_UP_ROLE_TTL_MS = 24 * 60 * 60 * 1000;

/** Anything that is not one of the two sign-up roles is absent, never trusted. */
export function asSignUpRole(value: unknown): SignUpRole | null {
  return SIGN_UP_ROLES.find((role) => role === value) ?? null;
}

/** Addresses compare case- and whitespace-insensitively, as the identity provider treats them. */
function sameAddress(a: string): string {
  return a.trim().toLowerCase();
}

export function rememberSignUpRole(role: SignUpRole, email: string): void {
  try {
    window.localStorage.setItem(
      SIGN_UP_ROLE_KEY,
      JSON.stringify({ role, email: sameAddress(email), at: Date.now() }),
    );
  } catch {
    // Storage blocked: the accept-terms screen then asks, with nothing selected.
  }
}

/**
 * Reads the role remembered for `email`, validated and expiry-checked on every
 * read. A role written for any other address — or before addresses were
 * recorded — is absent.
 */
export function readSignUpRole(email: string): SignUpRole | null {
  try {
    const raw = window.localStorage.getItem(SIGN_UP_ROLE_KEY);
    const stored =
      raw === null ? null : (JSON.parse(raw) as { role?: unknown; email?: unknown; at?: unknown });

    if (
      !stored ||
      typeof stored.at !== 'number' ||
      Date.now() - stored.at > SIGN_UP_ROLE_TTL_MS ||
      typeof stored.email !== 'string' ||
      sameAddress(stored.email) !== sameAddress(email)
    ) {
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
