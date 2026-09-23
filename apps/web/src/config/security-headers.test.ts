import { describe, expect, it } from 'vitest';
import {
  CSP_NONCE_PLACEHOLDER,
  contentSecurityPolicy,
  cspHeaderName,
  securityHeaders,
  shouldEnforceCsp,
  withNonce,
} from './security-headers';

const NONCE = 'dGVzdC1ub25jZQ==';
const ORIGINS = {
  apiOrigin: 'https://api.example.com',
  imageOrigin: 'https://cdn.example.com',
  nonce: NONCE,
};

function headerMap(options: Parameters<typeof securityHeaders>[0]): Record<string, string> {
  return Object.fromEntries(securityHeaders(options).map((rule) => [rule.key, rule.value]));
}

describe('securityHeaders', () => {
  /* The acceptance check for #30 greps for exactly these four. */
  it('sends the four headers the launch gate checks for', () => {
    const headers = headerMap({ https: true, deployEnv: 'production' });

    expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  /*
   * HSTS pins the browser to HTTPS for two years, and the pin outlives the
   * header. Sent from `http://localhost` it would make the dev server
   * unreachable in that browser long after the mistake was fixed.
   */
  it('omits HSTS off HTTPS', () => {
    expect(headerMap({ https: false, deployEnv: 'production' })).not.toHaveProperty(
      'Strict-Transport-Security',
    );
  });

  it('never sends preload, which is an irreversible submission', () => {
    expect(
      headerMap({ https: true, deployEnv: 'production' })['Strict-Transport-Security'],
    ).not.toContain('preload');
  });

  it('denies the permissions nothing here uses', () => {
    const policy = headerMap({ https: true, deployEnv: 'production' })['Permissions-Policy'];

    for (const feature of ['camera', 'microphone', 'geolocation']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  /*
   * `payment=()` shipped on the premise that checkout was a redirect. It is
   * embedded Elements, and Apple Pay and Google Pay run through the Payment
   * Request API from inside Stripe's frame — so the allowlist has to name
   * Stripe's script origins, not only `self` (#396).
   */
  it('lets this page and the Stripe frame use the Payment Request API', () => {
    const policy = headerMap({ https: true, deployEnv: 'production' })['Permissions-Policy'];

    expect(policy).toContain('payment=(self "https://js.stripe.com" "https://*.js.stripe.com")');
    expect(policy).not.toContain('payment=()');
  });

  /* The CSP needs a per-request nonce, so it is the middleware's, not a static header. */
  it('sends no CSP itself', () => {
    const names = securityHeaders({ https: true, deployEnv: 'production' }).map((rule) => rule.key);

    expect(names).not.toContain('Content-Security-Policy');
    expect(names).not.toContain('Content-Security-Policy-Report-Only');
  });
});

/*
 * VEN-606: Vercel adds `x-robots-tag: noindex` to per-deployment URLs but not
 * to a branch alias, so staging's stable address was indexable. The header is
 * this app's to send, on every response a non-production tier serves.
 */
describe('X-Robots-Tag', () => {
  it.each([['staging'], ['local'], [undefined]])(
    'tells crawlers to neither index nor follow the %s tier',
    (deployEnv) => {
      expect(headerMap({ https: true, deployEnv })['X-Robots-Tag']).toBe('noindex, nofollow');
    },
  );

  it('is absent in production, where the site is meant to be found', () => {
    expect(headerMap({ https: true, deployEnv: 'production' })).not.toHaveProperty('X-Robots-Tag');
  });
});

describe('cspHeaderName', () => {
  it('reports rather than enforces until the policy is promoted', () => {
    expect(cspHeaderName(false)).toBe('Content-Security-Policy-Report-Only');
  });

  it('enforces once promoted', () => {
    expect(cspHeaderName(true)).toBe('Content-Security-Policy');
  });
});

describe('contentSecurityPolicy', () => {
  it('allows the API it actually talks to, and no other', () => {
    const policy = contentSecurityPolicy(ORIGINS);

    expect(policy).toContain(`connect-src 'self' https://api.example.com`);
    expect(policy).not.toContain('https://api.somewhere-else.com');
  });

  it('allows the object store for images only', () => {
    const policy = contentSecurityPolicy(ORIGINS);
    const imgSrc = policy.split('; ').find((d) => d.startsWith('img-src'));

    expect(imgSrc).toContain('https://cdn.example.com');
    expect(policy.split('; ').find((d) => d.startsWith('script-src'))).not.toContain(
      'https://cdn.example.com',
    );
  });

  it('allows the Neon storage host and refuses any other image origin (VEN-456)', () => {
    const storage = 'https://ep-abc.storage.us-east-2.aws.neon.tech';
    const imgSrc = contentSecurityPolicy({ ...ORIGINS, imageOrigin: storage })
      .split('; ')
      .find((d) => d.startsWith('img-src'));

    // The whole directive, so a widening — `https:`, a wildcard, a second
    // origin — fails wherever it is spelled, not only where a substring breaks.
    expect(imgSrc?.split(' ').slice(1)).toEqual([
      "'self'",
      'data:',
      'blob:',
      'https://*.stripe.com',
      'https://*.link.com',
      storage,
    ]);
  });

  it('omits the image origin entirely when uploads share this one', () => {
    expect(contentSecurityPolicy({ apiOrigin: 'https://api.example.com', nonce: NONCE })).toContain(
      `img-src 'self' data: blob: https://*.stripe.com`,
    );
  });

  /*
   * Sign-in reaches Neon Auth through the same-origin proxy, so the enforced
   * production policy needs no allowance for the auth base URL — and adding one
   * would only widen `connect-src` to a host the browser never calls.
   */
  it('lets a production-shaped policy connect to this origin, the API, Stripe and the error ingest only', () => {
    const policy = contentSecurityPolicy({
      ...ORIGINS,
      https: true,
      errorIngestOrigin: 'https://o1.ingest.sentry.io',
    });
    const connect = policy.split('; ').find((d) => d.startsWith('connect-src'));

    expect(connect?.split(' ').slice(1)).toEqual([
      "'self'",
      'https://api.example.com',
      'https://api.stripe.com',
      'https://m.stripe.com',
      'https://r.stripe.com',
      'https://link.com',
      'https://*.link.com',
      'https://o1.ingest.sentry.io',
    ]);
  });

  /*
   * Authentication talks to this origin's own `/api/auth` proxy, so the policy
   * names no identity provider anywhere: no script, frame, image or connection.
   */
  it('names no identity provider in any directive', () => {
    const policy = contentSecurityPolicy(ORIGINS);

    expect(policy).not.toMatch(/cl(?:)erk|neon|challenges\.cloudflare/i);
  });

  /*
   * #396: the enforced production policy refused Stripe's script, frame and
   * API, so checkout could not load on the deployed origin — and this file
   * passed, because it asserted the directives were present rather than what
   * they permitted. This enumerates the origins the payment path loads from
   * and asserts each one is allowed where Stripe documents it must be.
   */
  it('permits every origin the embedded payment form loads from', () => {
    const directives = new Map(
      contentSecurityPolicy(ORIGINS)
        .split('; ')
        .map((directive) => [directive.split(' ')[0], directive] as const),
    );
    /*
     * Literal hosts, on purpose: reading them back from `STRIPE_HOSTS` would
     * pass after a host was deleted from it, which is the failure this test
     * exists to catch.
     */
    const expectations: Array<[string, readonly string[]]> = [
      ['script-src', ['https://js.stripe.com', 'https://*.js.stripe.com']],
      [
        'frame-src',
        [
          'https://js.stripe.com',
          'https://*.js.stripe.com',
          'https://hooks.stripe.com',
          'https://m.stripe.network',
          'https://link.com',
          'https://*.link.com',
        ],
      ],
      [
        'connect-src',
        [
          'https://api.stripe.com',
          'https://m.stripe.com',
          'https://r.stripe.com',
          'https://link.com',
          'https://*.link.com',
        ],
      ],
      ['img-src', ['https://*.stripe.com', 'https://*.link.com']],
    ];

    for (const [directive, hosts] of expectations) {
      for (const host of hosts) {
        expect(directives.get(directive), `${directive} must allow ${host}`).toContain(host);
      }
    }
  });

  it('keeps Stripe off the directives it has no business in', () => {
    const directives = contentSecurityPolicy(ORIGINS).split('; ');

    for (const name of ['style-src', 'font-src', 'worker-src', 'form-action']) {
      expect(directives.find((d) => d.startsWith(name))).not.toContain('stripe');
    }
  });

  it('forbids embedding, plugins and a rewritten base URI', () => {
    const policy = contentSecurityPolicy(ORIGINS);

    expect(policy).toContain(`frame-ancestors 'none'`);
    expect(policy).toContain(`object-src 'none'`);
    expect(policy).toContain(`base-uri 'self'`);
    expect(policy).toContain(`form-action 'self'`);
  });

  /*
   * Off HTTPS this directive rewrites every subresource to `https://`, so on
   * localhost the API and the object store both become unreachable — which
   * reads as a CSP bug rather than as the misconfiguration it is.
   */
  it('upgrades insecure requests only where the origin is itself secure', () => {
    expect(contentSecurityPolicy({ ...ORIGINS, https: true })).toContain(
      'upgrade-insecure-requests',
    );
    expect(contentSecurityPolicy({ ...ORIGINS, https: false })).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  /*
   * VEN-523. `script-src` names no `unsafe-inline`: the only inline script that
   * runs is one carrying this response's nonce. Style keeps it (a non-goal).
   */
  it("drops 'unsafe-inline' from script-src and carries the nonce with strict-dynamic", () => {
    const directives = contentSecurityPolicy(ORIGINS).split('; ');
    const script = directives.find((d) => d.startsWith('script-src'));

    expect(script).not.toContain("'unsafe-inline'");
    expect(script).toContain(`'nonce-${NONCE}'`);
    expect(script).toContain("'strict-dynamic'");
    expect(directives.find((d) => d.startsWith('style-src'))).toContain("'unsafe-inline'");
  });

  it('builds a nonce-free baseline for non-document responses', () => {
    const script = contentSecurityPolicy({ ...ORIGINS, nonce: null })
      .split('; ')
      .find((d) => d.startsWith('script-src'));

    expect(script).not.toMatch(/nonce|strict-dynamic|unsafe-inline/);
  });

  it('puts a different nonce in a different request, and only in script-src', () => {
    const template = contentSecurityPolicy({ ...ORIGINS, nonce: CSP_NONCE_PLACEHOLDER });
    const first = withNonce(template, 'AAAA');
    const second = withNonce(template, 'BBBB');

    expect(first).toContain(`'nonce-AAAA'`);
    expect(second).toContain(`'nonce-BBBB'`);
    expect(second).not.toContain('AAAA');
    expect(first).not.toContain(CSP_NONCE_PLACEHOLDER);
    expect(first.match(/nonce-/g)).toHaveLength(1);
  });

  /*
   * `unsafe-eval` is webpack's hot-reload runtime, which no production bundle
   * uses. Shipping it would hand an injected string a way to execute for
   * nothing in return.
   */
  it('allows eval in development only', () => {
    const script = (options: Parameters<typeof contentSecurityPolicy>[0]): string =>
      contentSecurityPolicy(options)
        .split('; ')
        .find((d) => d.startsWith('script-src')) ?? '';

    expect(script({ ...ORIGINS, allowEval: true })).toContain("'unsafe-eval'");
    expect(script({ ...ORIGINS })).not.toContain("'unsafe-eval'");
  });
});

describe('shouldEnforceCsp', () => {
  it('always enforces in production, whatever the flag says', () => {
    for (const cspEnforce of ['0', '1', undefined, 'false']) {
      expect(shouldEnforceCsp({ cspEnforce, nodeEnv: 'production' })).toBe(true);
    }
  });

  it('reports only in development unless the flag is exactly 1', () => {
    expect(shouldEnforceCsp({ cspEnforce: undefined, nodeEnv: 'development' })).toBe(false);
    expect(shouldEnforceCsp({ cspEnforce: '0', nodeEnv: 'development' })).toBe(false);
    expect(shouldEnforceCsp({ cspEnforce: 'true', nodeEnv: 'test' })).toBe(false);
    expect(shouldEnforceCsp({ cspEnforce: '1', nodeEnv: 'development' })).toBe(true);
  });
});
