import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import type { IncomingMessage, ServerResponse } from 'node:http';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createDatabase, loadEnv } from '@vendor-marketplace/db';
import { MAX_UPLOAD_BYTES } from '@vendor-marketplace/shared';
import { allowedOrigins, parseEnv, type ApiEnv } from './config/env.js';
import { assertWebhookEndpoint } from './modules/webhooks/clerk.endpoint-guard.js';
import type { AppDatabase } from './lib/database.js';
import { createS3Storage, type ObjectStorage } from './lib/storage.js';
import {
  createStripeConnectGateway,
  onboardingReturnOrigin,
  type StripeConnectGateway,
} from './lib/stripe.js';
import { clerkAuthPlugin, type ClerkAuthPluginOptions } from './plugins/clerk-auth.js';
import { clockPlugin, type Clock } from './plugins/clock.js';
import { databasePlugin } from './plugins/database.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { eventsPlugin } from './plugins/events.js';
import { storagePlugin } from './plugins/storage.js';
import { availabilityRoutes } from './modules/availability/availability.routes.js';
import { bookingRequestRoutes } from './modules/booking-requests/booking-requests.routes.js';
import { categoryRoutes } from './modules/categories/categories.routes.js';
import { messagingRoutes } from './modules/messaging/messaging.routes.js';
import { customerRoutes } from './modules/customers/customers.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { packageRoutes } from './modules/packages/packages.routes.js';
import { portfolioRoutes } from './modules/portfolio/portfolio.routes.js';
import { tagRoutes } from './modules/tags/tags.routes.js';
import { uploadRoutes } from './modules/uploads/uploads.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { vendorRoutes } from './modules/vendors/vendors.routes.js';
import { stripeConnectRoutes } from './modules/vendors/stripe-connect.routes.js';
import { stripeWebhookRoutes } from './modules/webhooks/stripe.routes.js';
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
  /**
   * The instant every date-sensitive route reads. Defaults to the real clock;
   * the suites pin it so "today" is an input rather than whatever hour the
   * run happens to start at.
   */
  clock?: Clock;
  /** Test seams; production wiring uses the real Clerk and svix clients. */
  auth?: Pick<ClerkAuthPluginOptions, 'verifySessionToken' | 'loadClerkUser'>;
  webhooks?: Pick<ClerkWebhookRoutesOptions, 'verifySignature'>;
  /** Stripe Connect seam; production wiring builds the real gateway from env. */
  stripe?: StripeConnectGateway;
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const { env, db, storage } = options;
  const stripe = options.stripe ?? createStripeConnectGateway(env);
  const returnOrigin = onboardingReturnOrigin(env);

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Never let a token, cookie, or webhook signature reach the log stream.
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["svix-signature"]',
        'req.headers["stripe-signature"]',
      ],
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

  await app.register(clockPlugin, options.clock ? { clock: options.clock } : {});
  await app.register(databasePlugin, { db });
  await app.register(eventsPlugin);
  await app.register(storagePlugin, { storage });
  await app.register(clerkAuthPlugin, {
    secretKey: env.CLERK_SECRET_KEY,
    ...options.auth,
  });

  await app.register(healthRoutes);
  await app.register(categoryRoutes);
  await app.register(tagRoutes);
  await app.register(userRoutes);
  await app.register(customerRoutes);
  await app.register(vendorRoutes);
  await app.register(stripeConnectRoutes, { stripe, returnOrigin });
  await app.register(packageRoutes);
  await app.register(portfolioRoutes);
  await app.register(availabilityRoutes);
  await app.register(bookingRequestRoutes);
  await app.register(messagingRoutes, { allowedOrigins: allowedOrigins(env) });
  await app.register(uploadRoutes);
  await app.register(clerkWebhookRoutes, {
    signingSecret: env.CLERK_WEBHOOK_SECRET,
    ...options.webhooks,
  });
  await app.register(stripeWebhookRoutes, { stripe, returnOrigin });

  await app.ready();
  return app;
}

/**
 * The request handler Vercel's Fastify preset invokes. The preset treats a
 * default-exported function as a Node `(req, res)` handler rather than as a
 * factory — returning the instance instead leaves the response unwritten and
 * every request hangs until the platform's 300s ceiling — so this hands the
 * request to Fastify's own server and lets it answer.
 *
 * The instance is memoised, not rebuilt per request: a warm invocation reuses
 * one Fastify app and one Postgres pool, and the promise is cached rather than
 * the resolved app so concurrent cold requests share a single boot.
 *
 * `index.ts` remains the entrypoint for the container image, where the process
 * owns the socket and has to drain it on SIGTERM.
 */
let bootstrapped: Promise<FastifyInstance> | undefined;

/**
 * A factory rather than a ready-made instance, so importing this module opens
 * no Postgres pool: the route suites import `buildServer` from here and inject
 * their own database, and connecting at module scope would reach the network
 * during test collection.
 */
async function bootstrap(): Promise<FastifyInstance> {
  loadEnv();

  const env = parseEnv();
  // Before anything binds: a deployment whose webhooks go elsewhere looks
  // perfectly healthy, so the only way to find out is to refuse to start.
  assertWebhookEndpoint(env.CLERK_WEBHOOK_ENDPOINT);

  const { db } = createDatabase();

  // `buildServer` awaits `app.ready()`, which is what makes `app.server` able
  // to accept an emitted request below.
  return buildServer({ env, db, storage: createS3Storage(env) });
}

export default async function handler(
  request: IncomingMessage,
  reply: ServerResponse,
): Promise<void> {
  bootstrapped ??= bootstrap();

  const app = await bootstrapped;

  app.server.emit('request', request, reply);
}
