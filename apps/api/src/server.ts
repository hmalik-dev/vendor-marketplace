import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { allowedOrigins, type ApiEnv } from './config/env.js';
import type { AppDatabase } from './lib/database.js';
import { clerkAuthPlugin, type ClerkAuthPluginOptions } from './plugins/clerk-auth.js';
import { databasePlugin } from './plugins/database.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
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
  /** Alternate log destination; the suites use it to assert on redaction. */
  loggerStream?: NodeJS.WritableStream;
  /** Test seams; production wiring uses the real Clerk and svix clients. */
  auth?: Pick<ClerkAuthPluginOptions, 'verifySessionToken' | 'loadClerkUser'>;
  webhooks?: Pick<ClerkWebhookRoutesOptions, 'verifySignature'>;
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const { env, db } = options;

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

  await app.register(databasePlugin, { db });
  await app.register(clerkAuthPlugin, {
    secretKey: env.CLERK_SECRET_KEY,
    ...options.auth,
  });

  await app.register(healthRoutes);
  await app.register(userRoutes);
  await app.register(clerkWebhookRoutes, {
    signingSecret: env.CLERK_WEBHOOK_SECRET,
    ...options.webhooks,
  });

  await app.ready();
  return app;
}
