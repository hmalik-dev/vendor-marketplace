import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callerAddress,
  chargeAddress,
  chargeCaller,
  isAddressThrottled,
  isThrottled,
  resetThrottle,
} from './proxy-throttle';

const VERIFY = ['email-otp', 'verify-email'];

describe('isThrottled', () => {
  beforeEach(resetThrottle);

  it('lets ten code guesses a minute through and refuses the eleventh', () => {
    const results = Array.from({ length: 11 }, () => isThrottled('1.2.3.4', VERIFY, 1_000));

    expect(results.slice(0, 10)).toEqual(Array(10).fill(false));
    expect(results[10]).toBe(true);
  });

  it('budgets each caller separately', () => {
    for (let i = 0; i < 11; i++) isThrottled('1.2.3.4', VERIFY, 1_000);

    expect(isThrottled('5.6.7.8', VERIFY, 1_000)).toBe(false);
  });

  it('forgives a caller once the minute has passed', () => {
    for (let i = 0; i < 11; i++) isThrottled('1.2.3.4', VERIFY, 1_000);

    expect(isThrottled('1.2.3.4', VERIFY, 61_001)).toBe(false);
  });

  it('gives the untargeted calls a looser budget of sixty', () => {
    const results = Array.from({ length: 61 }, () =>
      isThrottled('1.2.3.4', ['get-session'], 1_000),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results[60]).toBe(true);
  });
});

describe('callerAddress', () => {
  beforeEach(resetThrottle);

  it('takes the last hop of x-forwarded-for, the one a proxy appended', () => {
    expect(callerAddress(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('10.0.0.1');
  });

  it('does not reset the budget when only the leftmost entry changes', () => {
    const results = Array.from({ length: 11 }, (_, i) =>
      isThrottled(
        callerAddress(new Headers({ 'x-forwarded-for': `6.6.6.${i}, 203.0.113.7` })),
        VERIFY,
        1_000,
      ),
    );

    expect(results.slice(0, 10)).toEqual(Array(10).fill(false));
    expect(results[10]).toBe(true);
  });

  it('falls back to one shared bucket when the header is absent', () => {
    expect(callerAddress(new Headers())).toBe('unknown');
  });
});

describe('reset calls', () => {
  beforeEach(resetThrottle);

  it.each(['request-password-reset', 'reset-password'])(
    'gives email-otp/%s the tight per-caller budget of ten',
    (name) => {
      const results = Array.from({ length: 11 }, () =>
        isThrottled('1.2.3.4', ['email-otp', name], 1_000),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(results[10]).toBe(true);
    },
  );
});

describe('isAddressThrottled', () => {
  beforeEach(resetThrottle);

  const REQUEST = ['email-otp', 'request-password-reset'];

  it('lets five calls for one address through in ten minutes and refuses the sixth', () => {
    const results = Array.from({ length: 6 }, () => isAddressThrottled('a@x.test', REQUEST, 1_000));

    expect(results).toEqual([false, false, false, false, false, true]);
  });

  it('treats case and padding as the same address', () => {
    for (let i = 0; i < 5; i++) isAddressThrottled('a@x.test', REQUEST, 1_000);

    expect(isAddressThrottled('  A@X.test ', REQUEST, 1_000)).toBe(true);
  });

  it('budgets each address and each call separately', () => {
    for (let i = 0; i < 6; i++) isAddressThrottled('a@x.test', REQUEST, 1_000);

    expect(isAddressThrottled('b@x.test', REQUEST, 1_000)).toBe(false);
    expect(isAddressThrottled('a@x.test', ['email-otp', 'reset-password'], 1_000)).toBe(false);
  });

  it('forgives an address once ten minutes have passed', () => {
    for (let i = 0; i < 6; i++) isAddressThrottled('a@x.test', REQUEST, 1_000);

    expect(isAddressThrottled('a@x.test', REQUEST, 601_001)).toBe(false);
  });
});

/** A stand-in for the API's `/internal/throttle`: one shared count per bucket, whoever asks. */
function fakeSharedCounter(): {
  calls: Array<{ bucket: string; limit: number }>;
  headers: string[];
} {
  const counts = new Map<string, number>();
  const seen = { calls: [] as Array<{ bucket: string; limit: number }>, headers: [] as string[] };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const { bucket, limit } = JSON.parse(String(init.body)) as { bucket: string; limit: number };
      const count = (counts.get(bucket) ?? 0) + 1;
      counts.set(bucket, count);
      seen.calls.push({ bucket, limit });
      seen.headers.push(String((init.headers as Record<string, string>)['x-web-tier-key']));

      return Response.json({ throttled: count > limit });
    }),
  );

  return seen;
}

describe('the shared counter', () => {
  beforeEach(() => {
    resetThrottle();
    vi.stubEnv('WEB_TIER_KEY', 'k'.repeat(40));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('refuses the tenth sign-in for one email across two addresses, and past a fresh module instance', async () => {
    fakeSharedCounter();
    const path = ['sign-in', 'email'];

    for (let i = 0; i < 9; i++) {
      expect(await chargeAddress('v@example.com', path)).toBe(false);
    }
    expect(await chargeAddress('v@example.com', path)).toBe(false);

    // A cold start: the module, and so its local map, is new. The count is not.
    vi.resetModules();
    const fresh = await import('./proxy-throttle');

    expect(await fresh.chargeAddress(' V@Example.com ', path)).toBe(true);
  });

  it('names the web tier to the API and charges a per-caller tight call by path', async () => {
    const seen = fakeSharedCounter();

    await chargeCaller('1.2.3.4', ['email-otp', 'verify-email']);

    expect(seen.headers).toEqual(['k'.repeat(40)]);
    expect(seen.calls).toEqual([{ bucket: '1.2.3.4|email-otp/verify-email', limit: 10 }]);
  });

  it('keeps loose calls in-process, so a page view costs no round trip', async () => {
    const seen = fakeSharedCounter();

    await chargeCaller('1.2.3.4', ['get-session']);

    expect(seen.calls).toEqual([]);
  });

  it('counts in-process when the API cannot be reached, rather than opening the door', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unreachable')));

    const results: boolean[] = [];
    for (let i = 0; i < 11; i++) {
      results.push(await chargeCaller('1.2.3.4', ['email-otp', 'verify-email'], 1_000));
    }

    expect(results.slice(0, 10)).toEqual(Array(10).fill(false));
    expect(results[10]).toBe(true);
  });

  it('counts in-process when the API refuses the key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 401 })));

    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      results.push(await chargeAddress('a@x.test', ['email-otp', 'verify-email'], 1_000));
    }

    expect(results[5]).toBe(true);
  });

  it('never calls the API without a web tier key', async () => {
    vi.stubEnv('WEB_TIER_KEY', '');
    const seen = fakeSharedCounter();

    await chargeCaller('1.2.3.4', ['email-otp', 'verify-email']);

    expect(seen.calls).toEqual([]);
  });
});
