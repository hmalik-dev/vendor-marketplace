/**
 * Reads `exp` (as epoch milliseconds) from a JWT payload. Not verified — the
 * API verifies; this only decides when to ask for a new token. A token with no
 * readable `exp` yields `null` and is never cached.
 */
export function tokenExpiryMs(token: string): number | null {
  const exp = tokenClaim(token, 'exp');
  return typeof exp === 'number' ? exp * 1000 : null;
}

/**
 * Reads the `email` claim from a JWT payload, unverified. Only for a token this
 * server just minted from its own session, where it names the signed-in address.
 */
export function tokenEmail(token: string): string | null {
  const email = tokenClaim(token, 'email');
  return typeof email === 'string' && email !== '' ? email : null;
}

function tokenClaim(token: string, name: string): unknown {
  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }

  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as Record<string, unknown>)[name];
  } catch {
    return undefined;
  }
}
