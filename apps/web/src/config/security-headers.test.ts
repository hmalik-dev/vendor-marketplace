import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './security-headers';

const ORIGINS = { apiOrigin: 'https://api.example.com', imageOrigin: 'https://cdn.example.com' };

function headerMap(options: Parameters<typeof securityHeaders>[0]): Record<string, string> {
  return Object.fromEntries(securityHeaders(options).map((rule) => [rule.key, rule.value]));
}

describe('securityHeaders', () => {
  /* The acceptance check for #30 greps for exactly these four. */
  it('sends the four headers the launch gate checks for', () => {
    const headers = headerMap({ ...ORIGINS, enforceCsp: true, https: true });

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
    expect(headerMap({ ...ORIGINS, enforceCsp: false, https: false })).not.toHaveProperty(
      'Strict-Transport-Security',
    );
  });

  it('never sends preload, which is an irreversible submission', () => {
    expect(
      headerMap({ ...ORIGINS, enforceCsp: true, https: true })['Strict-Transport-Security'],
    ).not.toContain('preload');
  });

  it('denies the permissions nothing here uses', () => {
    const policy = headerMap({ ...ORIGINS, enforceCsp: true, https: true })['Permissions-Policy'];

    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  /*
   * Report-only is the whole point of the flag: a CSP that breaks sign-in is
   * worse than none, so the policy is observed before it is enforced.
   */
  it('reports rather than enforces until the policy is promoted', () => {
    const reporting = headerMap({ ...ORIGINS, enforceCsp: false, https: true });

    expect(reporting).toHaveProperty('Content-Security-Policy-Report-Only');
    expect(reporting).not.toHaveProperty('Content-Security-Policy');
  });

  it('enforces once promoted', () => {
    const enforced = headerMap({ ...ORIGINS, enforceCsp: true, https: true });

    expect(enforced).toHaveProperty('Content-Security-Policy');
    expect(enforced).not.toHaveProperty('Content-Security-Policy-Report-Only');
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

  it('omits the image origin entirely when uploads share this one', () => {
    expect(contentSecurityPolicy({ apiOrigin: 'https://api.example.com' })).toContain(
      `img-src 'self' data: blob:`,
    );
  });

  /*
   * Clerk serves its script, its Frontend API and its Turnstile challenge from
   * its own hosts. Verified in a browser with the policy enforced: sign-in
   * renders and loads with no violations.
   */
  it('allows Clerk to load its script, open its frame and reach its API', () => {
    const policy = contentSecurityPolicy(ORIGINS);

    for (const directive of ['script-src', 'frame-src', 'connect-src']) {
      expect(policy.split('; ').find((d) => d.startsWith(directive))).toContain(
        'https://*.clerk.accounts.dev',
      );
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
   * Both directives carry `unsafe-inline`, and the test says so rather than
   * implying a stricter policy than this is: Next inlines critical CSS, and
   * the App Router inlines its bootstrap. Dropping it from scripts needs a
   * per-request nonce, which opts the whole site out of static generation —
   * its own ticket, not this one.
   */
  it("carries 'unsafe-inline' on both style-src and script-src", () => {
    const directives = contentSecurityPolicy(ORIGINS).split('; ');

    expect(directives.find((d) => d.startsWith('style-src'))).toContain("'unsafe-inline'");
    expect(directives.find((d) => d.startsWith('script-src'))).toContain("'unsafe-inline'");
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
