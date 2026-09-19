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

const CLERK_API = 'https://api.clerk.com/v1';
const STRIPE_API = 'https://api.stripe.com/v1';
const RESEND_API = 'https://api.resend.com';
const LIVE_SECRET_PREFIX = 'sk_live_';
/** Stripe's own minimum for a statement descriptor. */
const MIN_DESCRIPTOR_LENGTH = 5;
const PLACEHOLDER_DESCRIPTOR = /\b(test|example|placeholder|todo|x{3,})\b/i;
const PUBLISHABLE_KEY = /^pk_(?:live|test)_([A-Za-z0-9+/=]+)$/;
const HOSTNAME = /^[a-z0-9.-]+$/i;
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

/** A publishable key is `pk_<mode>_` + base64 of the Frontend API host and a `$`. */
function frontendApiHost(publishableKey: string | undefined): string | null {
  const encoded = PUBLISHABLE_KEY.exec(publishableKey ?? '')?.[1];
  const host = encoded ? Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '') : '';

  return HOSTNAME.test(host) ? host : null;
}

function clerkProbes({ env, get }: LaunchOptions): Probe[] {
  const manualDeletion = (reason: string): LaunchResult => ({
    group: 'clerk',
    name: 'clerk self-serve deletion',
    status: 'MANUAL',
    detail: `${reason} — confirm Dashboard → User & authentication → "Allow users to delete their accounts" is off`,
  });

  return [
    {
      group: 'clerk',
      name: 'clerk key',
      run: async () => [liveKey('clerk', 'clerk key', env.CLERK_SECRET_KEY)],
    },
    {
      group: 'clerk',
      name: 'clerk instance',
      async run() {
        const reply = await get(`${CLERK_API}/instance`, bearer(env.CLERK_SECRET_KEY));
        const type = field(reply.body, 'environment_type');
        const found = isString(type) ? type : `no environment_type (HTTP ${reply.status})`;
        return [judge('clerk', 'clerk instance', found, type === 'production', 'production')];
      },
    },
    {
      // Clerk has no read API for its Svix endpoints, so the check holds the
      // declared endpoint the API already refuses to boot without to API_URL.
      group: 'clerk',
      name: 'clerk webhook endpoint',
      async run() {
        const expected = `${originOf(env, 'API_URL')}/webhooks/clerk`;
        const declared = env.CLERK_WEBHOOK_ENDPOINT?.trim();
        const found = `CLERK_WEBHOOK_ENDPOINT is ${declared || 'unset'}`;
        return [judge('clerk', 'clerk webhook endpoint', found, declared === expected, expected)];
      },
    },
    {
      group: 'clerk',
      name: 'clerk self-serve deletion',
      async run() {
        const host = frontendApiHost(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
        if (!host) {
          return [manualDeletion('the publishable key names no Frontend API host')];
        }

        const reply = await get(`https://${host}/v1/environment`);
        const deleteSelf = field(reply.body, 'user_settings', 'actions', 'delete_self');
        if (typeof deleteSelf !== 'boolean') {
          return [manualDeletion(`the instance settings are unreadable (HTTP ${reply.status})`)];
        }

        const found = `delete_self is ${deleteSelf ? 'on' : 'off'}`;
        return [judge('clerk', 'clerk self-serve deletion', found, !deleteSelf, 'off')];
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
  return [...clerkProbes(options), ...stripeProbes(options), ...resendProbes(options)];
}
