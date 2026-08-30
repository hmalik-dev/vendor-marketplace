import { DEFAULT_PLATFORM_FEE_RATE } from '@vendor-marketplace/shared';
import { type ShapeTarget, registrySchemaShape } from '@vendor-marketplace/shared/env';
import { z } from 'zod';

/**
 * Capabilities the API reads at boot. Adding a capability here is what makes a
 * new service's variables required — the keys themselves live in the env
 * registry, so this schema cannot drift from `.env.example` or `turbo.json`.
 */
const API_CAPABILITIES = ['core', 'auth', 'storage', 'stripe'] as const;

/**
 * Every environment variable the API reads, validated once at boot. Failing
 * here — loudly, before the server binds a port — is far cheaper than a
 * `undefined` secret surfacing as a 500 on the first authenticated request.
 *
 * Presence, shape, and defaults come from the registry. The overrides below add
 * the coercions and transforms the API needs on top of the registry's string
 * contract; every one of their keys is asserted to exist in the registry by
 * `env.test.ts`.
 */
function buildSchema(target: ShapeTarget) {
  return z.object({
    ...registrySchemaShape({ consumer: 'api', capabilities: API_CAPABILITIES, target }),

    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Requests per minute, per IP, before the limiter replies 429. */
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
    /** Public base URL objects are served from, with no trailing slash. */
    S3_PUBLIC_URL: z
      .string()
      .min(1)
      .transform((value) => value.replace(/\/+$/, '')),
    /** R2 and MinIO both address buckets by path rather than by subdomain. */
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    /*
     * Coerced here rather than parsed at the call site: this is the multiplier
     * on every charge, and a string that reached `calculateFees` would make the
     * platform fee `NaN` and the payout `NaN` on a real payment. The registry
     * already constrains the shape to `0.dddd`, so the bound below is the
     * belt-and-braces half — a rate at or above 1 would pay the vendor nothing.
     */
    STRIPE_PLATFORM_FEE_RATE: z.coerce.number().min(0).lt(1).default(DEFAULT_PLATFORM_FEE_RATE),
  });
}

/**
 * Boot-time validation always uses the baseline value set. `NODE_ENV` is not a
 * reliable signal for "this is a production deployment" — `next build` and
 * `tsc` set it too — so the stricter production value set is checked by
 * `pnpm preflight --env production` before a release instead.
 *
 * `baseline` rather than `local` because the two stopped being the same thing:
 * the local set now rejects a live-mode credential, which is exactly the value
 * this schema must accept when it really is running in production.
 */
const envSchema = buildSchema('baseline');

export type ApiEnv = z.infer<typeof envSchema>;

/** Keys the schema overrides after spreading the registry shape. */
export const OVERRIDDEN_KEYS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'RATE_LIMIT_MAX',
  'S3_PUBLIC_URL',
  'S3_FORCE_PATH_STYLE',
  'STRIPE_PLATFORM_FEE_RATE',
] as const;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ');
    throw new Error(
      `Invalid API environment configuration:\n  ${missing}\n\nRun \`pnpm preflight\` for the fix for each one.`,
    );
  }

  return result.data;
}

/**
 * Origins accepted by CORS, derived from the comma-separated `WEB_URL`.
 *
 * Takes the one field it reads rather than the whole environment, so callers
 * that hold a narrower slice — Stripe's onboarding return origin, for one — can
 * reuse it instead of parsing `WEB_URL` a second way.
 */
export function allowedOrigins(env: Pick<ApiEnv, 'WEB_URL'>): string[] {
  return (
    env.WEB_URL.split(',')
      /*
       * The trailing slash goes here rather than in the schema, so `WEB_URL`
       * keeps the registry's default instead of restating it. Stripping it is
       * right for both readers: a browser's `Origin` header never carries one,
       * so `https://x.com/` in the allow-list would match nothing, and the
       * origin handed to Stripe is joined onto a path.
       */
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter((origin) => origin.length > 0)
  );
}

/**
 * The one origin the product calls its own — the first entry of `WEB_URL`,
 * which is written canonical-first.
 *
 * Used wherever a single absolute URL has to be handed to a third party, such
 * as the return and refresh URLs Stripe sends an onboarding vendor back to.
 * There is deliberately no `https` assertion here: `NODE_ENV` cannot tell a
 * deployment from a `tsc` run (see above), and `WEB_URL` already carries a
 * `productionShape` of https-only that `pnpm preflight --env production`
 * enforces against the real environment.
 */
export function canonicalWebOrigin(env: Pick<ApiEnv, 'WEB_URL'>): string {
  const origin = allowedOrigins(env)[0];

  if (origin === undefined) {
    throw new Error('WEB_URL is empty, so the API has no origin to hand out');
  }

  return origin;
}
