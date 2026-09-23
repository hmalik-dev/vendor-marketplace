import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNeonAuthDirectory, type NeonAuthDirectory } from './neon-auth-directory.js';

/**
 * The directory against a real Neon Auth branch, not a table this repo drew
 * (VEN-649).
 *
 * `neon-auth-directory.test.ts` proves the SQL against a `neon_auth` schema the
 * suite writes itself, so it cannot notice the one thing that matters here:
 * closure deletes a row in a schema Neon owns and relies on **Neon's** cascades
 * to end the person's sessions and sign-in methods. If Neon drops a cascade, a
 * closed account keeps a live session, and only this suite would say so.
 *
 * Gated like the contention suites: excluded from `pnpm test`, run by
 * `pnpm --filter @vendor-marketplace/db test:neon` with
 * `NEON_AUTH_CONTRACT_DATABASE_URL` naming a **non-production** branch's
 * database. It writes one throwaway identity and removes it.
 */
const url = process.env['NEON_AUTH_CONTRACT_DATABASE_URL'];

if (!url) {
  throw new Error(
    'NEON_AUTH_CONTRACT_DATABASE_URL is required: a non-production Neon branch database that holds neon_auth',
  );
}

describe('closure against a real Neon Auth branch', () => {
  const id = randomUUID();
  const email = `closure-contract-${id}@example.test`;
  let client: postgres.Sql;
  let directory: NeonAuthDirectory;

  beforeAll(async () => {
    client = postgres(url, { max: 1 });
    directory = createNeonAuthDirectory(url);

    await client`insert into neon_auth."user" (id, name, email, "emailVerified")
      values (${id}, 'Closure Contract', ${email}, true)`;
    await client`insert into neon_auth.session ("expiresAt", token, "updatedAt", "userId")
      values (now() + interval '1 hour', ${`contract-${id}`}, now(), ${id})`;
    await client`insert into neon_auth.account ("accountId", "providerId", "updatedAt", "userId")
      values (${id}, 'credential', now(), ${id})`;
  });

  afterAll(async () => {
    // Only if the assertion failed part-way: never leave the identity behind.
    await client`delete from neon_auth."user" where id = ${id}`;
    await directory.close();
    await client.end();
  });

  it('removes the identity with its sessions and accounts, and says it did', async () => {
    expect(await directory.deleteIdentity(id)).toBe(true);

    const [left] = await client<{ users: number; sessions: number; accounts: number }[]>`
      select
        (select count(*)::int from neon_auth."user" where id = ${id}) as users,
        (select count(*)::int from neon_auth.session where "userId" = ${id}) as sessions,
        (select count(*)::int from neon_auth.account where "userId" = ${id}) as accounts`;
    expect(left).toEqual({ users: 0, sessions: 0, accounts: 0 });
  });

  it('answers false for the same identity once it is gone', async () => {
    expect(await directory.deleteIdentity(id)).toBe(false);
  });
});
