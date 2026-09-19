import { describe, expect, it, vi } from 'vitest';
import { defaultLastName, resolveNeonAccount } from './e2e-neon-account.js';

const BASE = 'https://ep-x.neonauth.example.invalid/neondb/auth';

const input = {
  baseUrl: BASE,
  origin: 'http://localhost:3000',
  email: 'e2e-customer@example.invalid',
  password: 'not-a-real-password',
  role: 'customer',
};

function answer(status: number, body: unknown): typeof fetch {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

describe('resolveNeonAccount', () => {
  it('signs in at the branch endpoint and returns the id Neon holds', async () => {
    const fetchImpl = answer(200, {
      user: { id: 'neon-id-1', email: 'e2e-customer@example.invalid', name: 'Ada Lovelace' },
    });

    const account = await resolveNeonAccount(input, fetchImpl);

    expect(account).toEqual({
      authUserId: 'neon-id-1',
      email: 'e2e-customer@example.invalid',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${BASE}/sign-in/email`);
    expect(init.headers).toMatchObject({ origin: 'http://localhost:3000' });
    expect(JSON.parse(init.body as string)).toEqual({
      email: input.email,
      password: input.password,
    });
  });

  it('falls back to a role surname when the profile has one name only', async () => {
    const account = await resolveNeonAccount(
      { ...input, role: 'vendor' },
      answer(200, { user: { id: 'neon-id-2', name: 'Studio' } }),
    );

    expect(account).toMatchObject({ firstName: 'Studio', lastName: 'Vendor', email: input.email });
  });

  it('names the role and the status when Neon refuses, without echoing the password', async () => {
    const failure = resolveNeonAccount(input, answer(403, { code: 'EMAIL_NOT_VERIFIED' }));

    await expect(failure).rejects.toThrow(/customer account \(403\)/);
    await expect(failure).rejects.not.toThrow(/not-a-real-password/);
  });

  it('refuses an answer that carries no user id', async () => {
    await expect(resolveNeonAccount(input, answer(200, { user: {} }))).rejects.toThrow(
      /without a user id/,
    );
  });
});

describe('defaultLastName', () => {
  it('maps each role to its fixture surname', () => {
    expect(['customer', 'vendor', 'admin'].map(defaultLastName)).toEqual([
      'Customer',
      'Vendor',
      'Admin',
    ]);
  });
});
