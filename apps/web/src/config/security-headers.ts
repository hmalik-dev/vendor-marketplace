/**
 * The web tier's response headers.
 *
 * The API has been hardened since it shipped — helmet, cors and rate-limit are
 * all registered in `apps/api/src/server.ts` — but `next.config.ts` was an
 * empty object, so the origin a browser actually loads sent none of this.
 *
 * Kept out of `next.config.ts` so it can be unit-tested: a header list is
 * exactly the kind of thing that is silently wrong for months.
 */

export interface HeaderRule {
  key: string;
  value: string;
}

/**
 * Origins the browser is allowed to reach, beyond this one.
 *
 * Clerk serves its script and its Frontend API from `*.clerk.accounts.dev` in
 * development and from the instance's own domain in production, and it opens a
 * worker and an iframe of its own. The object store is wherever uploads were
 * written, which differs per environment — hence the parameters rather than a
 * baked-in list.
 */
export interface CspOrigins {
  /** The API this app talks to, e.g. `https://api.example.com`. */
  apiOrigin: string;
  /** The bucket public URLs are served from, if it is a distinct origin. */
  imageOrigin?: string;
  /**
   * Whether this origin is served over TLS. Off HTTPS the policy must not ask
   * the browser to upgrade its subresources: on localhost that rewrites the
   * API and the object store to `https://` and every one of them fails, so
   * enforcing the policy locally would look like a CSP bug that is not there.
   */
  https?: boolean;
  /** Development only — webpack's HMR runtime needs `eval`. */
  allowEval?: boolean;
}

/** Clerk's own hosts. Wildcards cover both the dev and the production shapes. */
const CLERK_HOSTS = [
  'https://*.clerk.accounts.dev',
  'https://*.clerk.com',
  'https://clerk.com',
  'https://challenges.cloudflare.com',
];

/**
 * `unsafe-inline` is present on **both** `style-src` and `script-src`, and it
 * is worth being plain about that rather than implying a stricter policy than
 * this is.
 *
 * Styles: Next injects critical CSS as a `<style>` element and next/font
 * writes inline `@font-face` blocks. There is no way around it.
 *
 * Scripts: the App Router emits inline bootstrap and flight-data scripts. The
 * alternative is a per-request nonce, which needs a nonce-emitting middleware
 * and forces **every page to render dynamically** — it opts the whole site out
 * of static generation, which is a real cost to a marketplace whose landing
 * and profile pages should be cached. That trade deserves its own ticket
 * rather than being smuggled into the one that adds the headers.
 *
 * So this policy's value is in the directives that *are* tight —
 * `frame-ancestors`, `object-src`, `base-uri`, `form-action`, and an
 * allow-list on `connect-src`, `img-src` and `frame-src`. `strict-dynamic` is
 * absent for the same reason as the nonce.
 */
export function contentSecurityPolicy({
  apiOrigin,
  imageOrigin,
  https,
  allowEval,
}: CspOrigins): string {
  const connect = ["'self'", apiOrigin, ...CLERK_HOSTS];
  /*
   * `img.clerk.com` is Clerk's avatar CDN, and it is not covered by
   * `*.clerk.com` on `connect-src` because avatars are images. Leaving it out
   * broke the header avatar for every signed-in user in production — the
   * policy was verified signed-out, where that element never renders.
   */
  const images = [
    "'self'",
    'data:',
    'blob:',
    'https://img.clerk.com',
    ...(imageOrigin ? [imageOrigin] : []),
  ];
  /*
   * `unsafe-eval` is a development-only allowance: webpack's dev runtime uses
   * `eval` for hot module replacement. A production bundle does not, so it is
   * not shipped — leaving it on would hand an injected string a way to execute
   * for no benefit.
   */
  const script = [
    "'self'",
    "'unsafe-inline'",
    ...(allowEval === true ? ["'unsafe-eval'"] : []),
    ...CLERK_HOSTS,
  ];

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src ${script.join(' ')}`,
    `worker-src 'self' blob:`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self' data:`,
    `img-src ${images.join(' ')}`,
    `connect-src ${connect.join(' ')}`,
    `frame-src 'self' ${CLERK_HOSTS.join(' ')}`,
    ...(https === true ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export interface SecurityHeaderOptions extends CspOrigins {
  /**
   * Report-only until the policy has been driven through auth, upload and
   * search in a real browser. A CSP that breaks sign-in is worse than none,
   * and the report-only header is how you find that out without an outage.
   */
  enforceCsp: boolean;
  /**
   * HSTS is omitted off HTTPS. Sending it from `http://localhost` would pin
   * the browser to a scheme the dev server does not speak, and the pin
   * outlives the header.
   */
  https: boolean;
}

export function securityHeaders(options: SecurityHeaderOptions): HeaderRule[] {
  const headers: HeaderRule[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    /*
     * `X-Frame-Options` and the CSP's `frame-ancestors` say the same thing to
     * two generations of browser. Both are sent: the modern directive is
     * authoritative where it is understood, and the legacy header is what the
     * acceptance check greps for.
     */
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    /*
     * Nothing here uses a camera, a microphone or a location, so all three are
     * denied outright rather than left at the browser's default of "ask".
     * Payment is denied too — Stripe Checkout is a redirect, not an embedded
     * Payment Request, so #10 does not need it back.
     */
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
    },
    {
      key: options.enforceCsp ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
      value: contentSecurityPolicy(options),
    },
  ];

  if (options.https) {
    headers.push({
      key: 'Strict-Transport-Security',
      // Two years, subdomains included. No `preload`: that is a submission to a
      // list baked into browsers and is effectively irreversible, so it is a
      // decision to take once the domain is settled, not with the first deploy.
      value: 'max-age=63072000; includeSubDomains',
    });
  }

  return headers;
}
