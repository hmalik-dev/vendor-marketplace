import { exportJWK, generateKeyPair, createLocalJWKSet, SignJWT, type JWTPayload } from 'jose';
import {
  legalAcceptances,
  platformSettings,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { CURRENT_TERMS_VERSION } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { forgetPlatformSwitches } from '../modules/platform-settings/platform-settings.service.js';
import { createTestHarness, type TestHarness } from '../testing/test-server.js';
import {
  createNeonTokenVerifier,
  createNeonUserLoader,
  extractBearerToken,
  tokenOrigin,
} from './neon-auth.js';

describe('extractBearerToken', () => {
  it('reads the token out of a well-formed header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('trims surrounding whitespace', () => {
    expect(extractBearerToken('Bearer  abc.def.ghi  ')).toBe('abc.def.ghi');
  });

  it('returns null when the header is absent', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for a non-bearer scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('is case-sensitive about the scheme', () => {
    expect(extractBearerToken('bearer abc')).toBeNull();
  });

  it('returns null when the scheme carries no token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken('Bearer    ')).toBeNull();
  });
});

const BASE_URL = 'https://ep-test.neonauth.example.invalid/neondb/auth';
const ORIGIN = 'https://ep-test.neonauth.example.invalid';
const KID = 'test-key';

describe('the Neon Auth trust boundary', () => {
  let harness: TestHarness;
  let jwks: ReturnType<typeof createLocalJWKSet>;
  let sign: (
    claims: JWTPayload,
    options?: { expiresIn?: string | number; key?: Parameters<SignJWT['sign']>[0] },
  ) => Promise<string>;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('EdDSA', { extractable: true });
    jwks = createLocalJWKSet({
      keys: [{ ...(await exportJWK(publicKey)), kid: KID, alg: 'EdDSA' }],
    });

    sign = (claims, options = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'EdDSA', kid: KID })
        .setIssuedAt()
        .setIssuer(ORIGIN)
        .setAudience(ORIGIN)
        .setExpirationTime(options.expiresIn ?? '15m')
        .sign(options.key ?? privateKey);

    harness = await createTestHarness({
      acceptTerms: false,
      neonAuth: {
        verifySessionToken: createNeonTokenVerifier(BASE_URL, jwks),
        loadAuthUser: createNeonUserLoader(BASE_URL, jwks),
      },
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  const claims = (over: JWTPayload = {}): JWTPayload => ({
    sub: 'neon-user-1',
    email: 'ada@example.com',
    emailVerified: true,
    name: 'Ada Lovelace',
    role: 'authenticated',
    ...over,
  });

  const get = (url: string, token?: string) =>
    harness.app.inject({
      method: 'GET',
      url,
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
    });

  it('takes the token origin, not the auth path, as issuer and audience', () => {
    expect(tokenOrigin(BASE_URL)).toBe(ORIGIN);
  });

  it('answers 401 to a request with no token', async () => {
    expect((await get('/users/me')).statusCode).toBe(401);
  });

  it('answers 401 to a token signed by a key the JWKS does not hold', async () => {
    const stranger = await generateKeyPair('EdDSA');
    const forged = await sign(claims(), { key: stranger.privateKey });

    expect((await get('/users/me', forged)).statusCode).toBe(401);
  });

  it('answers 401 to an expired token', async () => {
    const expired = await sign(claims(), { expiresIn: Math.floor(Date.now() / 1000) - 60 });

    expect((await get('/users/me', expired)).statusCode).toBe(401);
  });

  it('logs why an expired token was refused, and none of the claims it carried', async () => {
    const lines: string[] = [];
    const logged = await createTestHarness({
      env: { LOG_LEVEL: 'info' },
      loggerStream: {
        write: (chunk: string) => void lines.push(chunk),
      } as unknown as NodeJS.WritableStream,
      neonAuth: {
        verifySessionToken: createNeonTokenVerifier(BASE_URL, jwks),
        loadAuthUser: createNeonUserLoader(BASE_URL, jwks),
      },
    });

    try {
      const expired = await sign(claims({ email: 'leaky@example.com', name: 'Leaky Person' }), {
        expiresIn: Math.floor(Date.now() / 1000) - 60,
      });
      const response = await logged.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${expired}` },
      });
      const output = lines.join('');

      expect(response.statusCode).toBe(401);
      expect(output).toContain('Rejected an unverifiable session token');
      expect(output).toContain('JWTExpired');
      expect(output).not.toContain('leaky@example.com');
      expect(output).not.toContain('Leaky Person');
    } finally {
      await logged.close();
    }
  });

  it('answers 401 to a token for another issuer', async () => {
    const other = await new SignJWT(claims())
      .setProtectedHeader({ alg: 'EdDSA', kid: KID })
      .setIssuer('https://elsewhere.example.invalid')
      .setAudience(ORIGIN)
      .setExpirationTime('15m')
      .sign((await generateKeyPair('EdDSA')).privateKey);

    expect((await get('/users/me', other)).statusCode).toBe(401);
  });

  it('answers 401 to a token whose address is not verified', async () => {
    const unverified = await sign(claims({ emailVerified: false }));

    expect((await get('/users/me', unverified)).statusCode).toBe(401);
  });

  it('accepts a valid token, and reads the subject the users row is keyed by', async () => {
    const token = await sign(claims());

    const status = await get('/legal/terms', token);

    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ accepted: false, current: CURRENT_TERMS_VERSION });
  });

  it('gates a valid session with no users row on every account route, and writes nothing', async () => {
    // The role claim a Neon token carries is always `authenticated`; forging a
    // richer one changes nothing because the API never reads it.
    const token = await sign(claims({ sub: 'neon-user-norow', role: 'admin', roleHint: 'admin' }));

    for (const url of ['/users/me', '/vendor/profile', '/vendor/agreement', '/admin/vendors']) {
      const response = await get(url, token);
      expect([401, 403], url).toContain(response.statusCode);
      expect(response.statusCode, url).not.toBe(200);
    }

    const db = harness.database.db;
    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(vendorProfiles)).toHaveLength(0);
    expect(await db.select().from(legalAcceptances)).toHaveLength(0);
  });

  it('creates the account only through the acceptance gate, from the token claims', async () => {
    const token = await sign(
      claims({
        sub: 'neon-user-accepts',
        email: 'grace@example.com',
        name: 'Grace Brewster Hopper',
      }),
    );

    const accepted = await harness.app.inject({
      method: 'POST',
      url: '/legal/terms/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: { version: CURRENT_TERMS_VERSION, accepted: true },
    });

    expect(accepted.statusCode).toBe(200);
    const rows = await harness.database.db.select().from(users);
    const row = rows.find((candidate) => candidate.authUserId === 'neon-user-accepts');
    expect(row).toMatchObject({
      email: 'grace@example.com',
      firstName: 'Grace',
      lastName: 'Brewster Hopper',
      role: 'customer',
    });
    expect((await get('/users/me', token)).statusCode).toBe(200);
  });

  it('refuses a vendor sign-up with no invite and creates no account', async () => {
    await harness.database.db
      .insert(platformSettings)
      .values({ vendorInviteOnly: true })
      .onConflictDoUpdate({ target: platformSettings.id, set: { vendorInviteOnly: true } });
    forgetPlatformSwitches(harness.database.db);
    const token = await sign(claims({ sub: 'neon-user-vendor', email: 'uninvited@example.com' }));

    const accepted = await harness.app.inject({
      method: 'POST',
      url: '/legal/terms/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: { version: CURRENT_TERMS_VERSION, accepted: true, role: 'vendor' },
    });

    expect(accepted.statusCode).toBeGreaterThanOrEqual(400);
    const rows = await harness.database.db.select().from(users);
    expect(rows.find((candidate) => candidate.authUserId === 'neon-user-vendor')).toBeUndefined();
  });
});
