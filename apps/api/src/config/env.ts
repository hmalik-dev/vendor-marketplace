import { registrySchemaShape } from '@vendor-marketplace/shared/env';
import { z } from 'zod';

/**
 * Capabilities the API reads at boot. Adding a capability here is what makes a
 * new service's variables required — the keys themselves live in the env
 * registry, so this schema cannot drift from `.env.example` or `turbo.json`.
 */
const API_CAPABILITIES = ['core', 'auth', 'storage'] as const;

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
function buildSchema(target: 'local' | 'production') {
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
  });
}

/**
 * Boot-time validation always uses the local target. `NODE_ENV` is not a
 * reliable signal for "this is a production deployment" — `next build` and
 * `tsc` set it too — so the stricter production value set is checked by
 * `pnpm preflight --env production` before a release instead.
 */
const envSchema = buildSchema('local');

export type ApiEnv = z.infer<typeof envSchema>;

/** Keys the schema overrides after spreading the registry shape. */
export const OVERRIDDEN_KEYS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'RATE_LIMIT_MAX',
  'S3_PUBLIC_URL',
  'S3_FORCE_PATH_STYLE',
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

/** Origins accepted by CORS, derived from the comma-separated `WEB_URL`. */
export function allowedOrigins(env: ApiEnv): string[] {
  return env.WEB_URL.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
