import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createDatabase, loadEnv } from '@vendor-marketplace/db';
import { MAX_UPLOAD_BYTES } from '@vendor-marketplace/shared';
import { allowedOrigins, parseEnv, type ApiEnv } from './config/env.js';
import type { AppDatabase } from './lib/database.js';
import { createS3Storage, type ObjectStorage } from './lib/storage.js';
import { clerkAuthPlugin, type ClerkAuthPluginOptions } from './plugins/clerk-auth.js';
import { databasePlugin } from './plugins/database.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { storagePlugin } from './plugins/storage.js';
import { availabilityRoutes } from './modules/availability/availability.routes.js';
import { categoryRoutes } from './modules/categories/categories.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { packageRoutes } from './modules/packages/packages.routes.js';
import { portfolioRoutes } from './modules/portfolio/portfolio.routes.js';
import { tagRoutes } from './modules/tags/tags.routes.js';
import { uploadRoutes } from './modules/uploads/uploads.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { vendorRoutes } from './modules/vendors/vendors.routes.js';
import {
  clerkWebhookRoutes,
  type ClerkWebhookRoutesOptions,
} from './modules/webhooks/clerk.routes.js';

/*
 * @fastify/cors defaults to GET, HEAD, and POST only, which silently blocks
 * every write the API serves once a real browser sends its preflight —
 * `app.inject()` skips CORS, so this is invisible to the route suites.
 */
const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export interface BuildServerOptions {
  env: ApiEnv;
  db: AppDatabase;
  /** Object storage for uploads; the suites pass an in-memory recorder. */
  storage: ObjectStorage;
  /** Alternate log destination; the suites use it to assert on redaction. */
  loggerStream?: NodeJS.WritableStream;
  /** Test seams; production wiring uses the real Clerk and svix clients. */
  auth?: Pick<ClerkAuthPluginOptions, 'verifySessionToken' | 'loadClerkUser'>;
  webhooks?: Pick<ClerkWebhookRoutesOptions, 'verifySignature'>;
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const { env, db, storage } = options;

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Never let a token, cookie, or webhook signature reach the log stream.
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["svix-signature"]'],
      ...(options.loggerStream ? { stream: options.loggerStream } : {}),
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorHandlerPlugin);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: allowedOrigins(env),
    credentials: true,
    methods: [...ALLOWED_METHODS],
  });
  await app.register(rateLimit, { max: env.RATE_LIMIT_MAX, timeWindow: '1 minute' });
  // The per-file ceiling is also enforced when the part is buffered, so an
  // oversized upload is refused rather than read into memory in full.
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  await app.register(databasePlugin, { db });
  await app.register(storagePlugin, { storage });
  await app.register(clerkAuthPlugin, {
    secretKey: env.CLERK_SECRET_KEY,
    ...options.auth,
  });

  await app.register(healthRoutes);
  await app.register(categoryRoutes);
  await app.register(tagRoutes);
  await app.register(userRoutes);
  await app.register(vendorRoutes);
  await app.register(packageRoutes);
  await app.register(portfolioRoutes);
  await app.register(availabilityRoutes);
  await app.register(uploadRoutes);
  await app.register(clerkWebhookRoutes, {
    signingSecret: env.CLERK_WEBHOOK_SECRET,
    ...options.webhooks,
  });

  await app.ready();
  return app;
}

/**
 * The entrypoint Vercel's Fastify preset imports. The platform owns the socket,
 * so this deliberately does not `listen` and installs no signal handlers —
 * `index.ts` remains the entrypoint for the container image, where the process
 * does own the socket and has to drain its own connections on SIGTERM.
 *
 * It is a factory rather than a ready-made instance so that importing this
 * module never opens a Postgres pool: the route suites import `buildServer`
 * from here and inject their own database, and a top-level `createDatabase()`
 * would connect during test collection.
 */
export default async function createServer(): Promise<FastifyInstance> {
  loadEnv();

  const env = parseEnv();
  const { db } = createDatabase();

  return buildServer({ env, db, storage: createS3Storage(env) });
}
