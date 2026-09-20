import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOT_GUARDS, bootEnv, runBootGuards } from './boot.js';

const GUARD = 'live Stripe key requires https origins';

/** Assembled at runtime so no literal here reads as a real credential. */
function fake(...parts: string[]): string {
  return parts.join('_');
}

function databaseUrl(): string {
  return `postgresql://${fake('app', 'user')}:${fake('app', 'pass', 'filler')}@ep-x.us-east-2.aws.neon.tech/db`;
}

/** Credential-bearing rows, kept as pairs built at runtime rather than literals. */
const CREDENTIAL_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['STRIPE_SECRET_KEY', fake('sk', 'live', 'FAKEabcdefghijklmn9003')],
  ['STRIPE_WEBHOOK_SECRET', fake('whsec', 'MfKQ9r8sTuVwXyZ0123456789')],
  ['STRIPE_CONNECT_WEBHOOK_SECRET', fake('whsec', 'MfKQ9r8sTuVwXyZ0123456789')],
  ['RESEND_API_KEY', fake('re', 'FAKEabcdefghijklmnop9005')],
  ['RESEND_WEBHOOK_SECRET', fake('whsec', 'PqRsTuVwXyZ0123456789AbCdE')],
  ['WEB_TIER_KEY', fake('tier', 'key', 'filler', 'abcdefghijklmnopqrstuvwx')],
  ['DATABASE_URL', databaseUrl()],
  ['NEON_AUTH_DATABASE_URL', databaseUrl()],
  ['STORAGE_ACCESS_KEY_ID', fake('access', 'id', 'filler')],
  ['STORAGE_SECRET_ACCESS_KEY', fake('access', 'material', 'filler')],
];

const DEPLOYED: Record<string, string> = {
  NODE_ENV: 'production',
  DEPLOY_ENV: 'production',
  NEON_AUTH_BASE_URL: 'https://ep-x.neonauth.example.invalid/neondb/auth',
  EMAIL_FROM: 'Orla <noreply@orla.example.invalid>',
  STORAGE_ENDPOINT: 'https://br-x.storage.c-4.us-east-2.aws.neon.tech',
  STORAGE_REGION: 'us-east-2',
  STORAGE_BUCKET: 'orla-uploads',
  STORAGE_PUBLIC_URL: 'https://cdn.orla.example.invalid',
  OPERATOR_ALERT_EMAIL: 'ops@orla.example.invalid',
  SUPPORT_EMAIL_TO: 'help@orla.example.invalid',
  SENTRY_DSN: 'https://abc123@o1.ingest.sentry.io/42',
  WEB_URL: 'http://orla.example.invalid',
  API_URL: 'https://api.orla.example.invalid',
};

function stubDeployed(overrides: Record<string, string> = {}): void {
  const rows = { ...DEPLOYED, ...Object.fromEntries(CREDENTIAL_ROWS), ...overrides };
  for (const [key, value] of Object.entries(rows)) {
    vi.stubEnv(key, value);
  }
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('the boot guard list', () => {
  it('refuses a live Stripe key beside a plain-HTTP origin', () => {
    stubDeployed();

    expect(() => bootEnv()).toThrow(
      `${GUARD}: STRIPE_SECRET_KEY is live but http://orla.example.invalid is not https`,
    );
  });

  it('accepts the same deployment once every origin is https', () => {
    stubDeployed({ WEB_URL: 'https://orla.example.invalid' });

    expect(bootEnv().WEB_URL).toBe('https://orla.example.invalid');
  });

  it('runs every guard and reports each refusal', () => {
    expect(BOOT_GUARDS.map((guard) => guard.name)).toEqual([
      'Stripe key has a recognised mode',
      GUARD,
      'live Stripe key requires DEPLOY_ENV=production',
      'a hosted platform cannot declare DEPLOY_ENV=local',
      'staging requires an email sink',
    ]);
    expect(() =>
      runBootGuards({} as never, {}, [
        { name: 'a', check: () => 'no' },
        { name: 'b', check: () => null },
        { name: 'c', check: () => 'nope' },
      ]),
    ).toThrow('API refused to start:\n  a: no\n  c: nope');
  });
});

describe('the DEPLOY_ENV guards', () => {
  const HTTPS = { WEB_URL: 'https://orla.example.invalid' };
  const TEST_KEY = fake('sk', 'test', 'FAKEabcdefghijklmn9004');

  it.each(['staging', 'local'])('refuses a live Stripe key with DEPLOY_ENV=%s', (tier) => {
    stubDeployed({ ...HTTPS, DEPLOY_ENV: tier, EMAIL_SINK_ADDRESS: 'sink@orla.example.invalid' });

    expect(() => bootEnv()).toThrow(
      `live Stripe key requires DEPLOY_ENV=production: STRIPE_SECRET_KEY is live-mode but DEPLOY_ENV is ${tier}; only production may hold a live key`,
    );
  });

  it('refuses staging without EMAIL_SINK_ADDRESS', () => {
    stubDeployed({ ...HTTPS, DEPLOY_ENV: 'staging', STRIPE_SECRET_KEY: TEST_KEY });

    expect(() => bootEnv()).toThrow(
      'staging requires an email sink: DEPLOY_ENV is staging but EMAIL_SINK_ADDRESS is not set',
    );
  });

  it('refuses a deployed runtime that never declared its tier, naming DEPLOY_ENV', () => {
    stubDeployed({ ...HTTPS });
    const { DEPLOY_ENV: _tier, ...source } = process.env;

    expect(() => bootEnv(source)).toThrow(/DEPLOY_ENV is required on a deployment/);
  });

  it('refuses a hosted platform that declares DEPLOY_ENV=local, but not a local container', () => {
    stubDeployed({ ...HTTPS, DEPLOY_ENV: 'local', STRIPE_SECRET_KEY: TEST_KEY });
    expect(() => bootEnv()).not.toThrow();

    vi.stubEnv('RENDER', 'true');
    expect(() => bootEnv()).toThrow(
      'a hosted platform cannot declare DEPLOY_ENV=local: this process runs on a hosting platform but DEPLOY_ENV is local',
    );
  });

  it('boots production on a test-mode key, which the friends beta runs on', () => {
    stubDeployed({ ...HTTPS, STRIPE_SECRET_KEY: TEST_KEY });

    expect(bootEnv().DEPLOY_ENV).toBe('production');
  });

  it('boots staging with a sink and a test-mode key', () => {
    stubDeployed({
      ...HTTPS,
      DEPLOY_ENV: 'staging',
      EMAIL_SINK_ADDRESS: 'sink@orla.example.invalid',
      STRIPE_SECRET_KEY: TEST_KEY,
    });

    expect(bootEnv().EMAIL_SINK_ADDRESS).toBe('sink@orla.example.invalid');
  });
});

describe('the Stripe key mode guard', () => {
  const guard = BOOT_GUARDS.find((entry) => entry.name === 'Stripe key has a recognised mode')!;
  const secret = 'FAKEabcdefghijklmn9004';
  const withKey = (key: string) => ({ STRIPE_SECRET_KEY: key }) as never;

  it.each([
    ['sk', 'live'],
    ['sk', 'test'],
    ['rk', 'live'],
    ['rk', 'test'],
  ])('accepts a %s_%s_ key', (kind, mode) => {
    expect(guard.check(withKey(fake(kind, mode, secret)), {})).toBeNull();
  });

  it('refuses a key of no recognised mode, naming its prefix and not the rest', () => {
    const reason = guard.check(withKey(fake('pk', 'live', secret)), {});

    expect(reason).toBe(
      'STRIPE_SECRET_KEY starts "pk_live_", not sk_live_, sk_test_, rk_live_ or rk_test_',
    );
    expect(reason).not.toContain(secret);
  });

  it('refuses to start, through the guard runner, on a key of no recognised mode', () => {
    expect(() => runBootGuards(withKey(fake('pk', 'live', secret)), {})).toThrow(
      /Stripe key has a recognised mode: STRIPE_SECRET_KEY starts "pk_live_"/,
    );
  });
});

describe('both entry points run the same guards', () => {
  it('stops the serverless handler', async () => {
    stubDeployed();
    const { default: handler } = await import('../server.js');

    await expect(handler({} as never, {} as never)).rejects.toThrow(GUARD);
  });

  it('stops the container entrypoint before it binds a port', async () => {
    stubDeployed();
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await import('../index.js');
    await vi.waitFor(() => expect(process.exitCode).toBe(1));

    expect(write).toHaveBeenCalledWith(expect.stringContaining(GUARD));
  });
});
