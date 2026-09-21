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

/**
 * Where the middleware puts the per-request nonce on the request, so a server
 * component can stamp it on a `<script>` it renders itself (JSON-LD).
 */
export const CSP_NONCE_HEADER = 'x-nonce';

/**
 * What `contentSecurityPolicy` writes in place of the nonce when it is called
 * at build time. `next.config.ts` computes the policy once, inlines it, and the
 * middleware swaps this for a fresh nonce on every request.
 */
export const CSP_NONCE_PLACEHOLDER = '__CSP_NONCE__';

export interface HeaderRule {
  key: string;
  value: string;
}

/**
 * Origins the browser is allowed to reach, beyond this one.
 *
 * Authentication needs none: sign-in and sign-up talk to this origin's own
 * `/api/auth` proxy, and no provider script, frame or avatar is loaded. The
 * object store is wherever uploads were
 * written, which differs per environment — hence the parameters rather than a
 * baked-in list.
 */
export interface CspOrigins {
  /** The API this app talks to, e.g. `https://api.example.com`. */
  apiOrigin: string;
  /** The bucket public URLs are served from, if it is a distinct origin. */
  imageOrigin?: string;
  /** The Sentry ingest host the browser SDK posts to, read from the DSN. Absent when reporting is off. */
  errorIngestOrigin?: string | undefined;
  /**
   * Whether this origin is served over TLS. Off HTTPS the policy must not ask
   * the browser to upgrade its subresources: on localhost that rewrites the
   * API and the object store to `https://` and every one of them fails, so
   * enforcing the policy locally would look like a CSP bug that is not there.
   */
  https?: boolean;
  /**
   * The per-request nonce, or `CSP_NONCE_PLACEHOLDER` when the policy is built
   * as a template. `null` builds the baseline for responses that are not
   * documents (`/_next/*`): `'self'` and the Stripe hosts, no nonce.
   */
  nonce: string | null;
  /** Development only — webpack's HMR runtime needs `eval`. */
  allowEval?: boolean;
}

/**
 * Stripe's hosts, per directive, as Stripe documents them for Stripe.js and
 * the Payment Element (docs.stripe.com/security/guide, "Content Security
 * Policy"). This file named Stripe exactly once before #396 — in a comment
 * explaining why nothing here was needed — and the enforced production policy
 * refused the Elements frame, its script and its API in one go, so checkout
 * could not load on the deployed origin at all.
 *
 * #396 asked for exact hosts and no wildcards, and three wildcards ship
 * anyway, deliberately: `*.js.stripe.com` is Stripe's own recommendation (it
 * lets Stripe.js start frames on separate origins it does not enumerate),
 * `*.stripe.com` on `img-src` is how Stripe documents its card-brand and
 * wallet artwork, and `*.link.com` is how it documents Link, whose
 * subdomains (`checkout.`, `statics.`, …) are Stripe's to add. Narrowing any
 * of them to the hosts seen in one browser session would break the next
 * one Stripe adds. `hooks.stripe.com` is the 3-D
 * Secure challenge frame a card can demand mid-payment. `link.com` is Link,
 * which the Payment Element offers by default. `m.stripe.network`,
 * `m.stripe.com` and `r.stripe.com` are the fraud-signal frame and the two
 * telemetry endpoints Stripe.js reaches without documenting them; leaving them
 * out would not break a payment, but every page would log violations, and a
 * policy that is noisy by design is one nobody reads.
 */
const STRIPE_HOSTS = {
  script: ['https://js.stripe.com', 'https://*.js.stripe.com'],
  frame: [
    'https://js.stripe.com',
    'https://*.js.stripe.com',
    'https://hooks.stripe.com',
    'https://m.stripe.network',
    'https://link.com',
    'https://*.link.com',
  ],
  connect: [
    'https://api.stripe.com',
    'https://m.stripe.com',
    'https://r.stripe.com',
    'https://link.com',
    'https://*.link.com',
  ],
  image: ['https://*.stripe.com', 'https://*.link.com'],
} as const;

/**
 * The origins whose frames may use the Payment Request API. `PaymentElement`
 * surfaces Apple Pay and Google Pay from inside Stripe's iframe, so the policy
 * has to name that frame's origin as well as this one; `self` alone leaves a
 * working card form whose wallet buttons silently never appear.
 */
const PAYMENT_ALLOWLIST = ['self', ...STRIPE_HOSTS.script.map((host) => `"${host}"`)].join(' ');

/**
 * `script-src` carries no `unsafe-inline`: it allows `'self'`, the request's
 * nonce and `'strict-dynamic'`, so the only inline script that runs is one the
 * server stamped with this response's nonce (Next's bootstrap and flight data,
 * which read the nonce from the request's CSP header, and the JSON-LD blocks).
 * With `strict-dynamic` a browser that understands it ignores the host list;
 * the Stripe hosts stay for a browser that does not.
 *
 * `style-src 'unsafe-inline'` stays, deliberately (VEN-523 non-goal): Next
 * injects critical CSS as a `<style>` element and next/font writes inline
 * `@font-face` blocks.
 *
 * The rest of the policy is tight: `frame-ancestors`, `object-src`,
 * `base-uri`, `form-action`, and allow-lists on `connect-src`, `img-src` and
 * `frame-src`.
 */
export function contentSecurityPolicy({
  apiOrigin,
  imageOrigin,
  errorIngestOrigin,
  https,
  nonce,
  allowEval,
}: CspOrigins): string {
  const connect = [
    "'self'",
    apiOrigin,
    ...STRIPE_HOSTS.connect,
    ...(errorIngestOrigin ? [errorIngestOrigin] : []),
  ];
  const images = [
    "'self'",
    'data:',
    'blob:',
    ...STRIPE_HOSTS.image,
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
    ...(nonce === null ? [] : [`'nonce-${nonce}'`, "'strict-dynamic'"]),
    ...(allowEval === true ? ["'unsafe-eval'"] : []),
    ...STRIPE_HOSTS.script,
  ];
  const frames = ["'self'", ...STRIPE_HOSTS.frame];

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
    `frame-src ${frames.join(' ')}`,
    ...(https === true ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/**
 * Whether the policy is enforced or only reported. Production always
 * enforces; `CSP_ENFORCE=1` turns enforcement on elsewhere so a browser pass
 * can fail on a blocked origin — under report-only it cannot (#396). The
 * expression is monotone on purpose: no value of the flag can switch
 * production back to report-only, and the test pins that branch because a
 * default is exactly the code no test otherwise covers.
 */
export function shouldEnforceCsp(env: {
  readonly cspEnforce: string | undefined;
  readonly nodeEnv: string | undefined;
}): boolean {
  return env.nodeEnv === 'production' || env.cspEnforce === '1';
}

/** The header a policy travels in: enforced, or report-only outside production. */
export function cspHeaderName(enforceCsp: boolean): string {
  return enforceCsp ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
}

/** Puts a request's nonce into a policy built with `CSP_NONCE_PLACEHOLDER`. */
export function withNonce(template: string, nonce: string): string {
  return template.replaceAll(CSP_NONCE_PLACEHOLDER, nonce);
}

export interface SecurityHeaderOptions {
  /**
   * HSTS is omitted off HTTPS. Sending it from `http://localhost` would pin
   * the browser to a scheme the dev server does not speak, and the pin
   * outlives the header.
   */
  https: boolean;
}

/** The headers that are the same on every response. The CSP is per-request: see `middleware.ts`. */
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
     *
     * Payment used to be denied too, on the reasoning that "Stripe Checkout is
     * a redirect, not an embedded Payment Request, so #10 does not need it
     * back". That premise stopped being true when #10 shipped embedded
     * Elements (`checkout-screen.tsx` mounts `PaymentElement` and calls
     * `stripe.confirmPayment`), and `payment=()` blocks the Payment Request
     * API that Apple Pay and Google Pay go through — inside Stripe's frame,
     * which is why the allowlist names Stripe's origins and not only `self`.
     * Reversed by #396; the sentence is kept so the next reader sees why.
     */
    {
      key: 'Permissions-Policy',
      value: `camera=(), microphone=(), geolocation=(), payment=(${PAYMENT_ALLOWLIST}), interest-cohort=()`,
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
