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
  const connect = ["'self'", apiOrigin, ...CLERK_HOSTS, ...STRIPE_HOSTS.connect];
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
    "'unsafe-inline'",
    ...(allowEval === true ? ["'unsafe-eval'"] : []),
    ...CLERK_HOSTS,
    ...STRIPE_HOSTS.script,
  ];
  const frames = ["'self'", ...CLERK_HOSTS, ...STRIPE_HOSTS.frame];

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
