import { BRAND_NAME } from '@vendor-marketplace/shared';
import { bearer, field, isString, type HttpReply } from './http.js';
import { mask } from './mask.js';
import {
  failed,
  judge,
  originOf,
  passed,
  type LaunchGroup,
  type LaunchOptions,
  type LaunchResult,
  type Probe,
} from './types.js';

const STRIPE_API = 'https://api.stripe.com/v1';
const RESEND_API = 'https://api.resend.com';
const LIVE_SECRET_PREFIX = 'sk_live_';
/** Stripe's own minimum for a statement descriptor. */
const MIN_DESCRIPTOR_LENGTH = 5;
const PLACEHOLDER_DESCRIPTOR = /\b(test|example|placeholder|todo|x{3,})\b/i;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

function liveKey(group: LaunchGroup, name: string, key: string | undefined): LaunchResult {
  const found = key ? mask(key) : 'unset';
  return judge(
    group,
    name,
    found,
    key?.startsWith(LIVE_SECRET_PREFIX) === true,
    LIVE_SECRET_PREFIX,
  );
}

/** A connection string's host, with Neon's pooler suffix dropped so a pooled and a direct URL compare equal. */
function databaseHost(url: string | undefined): string | null {
  try {
    return new URL(url ?? '').hostname.replace('-pooler', '');
  } catch {
    return null;
  }
}

function authProbes({ env, get }: LaunchOptions): Probe[] {
  return [
    {
      group: 'auth',
      name: 'neon auth endpoint',
      async run() {
        const base = env.NEON_AUTH_BASE_URL?.trim().replace(/\/+$/, '');
        if (!base) {
          return [failed('auth', 'neon auth endpoint', 'NEON_AUTH_BASE_URL is unset')];
        }

        const reply = await get(`${base}/.well-known/jwks.json`);
        const keys = field(reply.body, 'keys');
        const signing = Array.isArray(keys) ? keys.length : 0;
        const found =
          signing > 0
            ? `${signing} signing key(s) served`
            : `no signing keys (HTTP ${reply.status})`;

        return [judge('auth', 'neon auth endpoint', found, signing > 0, 'a JWKS with a key')];
      },
    },
    {
      // The reconcile pass and account closure read and end identities over this
      // connection, so it has to reach the same branch the API's own database is
      // on: a source pointed anywhere else answers empty, and the pass refuses.
      group: 'auth',
      name: 'neon auth identity store',
      async run() {
        const store = databaseHost(env.NEON_AUTH_DATABASE_URL);
        const app = databaseHost(env.DATABASE_URL);
        const found =
          store === null ? 'NEON_AUTH_DATABASE_URL is unset' : `identities read from ${store}`;

        return [
          judge(
            'auth',
            'neon auth identity store',
            found,
            store !== null && store === app,
            'the API database host',
          ),
        ];
      },
    },
  ];
}

function webhookSubscription(
  reply: HttpReply,
  target: string,
  handled: readonly string[],
  expected: number,
): LaunchResult {
  const name = 'stripe webhook endpoint';
  const endpoints: unknown = field(reply.body, 'data');

  if (!Array.isArray(endpoints)) {
    return failed('stripe', name, `the endpoint list is unreadable (HTTP ${reply.status})`);
  }

  const matching = endpoints.filter(
    (endpoint) => field(endpoint, 'url') === target && field(endpoint, 'status') === 'enabled',
  );

  if (matching.length === 0) {
    const urls = endpoints.map((endpoint) => field(endpoint, 'url')).filter(isString);
    return failed(
      'stripe',
      name,
      `no enabled endpoint at ${target} (found ${urls.join(', ') || 'none'})`,
    );
  }

  // Each endpoint signs with its own secret and the API verifies one per
  // configured key, so an endpoint beyond that count is a stream of 401s.
  if (matching.length !== expected) {
    return failed(
      'stripe',
      name,
      `${matching.length} enabled endpoints at ${target} (expected ${expected} — ${
        expected === 1
          ? 'the API verifies one STRIPE_WEBHOOK_SECRET; set STRIPE_CONNECT_WEBHOOK_SECRET for a connected-account endpoint'
          : 'the API verifies STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET, one per endpoint'
      })`,
    );
  }

  // The two endpoints split the handled types between them (platform events on
  // one, connected accounts' on the other), so coverage is the union.
  const subscribed = new Set<unknown>(
    matching.flatMap((endpoint) => {
      const events = field(endpoint, 'enabled_events');
      return Array.isArray(events) ? events : [];
    }),
  );
  const missing = subscribed.has('*') ? [] : handled.filter((type) => !subscribed.has(type));

  return missing.length > 0
    ? failed('stripe', name, `missing ${missing.join(', ')}`)
    : passed('stripe', name, `${target} receives all ${handled.length} handled types`);
}

function accountResults(body: unknown): LaunchResult[] {
  const flag = (key: 'charges_enabled' | 'payouts_enabled'): LaunchResult => {
    const value = field(body, key);
    return judge('stripe', `stripe ${key}`, String(value), value === true, 'true');
  };
  const descriptor = field(body, 'settings', 'payments', 'statement_descriptor');
  const descriptorOk =
    isString(descriptor) &&
    descriptor.trim().length >= MIN_DESCRIPTOR_LENGTH &&
    !PLACEHOLDER_DESCRIPTOR.test(descriptor);
  const businessName = field(body, 'business_profile', 'name');

  return [
    flag('charges_enabled'),
    flag('payouts_enabled'),
    judge(
      'stripe',
      'stripe statement descriptor',
      isString(descriptor) && descriptor ? descriptor : 'unset',
      descriptorOk,
      'the name customers see on their card statement',
    ),
    judge(
      'stripe',
      'stripe business name',
      isString(businessName) && businessName ? businessName : 'unset',
      businessName === BRAND_NAME,
      BRAND_NAME,
    ),
  ];
}

function stripeProbes({ env, get, handledStripeEvents }: LaunchOptions): Probe[] {
  const auth = bearer(env.STRIPE_SECRET_KEY);

  return [
    {
      group: 'stripe',
      name: 'stripe key',
      run: async () => [liveKey('stripe', 'stripe key', env.STRIPE_SECRET_KEY)],
    },
    {
      group: 'stripe',
      name: 'stripe webhook endpoint',
      async run() {
        const target = `${originOf(env, 'API_URL')}/webhooks/stripe`;
        const reply = await get(`${STRIPE_API}/webhook_endpoints?limit=100`, auth);
        const connectConfigured = Boolean(env.STRIPE_CONNECT_WEBHOOK_SECRET);
        const subscription = webhookSubscription(
          reply,
          target,
          handledStripeEvents,
          connectConfigured ? 2 : 1,
        );
        const connectedName = 'stripe connected-account events';

        return [
          subscription,
          // The endpoint object does not expose whether it listens to connected
          // accounts, so the API cannot be asked. What it can be asked is
          // whether the second endpoint exists to carry them, and the key that
          // verifies it is configured: two secrets, two endpoints, and the
          // handled types covered between them.
          connectConfigured && subscription.status === 'PASS'
            ? passed(
                'stripe',
                connectedName,
                'a second endpoint exists and STRIPE_CONNECT_WEBHOOK_SECRET is set — confirm in the Dashboard that it is the one listening to connected accounts',
              )
            : {
                group: 'stripe',
                name: connectedName,
                status: 'MANUAL',
                detail: `confirm ${target} has a second endpoint listening to connected accounts, and put its signing secret in STRIPE_CONNECT_WEBHOOK_SECRET — vendor account.updated arrives only there`,
              },
        ];
      },
    },
    {
      group: 'stripe',
      name: 'stripe account',
      async run() {
        const reply = await get(`${STRIPE_API}/account`, auth);
        return accountResults(reply.body);
      },
    },
  ];
}

function resendProbes({ env, get }: LaunchOptions): Probe[] {
  const name = 'resend sending domain';

  return [
    {
      group: 'resend',
      name,
      async run() {
        // `EMAIL_FROM` may be a bare address or `Name <address>`.
        const domain = /@([^\s<>@]+)>?\s*$/.exec(env.EMAIL_FROM ?? '')?.[1];
        if (!domain) {
          return [failed('resend', name, 'EMAIL_FROM has no parseable address')];
        }

        const reply = await get(`${RESEND_API}/domains`, bearer(env.RESEND_API_KEY));
        // A least-privilege "sending access" key may not list domains; that is
        // the right key for production, not a misconfiguration.
        if (reply.status === HTTP_UNAUTHORIZED || reply.status === HTTP_FORBIDDEN) {
          return [
            {
              group: 'resend',
              name,
              status: 'MANUAL',
              detail: `RESEND_API_KEY cannot list domains (HTTP ${reply.status}) — confirm ${domain} is verified in the Resend dashboard`,
            },
          ];
        }

        const domains: unknown = field(reply.body, 'data');
        if (!Array.isArray(domains)) {
          return [failed('resend', name, `the domain list is unreadable (HTTP ${reply.status})`)];
        }

        const status = field(
          domains.find((entry) => field(entry, 'name') === domain),
          'status',
        );
        const found = `${domain} is ${isString(status) ? status : 'not in the Resend account'}`;
        return [judge('resend', name, found, status === 'verified', 'verified')];
      },
    },
  ];
}

export function providerProbes(options: LaunchOptions): Probe[] {
  return [...authProbes(options), ...stripeProbes(options), ...resendProbes(options)];
}
