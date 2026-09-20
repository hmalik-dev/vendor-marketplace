/**
 * Reads `exp` (as epoch milliseconds) from a JWT payload. Not verified — the
 * API verifies; this only decides when to ask for a new token. A token with no
 * readable `exp` yields `null` and is never cached.
 */
export function tokenExpiryMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}
