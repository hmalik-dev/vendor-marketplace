import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callerAddress,
  chargeAddress,
  chargeCaller,
  chargeRequest,
  isAddressThrottled,
  isMailPaced,
  isSignInRefused,
  isThrottled,
  recordSignInFailure,
  resetThrottle,
  signInCaller,
} from './proxy-throttle';

const VERIFY = ['email-otp', 'verify-email'];

describe('sign-in failures per account address and caller (VEN-630)', () => {
  beforeEach(() => {
    vi.stubEnv('WEB_TIER_KEY', '');
    resetThrottle();
  });

  afterEach(() => vi.unstubAllEnvs());

  async function fail(address: string, caller: string, times: number) {
    for (let i = 0; i < times; i++) await recordSignInFailure(address, caller, 1_000);
  }

  it('lets the owner from another caller in after ten failures elsewhere, and still refuses the failing caller', async () => {
    await fail('owner@x.test', '1.1.1.1', 10);

    expect(await isSignInRefused('owner@x.test', '2.2.2.2', 1_000)).toBe(false);
    expect(await isSignInRefused('owner@x.test', '1.1.1.1', 1_000)).toBe(true);
  });

  it('refuses a caller that failed once itself while the address budget is spent', async () => {
    for (let i = 0; i < 10; i++) await fail('owner@x.test', `9.9.9.${i}`, 1);
    await fail('owner@x.test', '2.2.2.2', 1);

    expect(await isSignInRefused('owner@x.test', '2.2.2.2', 1_000)).toBe(true);
    expect(await isSignInRefused('owner@x.test', '3.3.3.3', 1_000)).toBe(false);
  });

  it('reads the address case-insensitively and per address', async () => {
    await fail('Owner@X.test', '1.1.1.1', 10);

    expect(await isSignInRefused('owner@x.test', '1.1.1.1', 1_000)).toBe(true);
    expect(await isSignInRefused('other@x.test', '1.1.1.1', 1_000)).toBe(false);
  });

  it('forgives a caller after ten minutes', async () => {
    await fail('owner@x.test', '1.1.1.1', 10);

    expect(await isSignInRefused('owner@x.test', '1.1.1.1', 1_000 + 600_000)).toBe(false);
  });
});

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

describe('sign-in failures through the shared counter (VEN-630)', () => {
  beforeEach(() => {
    vi.stubEnv('WEB_TIER_KEY', 'k'.repeat(40));
    resetThrottle();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** The API's semantics: a read never adds a hit and refuses at `held >= limit`; a charge adds one and refuses past `limit`. */
  function recordAwareCounter() {
    const counts = new Map<string, number>();
    const seen: Array<{ bucket: string; limit: number; record: boolean }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as {
          bucket: string;
          limit: number;
          record: boolean;
        };
        const held = counts.get(body.bucket) ?? 0;
        seen.push(body);

        if (!body.record) {
          return Response.json({ throttled: held >= body.limit });
        }

        counts.set(body.bucket, held + 1);
        return Response.json({ throttled: held + 1 > body.limit });
      }),
    );

    return seen;
  }

  it('lets the owner in after a stranger spent the address budget, and reads without recording', async () => {
    const seen = recordAwareCounter();

    for (let i = 0; i < 10; i++) await recordSignInFailure('owner@x.test', '1.1.1.1');

    const readsFrom = seen.length;
    expect(await isSignInRefused('owner@x.test', '2.2.2.2')).toBe(false);
    expect(await isSignInRefused('owner@x.test', '1.1.1.1')).toBe(true);
    expect(seen.slice(readsFrom).every((call) => !call.record)).toBe(true);
    expect(await isSignInRefused('owner@x.test', '2.2.2.2')).toBe(false);
  });

  it('stores opaque buckets, never the address or the caller', async () => {
    const seen = recordAwareCounter();

    await recordSignInFailure('Someone@Example.com', '9.9.9.9');

    expect(JSON.stringify(seen)).not.toMatch(/example\.com|9\.9\.9\.9/);
  });
});

describe('signInCaller', () => {
  it('keeps an IPv4 address and takes an IPv6 address by its /64', () => {
    expect(signInCaller('203.0.113.7')).toBe('203.0.113.7');
    expect(signInCaller('2001:db8:0:1::5')).toBe('2001:0db8:0000:0001::/64');
    expect(signInCaller('2001:DB8:0:1:aaaa:bbbb:cccc:dddd')).toBe('2001:0db8:0000:0001::/64');
    expect(signInCaller('2001:db8::1')).toBe('2001:0db8:0000:0000::/64');
    expect(signInCaller('::1')).toBe('0000:0000:0000:0000::/64');
    expect(signInCaller('::ffff:203.0.113.7')).toBe('::ffff:203.0.113.7');
  });
});

describe('the ceiling on wrong passwords per address (VEN-630)', () => {
  beforeEach(() => {
    vi.stubEnv('WEB_TIER_KEY', '');
    resetThrottle();
  });

  afterEach(() => vi.unstubAllEnvs());

  it('refuses even a caller with no failure once a hundred came from many callers', async () => {
    for (let i = 0; i < 100; i++) await recordSignInFailure('owner@x.test', `10.0.0.${i}`);

    expect(await isSignInRefused('owner@x.test', '10.9.9.9')).toBe(true);
  });

  it('does not hand a fresh guess to every address inside one IPv6 /64', async () => {
    for (let i = 1; i <= 10; i++) await recordSignInFailure('owner@x.test', `2001:db8::${i}`);

    expect(await isSignInRefused('owner@x.test', '2001:db8::ffff')).toBe(true);
    expect(await isSignInRefused('owner@x.test', '2001:db9::1')).toBe(false);
  });
});

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

  it('stores an opaque bucket, never the address', async () => {
    const seen = fakeSharedCounter();

    await chargeAddress('Someone@Example.com', ['sign-in', 'email']);

    expect(seen.calls[0]?.bucket).toMatch(/^addr\|sign-in\/email\|[0-9a-f]{64}$/);
    expect(JSON.stringify(seen.calls)).not.toContain('example.com');
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

describe('reset and code requests per account address and caller (VEN-718)', () => {
  const RESET = ['email-otp', 'request-password-reset'];

  beforeEach(() => {
    vi.stubEnv('WEB_TIER_KEY', '');
    resetThrottle();
  });

  afterEach(() => vi.unstubAllEnvs());

  async function ask(caller: string, times: number, path = RESET) {
    const answers: boolean[] = [];
    for (let i = 0; i < times; i++)
      answers.push(await chargeRequest('owner@x.test', caller, path, 1_000));
    return answers;
  }

  it('lets the owner from another caller in after a stranger spent the address budget, and still refuses the stranger', async () => {
    expect(await ask('1.1.1.1', 5)).toEqual([false, false, false, false, false]);

    expect(await ask('1.1.1.1', 1)).toEqual([true]);
    expect(await ask('2.2.2.2', 1)).toEqual([false]);
  });

  it('refuses a caller that already used its own request while the address budget is spent', async () => {
    for (let i = 0; i < 5; i++) await ask(`9.9.9.${i}`, 1);
    await ask('2.2.2.2', 1);

    expect(await ask('2.2.2.2', 1)).toEqual([true]);
    expect(await ask('3.3.3.3', 1)).toEqual([false]);
  });

  it('keeps each path and each address to its own budget', async () => {
    await ask('1.1.1.1', 6);

    expect(await ask('1.1.1.1', 1, VERIFY)).toEqual([false]);
    expect(await chargeRequest('other@x.test', '1.1.1.1', RESET, 1_000)).toBe(false);
  });

  it('refuses even a caller with no request of its own once fifty came from many callers', async () => {
    for (let i = 0; i < 50; i++) await ask(`10.0.0.${i}`, 1);

    expect(await ask('10.9.9.9', 1)).toEqual([true]);
  });

  it('holds a code check to ten guesses per address however many callers ask', async () => {
    for (let i = 0; i < 10; i++) await ask(`10.0.0.${i}`, 1, VERIFY);

    expect(await ask('10.9.9.9', 1, VERIFY)).toEqual([true]);
    expect(await ask('10.9.9.9', 1, ['email-otp', 'reset-password'])).toEqual([false]);
  });

  it('refuses a request whose own charge went over the ceiling, as a parallel burst would', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        chargeRequest('owner@x.test', `10.1.0.${i}`, VERIFY, 1_000),
      ),
    );

    expect(results.filter((refused) => !refused)).toHaveLength(10);
  });

  it('counts an IPv6 /64 as one caller and forgives after ten minutes', async () => {
    for (let i = 1; i <= 5; i++)
      await chargeRequest('owner@x.test', `2001:db8::${i}`, RESET, 1_000);

    expect(await chargeRequest('owner@x.test', '2001:db8::ffff', RESET, 1_000)).toBe(true);
    expect(await chargeRequest('owner@x.test', '2001:db8::ffff', RESET, 1_000 + 600_000)).toBe(
      false,
    );
  });
});

describe('reset mail per account address, per minute (VEN-719)', () => {
  beforeEach(() => {
    vi.stubEnv('WEB_TIER_KEY', '');
    resetThrottle();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('lets one through a minute for one address, whatever the case, and paces the rest', async () => {
    expect(await isMailPaced('owner@x.test', 1_000)).toBe(false);
    expect(await isMailPaced('Owner@X.test', 2_000)).toBe(true);
    expect(await isMailPaced(' owner@x.test ', 3_000)).toBe(true);
    expect(await isMailPaced('other@x.test', 3_000)).toBe(false);
  });

  it('records nothing for a paced request, and frees the send when the minute is up', async () => {
    await isMailPaced('owner@x.test', 1_000);
    for (const at of [30_000, 50_000]) expect(await isMailPaced('owner@x.test', at)).toBe(true);

    expect(await isMailPaced('owner@x.test', 61_001)).toBe(false);
    expect(await isMailPaced('owner@x.test', 61_002)).toBe(true);
  });

  it('stores an opaque bucket, never the address', async () => {
    const seen = fakeSharedCounter();
    vi.stubEnv('WEB_TIER_KEY', 'k'.repeat(40));

    await isMailPaced('Someone@Example.com');

    expect(seen.calls[0]?.bucket).toMatch(/^mail\|[0-9a-f]{64}$/);
    expect(seen.calls[0]?.limit).toBe(1);
  });
});
