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
  /**
   * Where the *live-mode* value comes from, when that is a different page.
   * Without it, `--env production` tells the operator they need a live key and
   * then links them to the one page that only issues test keys.
   */
  readonly productionUrl?: string;
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
  /**
   * Stricter syntax applied only by `--env local`. Defaults to `shape`. The
   * mirror of `productionShape`: a credential whose prefix names an
   * environment must not be usable against the other one, and the dangerous
   * direction is the one that points real money and a real user directory at a
   * laptop.
   */
  readonly localShape?: RegExp;
  /** Stricter syntax applied only by `--env production`. Defaults to `shape`. */
  readonly productionShape?: RegExp;
  /**
   * Targets where absence is correct rather than missing.
   *
   * Distinct from `defaultValue`, which means "the apps fall back to this".
   * These rows have no fallback and need none: they describe a Neon deployment,
   * and local development runs on the Docker Postgres in `docker-compose.yml`,
   * where there is no pooler to bypass and no branch to name. Production still
   * requires them — see ticket #200.
   */
  readonly optionalFor?: readonly ShapeTarget[];
  /**
   * What each target's mode is called, for a credential that carries one in its
   * prefix. Preflight reports "is a live key" instead of printing a regex — an
   * operator shown a regex pastes the same key back.
   */
  readonly modes?: { readonly local: string; readonly production: string };
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

/** Stripe names the environment a credential belongs to in its prefix. */
const TEST_LIVE_MODES = { local: 'test', production: 'live' } as const;

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

const NEON_AUTH_SETUP: EnvSetup = {
  url: 'https://neon.com/docs/auth/overview',
  steps: [
    'Enable Auth on the Neon branch (Project → Branch → Auth)',
    'Copy the branch Auth URL into NEON_AUTH_BASE_URL',
    'Generate the cookie secret: openssl rand -base64 32',
    'Copy the branch connection string into NEON_AUTH_DATABASE_URL: neon connection-string <branch> (name the branch positionally; --branch-id defaults to production)',
  ],
};

const STORAGE_SETUP: EnvSetup = {
  url: 'https://neon.com/docs/storage/overview',
  steps: [
    'Locally: docker compose up -d storage',
    'Deployed: declare the `uploads` bucket (public_read) in neon.ts, run `neon deploy` on the branch, and map its injected AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION onto the STORAGE_* keys',
  ],
};

const STRIPE_SETUP: EnvSetup = {
  url: 'https://dashboard.stripe.com/test/apikeys',
  productionUrl: 'https://dashboard.stripe.com/apikeys',
  steps: [
    'brew install stripe/stripe-cli/stripe',
    'stripe login',
    'Open the Stripe dashboard → Developers → API keys',
  ],
};

/*
 * All four streams. A v2 connected account announces itself on the v1 **snapshot
 * Connect** stream — probed 2026-08-30, an onboarding attempt emitted three v1
 * events and no thin one, because thin `v2.core.*` delivery needs an event
 * destination provisioned separately. Forwarding only one stream is a lane that
 * watches onboarding finish and the vendor stay blocked, with nothing in either
 * log to say why.
 */
const STRIPE_WEBHOOK_SETUP: EnvSetup = {
  url: 'https://dashboard.stripe.com/test/webhooks',
  steps: [
    'stripe listen --forward-to localhost:4000/webhooks/stripe --forward-connect-to localhost:4000/webhooks/stripe --forward-thin-to localhost:4000/webhooks/stripe --forward-thin-connect-to localhost:4000/webhooks/stripe',
    'Copy the printed `whsec_...` into STRIPE_WEBHOOK_SECRET — it is minted per listener, so a stale one in `.env` makes every delivery 401',
  ],
};

const STRIPE_CONNECT_WEBHOOK_SETUP: EnvSetup = {
  url: 'https://dashboard.stripe.com/webhooks',
  steps: [
    'Add a second endpoint at the same /webhooks/stripe URL with "Listen to events on Connected accounts" selected',
    "Copy that endpoint's signing secret (`whsec_...`) into STRIPE_CONNECT_WEBHOOK_SECRET",
  ],
};

const RESEND_SETUP: EnvSetup = {
  url: 'https://resend.com/api-keys',
  steps: ['Open Resend → API Keys → Create API Key'],
};

const RESEND_WEBHOOK_SETUP: EnvSetup = {
  url: 'https://resend.com/webhooks',
  steps: [
    'Open Resend → Webhooks → Add Webhook, pointing at <API origin>/webhooks/resend',
    'Subscribe to email.delivered, email.bounced and email.complained — the three #439 records',
    'Copy the printed `whsec_...` into RESEND_WEBHOOK_SECRET',
    'Optional everywhere: without it the endpoint refuses every delivery and the attempt rows still stand',
  ],
};

const SENTRY_SETUP: EnvSetup = {
  url: 'https://sentry.io/settings/projects/',
  steps: [
    'Open Sentry → Project → Client Keys (DSN)',
    'Leave it unset locally: a laptop that reports into the production project pollutes its error budget',
  ],
};

const SENTRY_UPLOAD_SETUP: EnvSetup = {
  url: 'https://sentry.io/orgredirect/organizations/:orgslug/settings/auth-tokens/',
  steps: [
    'Open Sentry → Settings → Auth Tokens → Create New Token (an organization token carries the org)',
    'Set it, with the web project slug, where the production web build runs — the deploy workflow',
  ],
};

/** A DSN names a public key, an ingest host and a numeric project. */
const SENTRY_DSN_SHAPE = /^https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]+\/\d+$/;

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
/** user:password@host/database — the placeholder form has no credentials and fails it. */
const POSTGRES_URL = /^postgres(ql)?:\/\/[^:@\s/]+:[^@\s/]+@[^\s/]+\/[^\s?]+/;
/**
 * VEN-609. The same URL, demanding TLS in its query, for `preflight --env
 * production`. Nothing in the app sets `ssl`, so the connection string is where
 * TLS is required; Neon's own strings carry `sslmode=require`. The driver reads
 * the last `sslmode` and never the fragment, so a later `sslmode`, a `#` or a
 * percent-encoded query cannot sit beside the one that passes.
 */
const POSTGRES_TLS_URL = new RegExp(
  `^(?![^#]*#)${POSTGRES_URL.source.slice(1)}\\?(?:[^\\s%&]*&)*sslmode=(?:require|verify-full)(?:&(?!sslmode=)[^\\s%&]*)*$`,
);

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
    /*
     * Which tier this process is: the one fact `NODE_ENV` and the platform
     * markers cannot carry, because a deployed staging and production look
     * identical to both. `per-environment` with a `local` default is what makes
     * the law fall out of the existing machinery: a laptop needs nothing, and a
     * deployed target refuses to boot without an explicit answer rather than
     * quietly claiming to be production (or anything else).
     *
     * Explicit rather than derived from `VERCEL_ENV`: the API host is not
     * Vercel, and a derived value is the silent fallback this row exists to
     * remove. Everything that must behave differently outside production — the
     * email sink, the live-key boot guard, the Sentry environment — reads this.
     */
    key: 'DEPLOY_ENV',
    capability: 'core',
    audience: 'server',
    consumers: ['api', 'web', 'tooling'],
    environments: 'per-environment',
    shape: /^(local|staging|production)$/,
    productionShape: /^production$/,
    defaultValue: 'local',
    description:
      'The tier this process serves: local, staging or production. Required on every deployment; only production may hold a live Stripe key or email a real recipient.',
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
    key: 'CSP_ENFORCE',
    capability: 'core',
    audience: 'server',
    consumers: ['web'],
    environments: 'shared',
    shape: /^[01]$/,
    defaultValue: '0',
    description:
      'Set to 1 to send Content-Security-Policy instead of Content-Security-Policy-Report-Only from a non-production apps/web. Production always enforces. Read at build time by next.config.ts; a browser pass under report-only cannot fail on a blocked origin, so any pass over checkout, sign-in or upload runs with this on.',
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
    /*
     * `next dev` reads `PORT` too, and `PORT` belongs to the API. Inside a lane
     * that made the web app bind the lane's API port and the API die with
     * EADDRINUSE (#231), so `apps/web`'s dev script passes `--port` explicitly
     * whenever this is set — and omits the flag entirely when it is not, which
     * is what keeps Next's own retry-to-the-next-free-port behaviour outside a
     * lane.
     *
     * `tooling`, because no application process reads it: the dev script does,
     * in the shell, before Next boots. That is also why the row exists at all —
     * `globalPassThroughEnv` is generated from this registry, and Turborepo
     * strips any variable missing from it, which would leave every lane's web
     * app back on the default port.
     */
    key: 'WEB_PORT',
    capability: 'core',
    audience: 'server',
    consumers: ['tooling'],
    environments: 'shared',
    shape: /^\d{1,5}$/,
    defaultValue: '3000',
    description:
      'Port the Next.js dev server binds. Exported by `pnpm lane:up` into the lane environment; setting it in this file has no effect, because the dev script reads it from the shell before Next loads .env.',
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
    key: 'UPLOAD_RATE_LIMIT_MAX',
    capability: 'core',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^\d+$/,
    defaultValue: '10',
    description: 'Image uploads per minute, per signed-in account, before the API replies 429.',
    setup: APP_SETUP,
  },
  {
    key: 'MESSAGE_RATE_LIMIT_MAX',
    capability: 'core',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^\d+$/,
    defaultValue: '60',
    description: 'Messages sent per minute, per signed-in account, before the API replies 429.',
    setup: APP_SETUP,
  },
  {
    key: 'CONVERSATION_RATE_LIMIT_MAX',
    capability: 'core',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^\d+$/,
    defaultValue: '20',
    description:
      'Conversations opened per hour, per signed-in account, before the API replies 429.',
    setup: APP_SETUP,
  },
  {
    key: 'BOOKING_REQUEST_RATE_LIMIT_MAX',
    capability: 'core',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^\d+$/,
    defaultValue: '20',
    description:
      'Booking requests created per hour, per signed-in account, before the API replies 429.',
    setup: APP_SETUP,
  },
  {
    key: 'UPLOAD_OBJECT_LIMIT',
    capability: 'core',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^\d+$/,
    defaultValue: '200',
    description:
      'Uploaded images one account may hold in storage; the next upload answers 409 until one is deleted.',
    setup: APP_SETUP,
  },
  {
    key: 'WEB_TIER_KEY',
    capability: 'core',
    audience: 'server',
    consumers: ['api', 'web'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local'],
    shape: /^[A-Za-z0-9_-]{32,}$/,
    placeholder: 'openssl-rand-hex-32-...',
    description:
      "Shared between the web app and the API so the API can key its rate limit on the visitor the web tier forwards rather than on the web platform's one egress address. Required on a deployment: without it every visitor shares one address and the per-IP limit counts them as one. Optional locally. A different value per environment (VEN-649): a key leaked from staging must not let anyone choose the address production's rate limiter counts.",
    setup: APP_SETUP,
  },
  {
    key: 'DATABASE_URL',
    capability: 'core',
    audience: 'server',
    consumers: ['api', 'tooling'],
    environments: 'per-environment',
    shape: POSTGRES_URL,
    productionShape: POSTGRES_TLS_URL,
    placeholder: 'postgresql://...',
    description:
      'Postgres for this environment — the local Docker service in development, a pooled Neon branch in staging and production.',
    setup: NEON_SETUP,
  },
  {
    key: 'DATABASE_URL_UNPOOLED',
    capability: 'core',
    audience: 'server',
    consumers: ['tooling'],
    optionalFor: ['baseline', 'local'],
    environments: 'per-environment',
    shape: POSTGRES_URL,
    productionShape: POSTGRES_TLS_URL,
    placeholder: 'postgresql://...',
    description:
      'Direct unpooled connection for migrations, drizzle-kit and pg_dump. Neon only; leave unset locally, where there is no PgBouncer to bypass.',
    setup: NEON_SETUP,
  },
  {
    key: 'NEON_BRANCH',
    capability: 'core',
    audience: 'server',
    consumers: ['tooling'],
    optionalFor: ['baseline', 'local'],
    environments: 'per-environment',
    shape: /^[A-Za-z0-9][A-Za-z0-9\-_/.]*$/,
    productionShape: /^production$/,
    // Per-developer, and read by nothing but the safety check — so it carries a
    // placeholder rather than a default: silently assuming a branch is exactly
    // how local work ends up writing to production data.
    placeholder: '<your-neon-branch>',
    description:
      'Neon branch the connection strings point at, when they point at Neon at all. Unset for local Docker development; never `production`.',
    setup: NEON_SETUP,
  },

  // --- auth ----------------------------------------------------------------
  {
    key: 'NEON_AUTH_BASE_URL',
    capability: 'auth',
    audience: 'server',
    consumers: ['api', 'web'],
    environments: 'per-environment',
    shape: HTTPS_URL,
    placeholder: '<neon-auth-base-url>',
    description:
      "The Neon Auth endpoint of the branch this deployment's users live on; the API verifies session tokens against its JWKS and the web proxies sign-in to it.",
    setup: NEON_AUTH_SETUP,
  },
  {
    key: 'NEON_AUTH_COOKIE_SECRET',
    capability: 'auth',
    audience: 'server',
    consumers: ['web'],
    environments: 'per-environment',
    shape: /^[A-Za-z0-9+/=_-]{32,}$/,
    placeholder: '<openssl rand -base64 32>',
    description: 'Signs the cached Neon Auth session cookie of the web app.',
    setup: NEON_AUTH_SETUP,
  },
  {
    key: 'NEON_AUTH_DATABASE_URL',
    capability: 'auth',
    audience: 'server',
    consumers: ['api'],
    optionalFor: ['baseline', 'local'],
    environments: 'per-environment',
    shape: POSTGRES_URL,
    placeholder: 'postgresql://...',
    description:
      "Connection to the database holding the branch's `neon_auth` schema: the reconcile pass reads identities over it and an account closure deletes one. Neon only — on the Neon branch it is the same database as DATABASE_URL. Leave unset in a lane, where the app database is local Docker while the identities live on a Neon branch; a closure then reports the identity as not deleted.",
    setup: NEON_AUTH_SETUP,
  },

  // --- storage -------------------------------------------------------------
  {
    key: 'STORAGE_ENDPOINT',
    capability: 'storage',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: HTTP_URL,
    productionShape: HTTPS_URL,
    defaultValue: 'http://localhost:9000',
    description:
      "S3 API endpoint — the local S3 emulator in development, the branch's Neon Object Storage endpoint when deployed.",
    setup: STORAGE_SETUP,
  },
  {
    key: 'STORAGE_ACCESS_KEY_ID',
    capability: 'storage',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^[A-Za-z0-9_-]{4,}$/,
    defaultValue: 'vendor-marketplace',
    description: 'S3 access key id for the uploads bucket.',
    setup: STORAGE_SETUP,
  },
  {
    key: 'STORAGE_SECRET_ACCESS_KEY',
    capability: 'storage',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^[A-Za-z0-9_+/=-]{8,}$/,
    defaultValue: 'vendor_marketplace_dev',
    description: 'S3 secret access key for the uploads bucket.',
    setup: STORAGE_SETUP,
  },
  {
    key: 'STORAGE_BUCKET',
    capability: 'storage',
    audience: 'server',
    consumers: ['api', 'tooling'],
    environments: 'per-environment',
    shape: /^[a-z0-9][a-z0-9.-]{2,62}$/,
    defaultValue: 'vendor-marketplace-uploads',
    description: 'Bucket uploads are written to.',
    setup: STORAGE_SETUP,
  },
  {
    key: 'STORAGE_PUBLIC_URL',
    capability: 'storage',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: HTTP_URL,
    productionShape: HTTPS_URL,
    defaultValue: 'http://localhost:9000/vendor-marketplace-uploads',
    description: 'Public base URL uploaded objects are served from, with no trailing slash.',
    setup: STORAGE_SETUP,
  },
  {
    /*
     * The same base, readable in the browser.
     *
     * The image columns hold object keys, never this base: the API strips it
     * from a reference written as a URL, and migration `0085` converted the
     * rows written before that (VEN-648). So a URL is built at the render
     * boundary — and some of those renders happen in client components (the
     * upload preview, the message avatars). Both halves must resolve to the
     * same host, which is why this mirrors `STORAGE_PUBLIC_URL` rather than being a
     * second setting: a mismatch would split the images across two hosts,
     * which is exactly what storing keys exists to prevent.
     */
    key: 'NEXT_PUBLIC_STORAGE_PUBLIC_URL',
    capability: 'storage',
    audience: 'browser',
    consumers: ['web'],
    environments: 'per-environment',
    shape: HTTP_URL,
    productionShape: HTTPS_URL,
    defaultValue: 'http://localhost:9000/vendor-marketplace-uploads',
    description: 'Public base URL for images, mirroring STORAGE_PUBLIC_URL for the browser.',
    setup: STORAGE_SETUP,
  },
  {
    key: 'STORAGE_REGION',
    capability: 'storage',
    audience: 'server',
    consumers: ['api', 'tooling'],
    environments: 'per-environment',
    shape: /^[a-z0-9-]{3,32}$/,
    defaultValue: 'auto',
    description:
      "Signing region: Neon's injected AWS_REGION (the region of the branch's storage host); the local emulator accepts any value.",
    setup: STORAGE_SETUP,
  },
  {
    key: 'STORAGE_FORCE_PATH_STYLE',
    capability: 'storage',
    audience: 'server',
    consumers: ['api', 'tooling'],
    environments: 'shared',
    shape: /^(true|false)$/,
    defaultValue: 'true',
    description:
      'Neon Object Storage and the local emulator address buckets by path, not by subdomain.',
    setup: STORAGE_SETUP,
  },

  // --- stripe --------------------------------------------------------------
  {
    key: 'STRIPE_SECRET_KEY',
    capability: 'stripe',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    shape: /^sk_(test|live)_[A-Za-z0-9]{16,}$/,
    localShape: /^sk_test_[A-Za-z0-9]{16,}$/,
    productionShape: /^sk_live_[A-Za-z0-9]{16,}$/,
    modes: TEST_LIVE_MODES,
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
    localShape: /^pk_test_[A-Za-z0-9]{16,}$/,
    productionShape: /^pk_live_[A-Za-z0-9]{16,}$/,
    modes: TEST_LIVE_MODES,
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
    description:
      "Signing secret for POST /webhooks/stripe, for the endpoint that receives the platform account's own events.",
    setup: STRIPE_WEBHOOK_SETUP,
  },
  {
    /*
     * The second endpoint's secret. A Stripe endpoint listens either to the
     * platform's events or to connected accounts', and each signs with its own
     * secret, so vendor `account.updated` cannot reach an endpoint that also
     * receives `payment_intent.succeeded`. The API accepts a delivery signed
     * with either key.
     *
     * Optional only off a deployment: locally one `stripe listen` forwards
     * every stream under the single listener secret above. A deployment
     * refuses to boot without it, because without the connected-account
     * endpoint no vendor's onboarding ever completes.
     */
    key: 'STRIPE_CONNECT_WEBHOOK_SECRET',
    capability: 'stripe',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local'],
    shape: /^whsec_[A-Za-z0-9+/=]{16,}$/,
    placeholder: 'whsec_...',
    description:
      "Signing secret for the second POST /webhooks/stripe endpoint, the one that receives connected accounts' events. Required on a deployment; locally the single listener secret covers both streams.",
    setup: STRIPE_CONNECT_WEBHOOK_SETUP,
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
    /*
     * Signing secret for `POST /webhooks/resend` (#439). Required on a
     * deployment: without it a bounce or complaint is never learned, so a real
     * user's failed invite or booking email is invisible to the operator. A
     * laptop has no public URL for Resend to call, so it stays optional there.
     *
     * The property that must survive any change here is that **absence is
     * refusal, not permission**: no handler exists without a verified secret.
     * `server.ts` registers `POST /webhooks/resend` only when this row has a
     * value, so an unconfigured laptop has no endpoint at all rather than a
     * permissive one — a fallback that let an unsigned event through would be
     * an unauthenticated writer on the delivery record.
     */
    key: 'RESEND_WEBHOOK_SECRET',
    capability: 'email',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local'],
    shape: /^whsec_[A-Za-z0-9+/=]{16,}$/,
    placeholder: 'whsec_...',
    description:
      'svix signing secret for POST /webhooks/resend. Required on a deployment; locally, without it delivery events are refused and only send attempts are recorded.',
    setup: RESEND_WEBHOOK_SETUP,
  },
  {
    /*
     * The one inbox every message lands in outside production. Required when
     * `DEPLOY_ENV=staging` (the API's boot guard enforces that, since the
     * schema cannot relate two rows) and unused in production, so absence is
     * correct on every target. Empty is absent, as for every optional row.
     */
    key: 'EMAIL_SINK_ADDRESS',
    capability: 'email',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local', 'production', 'deployed'],
    shape: /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/,
    placeholder: '<sink-address>',
    description:
      'Where every email is delivered when DEPLOY_ENV is not production, with the intended recipient in the subject. Required for staging; unused in production.',
    setup: RESEND_SETUP,
  },
  {
    /*
     * VEN-661. The most transactional email one UTC day may send before the
     * API stops and pages Sentry. Excused everywhere and given no registry
     * default because the default differs by tier: unset is 80 in production,
     * below Resend's 100-a-day free plan, and 0 on every other tier, which
     * spends no quota at all (`DEFAULT_DAILY_SEND_CAP` in the API). Set it on a
     * lane or staging only while exercising an email flow.
     */
    key: 'EMAIL_DAILY_SEND_CAP',
    capability: 'email',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local', 'production', 'deployed'],
    // Six digits at most: the count is an int4, and a larger cap would fail every send.
    shape: /^\d{1,6}$/,
    placeholder: '<daily-send-cap>',
    description:
      'Emails the API may send per UTC day before it stops and pages Sentry. Unset: 80 in production, 0 (nothing sent) on every other tier.',
    setup: RESEND_SETUP,
  },
  {
    /*
     * VEN-609. `per-environment`, so a deployment must state its sender or
     * refuse to boot: the default names a domain no Resend account has
     * verified, and every send from it is refused and merely logged. The
     * deploy workflow then proves the stated domain is verified.
     */
    key: 'EMAIL_FROM',
    capability: 'email',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    defaultValue: `noreply@${BRAND_DOMAIN}`,
    description:
      'From address on every transactional email. Free-form; no shape is enforced. A deployment must state one on a domain verified in Resend.',
    setup: RESEND_SETUP,
  },
  {
    /*
     * Where `/support` sends (#421). An env row rather than a literal for the
     * reason the screen exists at all: the monitored address is #374's ruling,
     * which has not landed, and this ships before it and changes without a
     * deploy. It is also never scraped, which a published `mailto:` would be.
     *
     * `per-environment`, so the development value cannot reach production: a
     * deployment must state its own destination or refuse to boot. The default
     * below is a laptop's — it is derived from `BRAND_DOMAIN` and nothing reads
     * it aloud to a visitor, because the screen never renders the destination.
     */
    key: 'SUPPORT_EMAIL_TO',
    capability: 'email',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    defaultValue: `support@${BRAND_DOMAIN}`,
    description: 'Where the /support form sends. A deployment must state the monitored address.',
    setup: RESEND_SETUP,
  },
  {
    /*
     * Where operator alerts and the morning digest go (VEN-405). No default,
     * unlike `SUPPORT_EMAIL_TO`: a laptop has nobody to page, so development
     * boots without it and logs each alert instead, while a deployment refuses
     * to start — an alert address that silently defaulted would be a pager
     * wired to nobody.
     */
    key: 'OPERATOR_ALERT_EMAIL',
    capability: 'email',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local'],
    shape: /^[^\s@,]+@[^\s@,]+\.[A-Za-z]{2,}$/,
    placeholder: 'operator@...',
    description:
      'Where operator alerts (disputes, failed payouts and refunds) and the daily digest are sent. Required on a deployment; development logs alerts instead.',
    setup: RESEND_SETUP,
  },
  {
    /* The zone whose 07:00 the daily digest waits for. */
    key: 'OPERATOR_TIMEZONE',
    capability: 'email',
    audience: 'server',
    consumers: ['api'],
    environments: 'shared',
    shape: /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)*$/,
    defaultValue: 'America/New_York',
    description: 'IANA time zone of the operator; the daily digest is sent at 07:00 there.',
    setup: RESEND_SETUP,
  },

  // --- sentry --------------------------------------------------------------
  {
    /*
     * No default, and excused only off a deployment (VEN-397). A laptop with no
     * DSN runs with reporting off — the SDK is never initialised — so no
     * development value exists that could reach the production project. A
     * deployment refuses to boot without one: an API that cannot report its
     * errors is the nineteen-hour outage nobody heard about.
     */
    key: 'SENTRY_DSN',
    capability: 'sentry',
    audience: 'server',
    consumers: ['api'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local'],
    shape: SENTRY_DSN_SHAPE,
    placeholder: 'https://...@sentry.io/...',
    description: 'Sentry DSN the API reports errors to. Unset locally; required on a deployment.',
    setup: SENTRY_SETUP,
  },
  {
    /*
     * The web app's own project, and browser-facing because the client SDK
     * sends from the visitor's browser — a DSN is a write-only ingest address,
     * public by design. Same excusal as the API's row, checked by the build.
     */
    key: 'NEXT_PUBLIC_SENTRY_DSN',
    capability: 'sentry',
    audience: 'browser',
    consumers: ['web'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local'],
    shape: SENTRY_DSN_SHAPE,
    placeholder: 'https://...@sentry.io/...',
    description:
      'Sentry DSN the web app reports errors to, from the server and the browser. Unset locally; required on a deployment.',
    setup: SENTRY_SETUP,
  },
  {
    /*
     * Source-map upload, which only the production web build performs. Excused
     * on every target the apps check — a preview deployment has no maps to
     * upload — and required by `preflight --env production`; the deploy
     * workflow refuses to start without it.
     */
    key: 'SENTRY_AUTH_TOKEN',
    capability: 'sentry',
    audience: 'server',
    consumers: ['web'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local', 'deployed'],
    shape: /^sntrys_[A-Za-z0-9+/=_-]{20,}$/,
    placeholder: 'sntrys_...',
    description: 'Sentry organization token the production web build uploads source maps with.',
    setup: SENTRY_UPLOAD_SETUP,
  },
  {
    key: 'SENTRY_WEB_PROJECT',
    capability: 'sentry',
    audience: 'server',
    consumers: ['web'],
    environments: 'per-environment',
    optionalFor: ['baseline', 'local', 'deployed'],
    shape: /^[a-z0-9][a-z0-9_-]*$/,
    placeholder: '...',
    description: 'Slug of the Sentry project the web source maps are uploaded to.',
    setup: SENTRY_UPLOAD_SETUP,
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
export function requiresExplicitValue(variable: EnvVariable, target: ShapeTarget): boolean {
  if (variable.optionalFor?.includes(target) === true) {
    return false;
  }

  return (
    variable.defaultValue === undefined ||
    ((target === 'production' || target === 'deployed') &&
      variable.environments === 'per-environment')
  );
}

/** The value `.env.example` carries for a row. */
export function exampleValue(variable: EnvVariable): string {
  return variable.defaultValue ?? variable.placeholder ?? '';
}

/**
 * Which value set a caller is holding a variable to.
 *
 * `baseline` is not a weaker `local` — it is the honest answer for a caller
 * that cannot tell the two apart. `next build` and `tsc` both set
 * `NODE_ENV=production`, so neither app can prove at boot whether it is a
 * laptop or a release; holding them to `local` would reject the live keys that
 * are correct in production. Only `pnpm preflight` is told which environment it
 * is checking, so only it applies a mode restriction.
 *
 * `deployed` is the set the apps themselves apply once they *can* tell — the
 * API at boot, the web app when a platform is building it. It refuses every
 * per-environment default, which is the whole of the law, but it deliberately
 * does **not** tighten shapes: staging is a deployment too, and holding it to
 * `productionShape` would demand a live Stripe key for a test-mode branch.
 */
export type ShapeTarget = 'baseline' | 'local' | 'production' | 'deployed';

/** The syntax a value must match under the given value set. */
export function shapeFor(variable: EnvVariable, target: ShapeTarget): RegExp | undefined {
  if (target === 'baseline' || target === 'deployed') {
    return variable.shape;
  }

  const tightened = target === 'production' ? variable.productionShape : variable.localShape;

  return tightened ?? variable.shape;
}

const BY_KEY = new Map<string, EnvVariable>(
  ENV_REGISTRY.map((variable) => [variable.key, variable]),
);

export function findVariable(key: string): EnvVariable | undefined {
  return BY_KEY.get(key);
}
