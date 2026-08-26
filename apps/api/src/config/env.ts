import { z } from 'zod';

/**
 * Every environment variable the API reads, validated once at boot. Failing
 * here — loudly, before the server binds a port — is far cheaper than a
 * `undefined` secret surfacing as a 500 on the first authenticated request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  /** Comma-separated list of browser origins allowed to call this API. */
  WEB_URL: z.string().min(1).default('http://localhost:3000'),
  /** Requests per minute, per IP, before the limiter replies 429. */
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  /**
   * Object storage. Cloudflare R2 in production, the MinIO service from
   * docker-compose.yml locally — both speak the S3 API, so only these values
   * differ between the two.
   */
  S3_ENDPOINT: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
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

export type ApiEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ');
    throw new Error(`Invalid API environment configuration:\n  ${missing}`);
  }

  return result.data;
}

/** Origins accepted by CORS, derived from the comma-separated `WEB_URL`. */
export function allowedOrigins(env: ApiEnv): string[] {
  return env.WEB_URL.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
