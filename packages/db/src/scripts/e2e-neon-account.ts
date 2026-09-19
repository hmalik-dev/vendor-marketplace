import type { E2eAccount } from '../seed-e2e.js';

/**
 * Resolves an end-to-end account's **real** Neon Auth id by signing in as it.
 *
 * The id cannot be invented: a `users` row carrying this email under a made-up
 * id makes the account's first real sign-in
 * collide on the email unique index, so it could never sign in again.
 * Neon Auth has no user-list route (VEN-444), and the identities live on the
 * Neon dev branch rather than on the lane's Docker database, so the one source
 * that answers from any machine is the sign-in itself, which returns the user
 * it authenticated.
 *
 * `fetch` is injected so the suite never reaches the network.
 */
export async function resolveNeonAccount(
  input: { baseUrl: string; origin: string; email: string; password: string; role: string },
  fetchImpl: typeof fetch = fetch,
): Promise<E2eAccount> {
  const response = await fetchImpl(`${input.baseUrl.replace(/\/+$/, '')}/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: input.origin },
    body: JSON.stringify({ email: input.email, password: input.password }),
  });

  if (!response.ok) {
    throw new Error(
      `Neon Auth refused the sign-in for the ${input.role} account (${response.status}). ` +
        'Check NEON_AUTH_BASE_URL points at the branch the account lives on, that the address ' +
        'is verified, and that the E2E password in .env.e2e.local is current.',
    );
  }

  const body = (await response.json()) as {
    user?: { id?: string; email?: string; name?: string | null };
  };
  const user = body.user;

  if (!user?.id) {
    throw new Error(`Neon Auth answered the ${input.role} sign-in without a user id.`);
  }

  const [firstName = '', ...rest] = (user.name ?? '').trim().split(/\s+/);

  return {
    authUserId: user.id,
    email: user.email ?? input.email,
    firstName: firstName || 'E2E',
    lastName: rest.join(' ') || defaultLastName(input.role),
  };
}

/** The surname a profile with no last name falls back to, by role. */
export function defaultLastName(role: string): string {
  if (role === 'vendor') {
    return 'Vendor';
  }

  return role === 'admin' ? 'Admin' : 'Customer';
}
