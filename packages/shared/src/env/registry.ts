import { BRAND_DOMAIN } from '../constants/brand.js';
import type { Capability } from './capabilities.js';

/** Where a value is read: the Node processes, or the browser bundle. */
export type Audience = 'server' | 'browser';

/**
 * Which surface reads a value. A variable that only `tooling` consumes — the
 * Neon branch name, the unpooled migration URL — must not become a boot
 * requirement for the API, so each surface derives its schema from this rather
 * than from the capability alone.
 */
export type Consumer = 'api' | 'web' | 'tooling';

/**
 * `shared` values are identical in every environment and ship as-is.
 * `per-environment` values differ between local development and production,
 * so `preflight --env production` refuses to accept the local default.
 */
export type EnvironmentScope = 'shared' | 'per-environment';

export interface EnvSetup {
  /** Where the operator obtains or configures the value. */
  readonly url: string;
  /** Literal commands or steps that produce a real value. */
  readonly steps: readonly string[];
}

export interface EnvVariable {
  readonly key: string;
  readonly capability: Capability;
  readonly audience: Audience;
  /** Surfaces that read this value. Never empty. */
  readonly consumers: readonly Consumer[];
  readonly environments: EnvironmentScope;
  /**
   * Syntax a real value must match. Absent for genuinely free-form values such
   * as `EMAIL_FROM`; presence and non-placeholder checks still apply.
   */
  readonly shape?: RegExp;
  /** Stricter syntax applied only by `--env production`. Defaults to `shape`. */
  readonly productionShape?: RegExp;
  /**
   * The literal stand-in written to `.env.example` for a value the operator
   * must supply. Every placeholder must fail its own `shape` — that property is
   * what makes the gate work, and `registry.test.ts` asserts it.
   */
  readonly placeholder?: string;
  /** A working value, written to `.env.example` verbatim. Mutually exclusive with `placeholder`. */
  readonly defaultValue?: string;
  readonly description: string;
  readonly setup: EnvSetup;
}

const NEON_SETUP: EnvSetup = {
  url: 'https://neon.com/docs/reference/cli-branches',
  steps: [
    'npm i -g neonctl',
    'neon auth',
    'neon branches create --name dev',
    'neon connection-string dev',
  ],
};

const APP_SETUP: EnvSetup = {
  url: 'https://github.com/hmalik-dev/vendor-marketplace#readme',
  steps: ['cp .env.example .env'],
};

const CLERK_SETUP: EnvSetup = {
  url: 'https://dashboard.clerk.com/last-active?path=api-keys',
  steps: ['Open the Clerk dashboard → API keys', 'Copy the key into .env'],
};

const CLERK_WEBHOOK_SETUP: EnvSetup = {
  url: 'https://dashboard.clerk.com/last-active?path=webhooks',
  steps: [
    'Open the Clerk dashboard → Configure → Webhooks → your endpoint → Signing Secret',
    'Local relay: clerk webhooks listen --forward-to http://localhost:4000/webhooks/clerk',
  ],
};

const MINIO_SETUP: EnvSetup = {
  url: 'https://developers.cloudflare.com/r2/api/s3/tokens/',
  steps: [
    'docker compose up -d storage',
    'Production: Cloudflare dashboard → R2 → Manage API tokens',
  ],
};

const STRIPE_SETUP: EnvSetup = {
  url: 'https://dashboard.stripe.com/test/apikeys',
  steps: [
    'brew install stripe/stripe-cli/stripe',
    'stripe login',
    'Open the Stripe dashboard → Developers → API keys',
  ],
};

const STRIPE_WEBHOOK_SETUP: EnvSetup = {
  url: 'https://dashboard.stripe.com/test/webhooks',
  steps: [
    'stripe listen --forward-to localhost:4000/webhooks/stripe',
    'Copy the printed `whsec_...` into STRIPE_WEBHOOK_SECRET',
  ],
};

const RESEND_SETUP: EnvSetup = {
  url: 'https://resend.com/api-keys',
  steps: ['Open Resend → API Keys → Create API Key'],
};

const SENTRY_SETUP: EnvSetup = {
  url: 'https://sentry.io/settings/projects/',
  steps: ['Open Sentry → Project → Client Keys (DSN)'],
};

const HTTP_URL = /^https?:\/\/[^\s,]+$/;
const HTTPS_URL = /^https:\/\/[^\s,]+$/;
/**
 * `WEB_URL` doubles as the CORS allow-list, so it accepts a comma-separated
 * list. Surrounding whitespace and a trailing comma are tolerated here because
 * `allowedOrigins` normalises them — the shape must not reject input the code
 * deliberately accepts.
 */
const HTTP_URL_LIST = /^\s*https?:\/\/[^\s,]+\s*(,\s*https?:\/\/[^\s,]+\s*)*,?\s*$/;
const HTTPS_URL_LIST = /^\s*https:\/\/[^\s,]+\s*(,\s*https:\/\/[^\s,]+\s*)*,?\s*$/;
const APP_PATH = /^\/[A-Za-z0-9\-_/[\]]*$/;
/** user:password@host/database — the placeholder form has no credentials and fails it. */
const POSTGRES_URL = /^postgres(ql)?:\/\/[^:@\s/]+:[^@\s/]+@[^\s/]+\/[^\s?]+/;

/**
 * The single declarative list of every variable `.env` carries. `.env.example`,
 * `turbo.json`'s passthrough array, the API's Zod schema, the web build-time
 * check, and preflight are all derived from it, so the four copies that used to
 * drift cannot disagree any more.
 *
 * The end-to-end test account lives in the gitignored `.env.e2e.local` and is
 * deliberately absent here: this list is the contract for `.env` alone.
 */
export const ENV_REGISTRY = [
  // --- core ----------------------------------------------------------------
  {
    key: 'NODE_ENV',
    capability: 'core',
    audience: 'server',
    consumers: ['api', 'web', 'tooling'],
    environments: 'per-environment',
    shape: /^(development|test|production)$/,
    productionShape: /^production$/,
    defaultValue: 'development',
    description: 'Runtime mode for every Node process in the workspace.',
    setup: APP_SETUP,
  },
  {
    key: 'WEB_URL',
    capability: 'core',
    audience: 'server',
    // `web` reads its own origin for `metadataBase`, the sitemap and robots:
    // every absolute URL a crawler or a link preview sees is built from it, so
    // it is the same value the API allow-lists rather than a second one that
    // could disagree.
    consumers: ['api', 'web', 'tooling'],
    environments: 'per-environment',
    shape: HTTP_URL_LIST,
    productionShape: HTTPS_URL_LIST,
    defaultValue: 'http://localhost:3000',
    description: 'Public origin of the Next.js frontend; also the API CORS allow-list.',
    setup: APP_SETUP,
  },
  {
    key: 'API_URL',
    capability: 'core',
    audience: 'server',
    consumers: ['web'],
    environments: 'per-environment',
    shape: HTTP_URL,
    productionShape: HTTPS_URL,
    defaultValue: 'http://localhost:4000',
    description: 'Fastify API origin, used server-side by apps/web.',
    setup: APP_SETUP,
  },
  {
    key: 'NEXT_PUBLIC_API_URL',
    capability: 'core',
    audience: 'browser',
    consumers: ['web'],
    environments: 'per-environment',
    shape: HTTP_URL,
    productionShape: HTTPS_URL,
    defaultValue: 'http://localhost:4000',
    description: 'Fastify API origin, used in the browser by apps/web.',
    setup: APP_SETUP,
  },
  {
    key: 'PORT',
    capability: 'core',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^\d{1,5}$/,
    defaultValue: '4000',
    description: 'Port the Fastify API listens on.',
    setup: APP_SETUP,
  },
  {
    key: 'HOST',
    capability: 'core',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^[^\s]+$/,
    defaultValue: '0.0.0.0',
    description: 'Interface the Fastify API binds to.',
    setup: APP_SETUP,
  },
  {
    key: 'LOG_LEVEL',
    capability: 'core',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^(fatal|error|warn|info|debug|trace|silent)$/,
    defaultValue: 'info',
    description: 'Pino level for the API.',
    setup: APP_SETUP,
  },
  {
    key: 'RATE_LIMIT_MAX',
    capability: 'core',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^\d+$/,
    defaultValue: '120',
    description: 'Requests per minute, per IP, before the API replies 429.',
    setup: APP_SETUP,
  },
  {
    key: 'DATABASE_URL',
    capability: 'core',
    audience: 'server',
    consumers: ['api', 'tooling'],
    environments: 'per-environment',
    shape: POSTGRES_URL,
    placeholder: 'postgresql://...',
    description: 'Pooled Neon connection (PgBouncer) — application query traffic.',
    setup: NEON_SETUP,
  },
  {
    key: 'DATABASE_URL_UNPOOLED',
    capability: 'core',
    audience: 'server',
    consumers: ['tooling'],
    environments: 'per-environment',
    shape: POSTGRES_URL,
    placeholder: 'postgresql://...',
    description: 'Direct Neon connection — migrations, drizzle-kit, pg_dump.',
    setup: NEON_SETUP,
  },
  {
    key: 'NEON_BRANCH',
    capability: 'core',
    audience: 'server',
    consumers: ['tooling'],
    environments: 'per-environment',
    shape: /^[A-Za-z0-9][A-Za-z0-9\-_/.]*$/,
    productionShape: /^production$/,
    // Per-developer, and read by nothing but the safety check — so it carries a
    // placeholder rather than a default: silently assuming a branch is exactly
    // how local work ends up writing to production data.
    placeholder: '<your-neon-branch>',
    description:
      'Neon branch the connection strings point at. Local development must never be `production`.',
    setup: NEON_SETUP,
  },

  // --- auth ----------------------------------------------------------------
  {
    key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    capability: 'auth',
    audience: 'browser',
    consumers: ['web'],
    environments: 'per-environment',
    shape: /^pk_(test|live)_[A-Za-z0-9$/+=]{16,}$/,
    productionShape: /^pk_live_[A-Za-z0-9$/+=]{16,}$/,
    placeholder: 'pk_test_...',
    description: 'Clerk publishable key, read by the browser bundle.',
    setup: CLERK_SETUP,
  },
  {
    key: 'CLERK_SECRET_KEY',
    capability: 'auth',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^sk_(test|live)_[A-Za-z0-9]{16,}$/,
    productionShape: /^sk_live_[A-Za-z0-9]{16,}$/,
    placeholder: 'sk_test_...',
    description: 'Clerk secret key used by the API to verify session tokens.',
    setup: CLERK_SETUP,
  },
  {
    key: 'CLERK_WEBHOOK_SECRET',
    capability: 'auth',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^whsec_[A-Za-z0-9+/=]{16,}$/,
    placeholder: 'whsec_...',
    description: 'svix signing secret for POST /webhooks/clerk.',
    setup: CLERK_WEBHOOK_SETUP,
  },
  {
    key: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    capability: 'auth',
    audience: 'browser',
    consumers: ['web'],
    environments: 'shared',
    shape: APP_PATH,
    defaultValue: '/sign-in',
    description: 'Route rendering the hosted sign-in component.',
    setup: CLERK_SETUP,
  },
  {
    key: 'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
    capability: 'auth',
    audience: 'browser',
    consumers: ['web'],
    environments: 'shared',
    shape: APP_PATH,
    defaultValue: '/sign-up',
    description: 'Route rendering the hosted sign-up component.',
    setup: CLERK_SETUP,
  },
  {
    key: 'NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL',
    capability: 'auth',
    audience: 'browser',
    consumers: ['web'],
    environments: 'shared',
    shape: APP_PATH,
    defaultValue: '/after-sign-in',
    description: 'Where sign-in lands when no redirect was requested.',
    setup: CLERK_SETUP,
  },
  {
    key: 'NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL',
    capability: 'auth',
    audience: 'browser',
    consumers: ['web'],
    environments: 'shared',
    shape: APP_PATH,
    defaultValue: '/after-sign-in',
    description: 'Where sign-up lands when no redirect was requested.',
    setup: CLERK_SETUP,
  },

  // --- storage -------------------------------------------------------------
  {
    key: 'S3_ENDPOINT',
    capability: 'storage',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: HTTP_URL,
    productionShape: HTTPS_URL,
    defaultValue: 'http://localhost:9000',
    description: 'S3 API endpoint — the MinIO compose service locally, R2 in production.',
    setup: MINIO_SETUP,
  },
  {
    key: 'S3_ACCESS_KEY_ID',
    capability: 'storage',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^[A-Za-z0-9_-]{4,}$/,
    defaultValue: 'vendor-marketplace',
    description: 'S3 access key id.',
    setup: MINIO_SETUP,
  },
  {
    key: 'S3_SECRET_ACCESS_KEY',
    capability: 'storage',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^[A-Za-z0-9_+/=-]{8,}$/,
    defaultValue: 'vendor_marketplace_dev',
    description: 'S3 secret access key.',
    setup: MINIO_SETUP,
  },
  {
    key: 'S3_BUCKET',
    capability: 'storage',
    audience: 'server',
    consumers: ['api', 'tooling'],
    environments: 'per-environment',
    shape: /^[a-z0-9][a-z0-9.-]{2,62}$/,
    defaultValue: 'vendor-marketplace-uploads',
    description: 'Bucket uploads are written to.',
    setup: MINIO_SETUP,
  },
  {
    key: 'S3_PUBLIC_URL',
    capability: 'storage',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: HTTP_URL,
    productionShape: HTTPS_URL,
    defaultValue: 'http://localhost:9000/vendor-marketplace-uploads',
    description: 'Public base URL uploaded objects are served from, with no trailing slash.',
    setup: MINIO_SETUP,
  },
  {
    key: 'S3_FORCE_PATH_STYLE',
    capability: 'storage',
    audience: 'server',
    consumers: ['api', 'tooling'],
    environments: 'shared',
    shape: /^(true|false)$/,
    defaultValue: 'true',
    description: 'R2 and MinIO both address buckets by path rather than by subdomain.',
    setup: MINIO_SETUP,
  },

  // --- stripe --------------------------------------------------------------
  {
    key: 'STRIPE_SECRET_KEY',
    capability: 'stripe',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^sk_(test|live)_[A-Za-z0-9]{16,}$/,
    productionShape: /^sk_live_[A-Za-z0-9]{16,}$/,
    placeholder: 'sk_test_...',
    description: 'Stripe secret key used by the API for Connect and PaymentIntents.',
    setup: STRIPE_SETUP,
  },
  {
    key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    capability: 'stripe',
    audience: 'browser',
    consumers: ['web'],
    environments: 'per-environment',
    shape: /^pk_(test|live)_[A-Za-z0-9]{16,}$/,
    productionShape: /^pk_live_[A-Za-z0-9]{16,}$/,
    placeholder: 'pk_test_...',
    description: 'Stripe publishable key, read by the browser bundle.',
    setup: STRIPE_SETUP,
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    capability: 'stripe',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^whsec_[A-Za-z0-9+/=]{16,}$/,
    placeholder: 'whsec_...',
    description: 'Signing secret for POST /webhooks/stripe.',
    setup: STRIPE_WEBHOOK_SETUP,
  },
  {
    key: 'STRIPE_PLATFORM_FEE_RATE',
    capability: 'stripe',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^0\.\d{1,4}$/,
    defaultValue: '0.12',
    description: 'Platform commission as a decimal fraction (0.12 = 12%).',
    setup: STRIPE_SETUP,
  },

  // --- email ---------------------------------------------------------------
  {
    key: 'RESEND_API_KEY',
    capability: 'email',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^re_[A-Za-z0-9_]{16,}$/,
    placeholder: 're_...',
    description: 'Resend API key for transactional email.',
    setup: RESEND_SETUP,
  },
  {
    key: 'EMAIL_FROM',
    capability: 'email',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    defaultValue: `noreply@${BRAND_DOMAIN}`,
    description: 'From address on every transactional email. Free-form; no shape is enforced.',
    setup: RESEND_SETUP,
  },

  // --- sentry --------------------------------------------------------------
  {
    key: 'SENTRY_DSN',
    capability: 'sentry',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]+\/\d+$/,
    placeholder: 'https://...@sentry.io/...',
    description: 'Sentry DSN the API reports errors to.',
    setup: SENTRY_SETUP,
  },
] as const satisfies readonly EnvVariable[];

/**
 * The registry is a `const` tuple, not a widened array, so the key of every row
 * survives as a literal type. That is what lets `registrySchemaShape` hand the
 * API and the web build a Zod shape with real keys instead of an index
 * signature — a widened array would infer every derived value as `any`.
 */
export type RegistryEntry = (typeof ENV_REGISTRY)[number];

/** Rows a consumer reads within a set of capabilities. */
export type RegistryEntryFor<TConsumer extends Consumer, TCapability extends Capability> =
  Extract<RegistryEntry, { capability: TCapability }> extends infer TEntry
    ? TEntry extends { readonly consumers: readonly Consumer[] }
      ? TConsumer extends TEntry['consumers'][number]
        ? TEntry
        : never
      : never
    : never;

/** Keys one consumer reads within a set of capabilities. */
export type RegistryKey<TConsumer extends Consumer, TCapability extends Capability> =
  RegistryEntryFor<TConsumer, TCapability> extends { readonly key: infer TKey } ? TKey : never;

/**
 * Whether a value must be stated rather than fallen back into.
 *
 * A row with a default is defaulted by the apps themselves, so its absence is
 * not a misconfiguration — except in production, where a value that differs per
 * environment silently defaulting to a localhost URL is exactly the failure
 * this contract exists to prevent. Preflight's environment check and the API
 * and web schemas all derive from this one rule.
 */
export function requiresExplicitValue(
  variable: EnvVariable,
  target: 'local' | 'production',
): boolean {
  return (
    variable.defaultValue === undefined ||
    (target === 'production' && variable.environments === 'per-environment')
  );
}

/** The value `.env.example` carries for a row. */
export function exampleValue(variable: EnvVariable): string {
  return variable.defaultValue ?? variable.placeholder ?? '';
}

/** The syntax a value must match in the given target environment. */
export function shapeFor(
  variable: EnvVariable,
  target: 'local' | 'production',
): RegExp | undefined {
  return target === 'production' ? (variable.productionShape ?? variable.shape) : variable.shape;
}

const BY_KEY = new Map<string, EnvVariable>(
  ENV_REGISTRY.map((variable) => [variable.key, variable]),
);

export function findVariable(key: string): EnvVariable | undefined {
  return BY_KEY.get(key);
}
