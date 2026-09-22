import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';
import Fastify, {
  type FastifyInstance,
  type FastifyPluginOptions,
  type RouteOptions,
} from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type FastifyPluginAsyncZod,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createDatabase } from '@vendor-marketplace/db';
import { bootEnv } from './config/boot.js';
import {
  MAX_UPLOAD_BYTES,
  OPERATOR_DIGEST_POLL_INTERVAL_MS,
  EMAIL_RETRY_SWEEP_INTERVAL_MS,
  EXPIRY_SWEEP_INTERVAL_MS,
  AUTH_RECONCILE_INTERVAL_MS,
  PAYOUT_SWEEP_INTERVAL_MS,
  UPLOAD_SWEEP_INTERVAL_MS,
  VISITOR_IP_HEADER,
  WEB_TIER_KEY_HEADER,
} from '@vendor-marketplace/shared';
import { clientAddress } from './lib/client-address.js';
import { isDeployedRuntime } from '@vendor-marketplace/shared/env';
import { allowedOrigins, canonicalWebOrigin, type ApiEnv } from './config/env.js';
import type { AppDatabase } from './lib/database.js';
import { redactLogRecord, serializeError } from './lib/log-error-serializer.js';
import { redactQueryValues } from './lib/log-redaction.js';
import { createS3Storage, type ObjectStorage } from './lib/storage.js';
import type { EmailGateway } from './lib/email.js';
import { stripeKeyMode, type StripeConnectGateway } from './lib/stripe.js';
import { neonAuthPlugin, type NeonAuthPluginOptions } from './plugins/neon-auth.js';
import { authDirectoryPlugin, type AuthDirectoryPluginOptions } from './plugins/auth-directory.js';
import { backgroundPlugin } from './plugins/background.js';
import { clockPlugin, type Clock } from './plugins/clock.js';
import { databasePlugin } from './plugins/database.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { createErrorReporter, type ErrorReporter } from './lib/error-reporting.js';
import { eventsPlugin } from './plugins/events.js';
import { operatorAlertsPlugin } from './plugins/operator-alerts.js';
import { stepUpPlugin } from './plugins/step-up.js';
import type { StepUpStore } from './lib/step-up.js';
import { emailRetryPlugin } from './plugins/email-retry.js';
import { expirySweepPlugin } from './plugins/expiry-sweep.js';
import { uploadSweepPlugin } from './plugins/upload-sweep.js';
import { authReconcilePlugin } from './plugins/auth-reconcile.js';
import { payoutReleasePlugin } from './plugins/payout-release.js';
import { storagePlugin } from './plugins/storage.js';
import { emailPlugin } from './plugins/email.js';
import { stripePlugin } from './plugins/stripe.js';
import { availabilityRoutes } from './modules/availability/availability.routes.js';
import { bookingRequestRoutes } from './modules/booking-requests/booking-requests.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { adminCategoryRoutes } from './modules/admin/admin-categories.routes.js';
import { categoryRoutes } from './modules/categories/categories.routes.js';
import { messagingRoutes } from './modules/messaging/messaging.routes.js';
import { placeRoutes } from './modules/places/places.routes.js';
import { customerRoutes } from './modules/customers/customers.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { throttleRoutes } from './modules/throttle/throttle.routes.js';
import { packageRoutes } from './modules/packages/packages.routes.js';
import { portfolioRoutes } from './modules/portfolio/portfolio.routes.js';
import { reviewRoutes } from './modules/reviews/reviews.routes.js';
import { reportRoutes } from './modules/reports/reports.routes.js';
import { supportRoutes } from './modules/support/support.routes.js';
import { tagRoutes } from './modules/tags/tags.routes.js';
import { uploadRoutes } from './modules/uploads/uploads.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { vendorRoutes } from './modules/vendors/vendors.routes.js';
import { stripeConnectRoutes } from './modules/vendors/stripe-connect.routes.js';
import { legalAgreementRoutes } from './modules/vendors/legal-agreement.routes.js';
import { termsRoutes } from './modules/legal/terms.routes.js';
import {
  adminVendorInviteRoutes,
  vendorApplicationRoutes,
} from './modules/vendor-invites/vendor-invites.routes.js';
import { paymentRoutes } from './modules/payments/payments.routes.js';
import { stripeWebhookRoutes } from './modules/webhooks/stripe.routes.js';
import {
  resendWebhookRoutes,
  type ResendWebhookRoutesOptions,
} from './modules/webhooks/resend.routes.js';

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
  /** Test seams; production wiring uses the real Neon Auth clients. */
  auth?: Pick<NeonAuthPluginOptions, 'verifySessionToken' | 'loadAuthUser'> &
    Pick<AuthDirectoryPluginOptions, 'directory'>;
  /** The signature seam for the Resend delivery webhook; the suites never hold its secret. */
  webhooks?: Pick<ResendWebhookRoutesOptions, 'verifySignature'>;
  /** Stripe Connect seam; the plugin builds the real gateway from the secrets. */
  stripe?: StripeConnectGateway;
  /** Resend seam, for the same reason: the suites assert on what would be sent. */
  email?: EmailGateway;
  /**
   * How often the payout sweep runs, in milliseconds; `0` disables it.
   *
   * Defaults to `PAYOUT_SWEEP_INTERVAL_MS` rather than to disabled, and the
   * direction is deliberate. A default of `0` would mean a deployment that
   * forgot to set it never pays a single vendor, silently and for as long as
   * nobody checks — the sweep has no request to fail and no screen that says it
   * is not running. On by default fails the other way: the suites pass `0`
   * explicitly, and a suite that forgot to would see the sweep move money and
   * go red, which is a failure that reports itself.
   */
  payoutSweepIntervalMs?: number;
  /**
   * How often accounts are reconciled against Neon Auth; `0` disables it. On by
   * default for `payoutSweepIntervalMs`'s reason.
   */
  authReconcileIntervalMs?: number;
  /**
   * How often lapsed booking requests are aged and announced; `0` disables it.
   * On by default for `payoutSweepIntervalMs`'s reason.
   */
  expirySweepIntervalMs?: number;
  /**
   * How often an open event stream is kept alive and its account re-read, so a
   * ban or deletion ends it on any instance. Default 30 s; suites shorten it.
   */
  streamHeartbeatMs?: number;
  /**
   * How often failed transactional email is re-sent; `0` disables it. On by
   * default for `payoutSweepIntervalMs`'s reason.
   */
  emailRetryIntervalMs?: number;
  /**
   * How often unreferenced uploads are swept from storage; `0` disables it. On
   * by default for `payoutSweepIntervalMs`'s reason.
   */
  uploadSweepIntervalMs?: number;
  /**
   * How long a client has to deliver a whole request, in milliseconds. Defaults
   * to `REQUEST_TIMEOUT_MS`; a suite passes a short one to watch a stalled
   * upload get cut off.
   */
  requestTimeoutMs?: number;
  /** Log what the upload sweep would delete and delete nothing. */
  uploadSweepDryRun?: boolean;
  /**
   * How often each instance asks whether the operator digest is due; `0`
   * disables it. On by default for `payoutSweepIntervalMs`'s reason.
   */
  operatorDigestIntervalMs?: number;
  /** Pause between operator alert send retries; defaults to a real timer. */
  operatorAlertWait?: (ms: number) => Promise<void>;
  /** Step-up seam; the suites pass a store that is always fresh unless the suite is about step-up. */
  stepUp?: StepUpStore;
  /**
   * The error tracker seam. Defaults to Sentry when `SENTRY_DSN` is set and to
   * silence when it is not — which the env registry allows only off a
   * deployment, so a production API cannot be built without reporting.
   */
  errorReporter?: ErrorReporter;
  /**
   * Called with every route the server registers, from a root `onRoute` hook
   * added before any plugin, so the suites can walk the real route table.
   */
  onRoute?: (route: RouteOptions) => void;
}

/**
 * Registers a route plugin one scope down, recording every route it declares.
 *
 * The extra scope changes nothing for the plugin — these are all encapsulated
 * already — and gives the `onRoute` hook somewhere to live that sees only its
 * routes. Collected from registration rather than written out as a list, so a
 * new checkout route is a payment route without anyone remembering to say so.
 */
function recordingRoutes<TOptions extends FastifyPluginOptions>(
  plugin: FastifyPluginAsyncZod<TOptions>,
  into: Set<string>,
): FastifyPluginAsyncZod<TOptions> {
  return async (scope, options) => {
    scope.addHook('onRoute', (route) => {
      into.add(route.url);
    });
    await plugin(scope, options);
  };
}

/**
 * How many times `RATE_LIMIT_MAX` the Stripe webhook route may receive per
 * minute. Stripe delivers from a handful of egress addresses, so a payout sweep
 * or a checkout burst is one caller by this API's keying; the ceiling stays
 * finite so a runaway sender is still refused, and still counted as a failure.
 */
const WEBHOOK_RATE_LIMIT_FACTOR = 10;

/** Longest textual IP address, IPv6 with an embedded IPv4 tail. */
const MAX_IP_LENGTH = 45;

/** Non-file form fields an upload may carry (there are none today). */
const MAX_UPLOAD_FORM_FIELDS = 5;

/**
 * The time a client has to deliver a complete request, headers and body.
 *
 * Fastify's default is no limit, which also switches off Node's own 300 s, so a
 * client that opens an upload and then trickles or stops holds a socket and its
 * buffered bytes forever. Sixty seconds carries a 12 MB image over roughly
 * 200 KB/s.
 *
 * Node's `requestTimeout` alone is not enough: it only runs until the *headers*
 * are complete (a raw socket that sends them and half a body is never cut), so
 * the body deadline is the `onRequest` hook below. Neither counts the response,
 * so `/events/stream`, a GET whose request is complete on arrival, is never cut.
 */
const REQUEST_TIMEOUT_MS = 60_000;

/** Node only checks for expired requests on this cadence, so it bounds the timeout's precision. */
const MAX_CONNECTIONS_CHECKING_INTERVAL_MS = 30_000;

/**
 * The rate-limit key: the visitor the web tier forwarded, when the caller proves
 * it is the web tier, otherwise the caller's own address.
 *
 * Server-rendered calls all arrive from the web platform's egress address, so
 * keying on `request.ip` alone puts every visitor in one bucket. The forwarded
 * address is honoured only alongside the shared secret; without it, or with a
 * wrong one, the header is ignored and a caller cannot mint buckets by writing it.
 */
function rateLimitKey(
  request: {
    ip: string;
    headers: Record<string, string | string[] | undefined>;
    log: { warn: (message: string) => void };
  },
  secret: string | undefined,
): string {
  const presented = request.headers[WEB_TIER_KEY_HEADER];
  const visitor = request.headers[VISITOR_IP_HEADER];
  if (
    secret === undefined ||
    typeof presented !== 'string' ||
    typeof visitor !== 'string' ||
    visitor.length === 0 ||
    visitor.length > MAX_IP_LENGTH ||
    !isIP(visitor)
  ) {
    return clientAddress(request);
  }
  const expected = Buffer.from(secret);
  const actual = Buffer.from(presented);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    // A rotated key on one side only puts every visitor back in one bucket, and
    // nothing else would say so.
    request.log.warn('web tier key mismatch: rate limit is keyed on the socket address');
    return clientAddress(request);
  }
  return `visitor:${visitor}`;
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const { env, db, storage } = options;
  const errorReporter = options.errorReporter ?? createErrorReporter(env);
  /** Route patterns that move money; filled as the payment plugins register below. */
  const moneyRoutes = new Set<string>();

  const requestTimeout = Math.max(1, options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS);

  const app = Fastify({
    requestTimeout,
    // No idle-socket cap: the host proxy owns that, and a stream is idle by design.
    connectionTimeout: 0,
    http: {
      connectionsCheckingInterval: Math.min(
        MAX_CONNECTIONS_CHECKING_INTERVAL_MS,
        Math.max(1, Math.floor(requestTimeout / 4)),
      ),
    },
    /*
     * One hop, and only on a deployment.
     *
     * `request.ip` is the socket's remote address, which behind any load
     * balancer is the *platform's* proxy — the same value for every visitor.
     * Every per-IP rate limit then shares one bucket: `RATE_LIMIT_MAX` becomes
     * a whole-deployment cap, and #421's six-an-hour support limit becomes six
     * messages an hour **from everyone**, on the one page that exists to report
     * an outage. It is invisible locally, where `pnpm dev` and `app.inject()`
     * both supply a real per-caller address.
     *
     * One hop, never `true`. `trustProxy: true` walks `X-Forwarded-For` to its
     * leftmost entry, which the caller writes, and so hands the rate-limit key
     * straight back to whoever is being limited. Trusting only hop 0 takes the
     * entry the immediate proxy appended — the client address as that proxy
     * saw it, which nothing outside can forge.
     *
     * On Railway that entry is the edge node, not the visitor (VEN-549), so
     * `request.ip` is never the rate-limit key there: `clientAddress` reads
     * the edge's `X-Real-IP`, and `request.ip` is only its fallback.
     *
     * A predicate rather than the count `trustProxy: 1`, because this
     * Fastify's types accept `string | boolean | string[] | TrustProxyFunction`
     * and no number; the predicate is what the count means anyway.
     *
     * `false` on a laptop, because there is no proxy there: trusting a header
     * that nothing sets would let a local request name its own address.
     */
    trustProxy: isDeployedRuntime() ? (_address: string, hop: number) => hop === 0 : false,
    logger: {
      level: env.LOG_LEVEL,
      // Never let a token, cookie, or webhook signature reach the log stream.
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["svix-signature"]',
        'req.headers["stripe-signature"]',
        'req.headers["x-web-tier-key"]',
      ],
      formatters: {
        /*
         * The same withholding for an error logged under any other name (#445).
         *
         * A serialiser is bound to one key, so `err` below covers
         * `log.error({ err })` and nothing else — `log.error({ failure })`
         * reaches the stream by a path it never sees. pino runs this over the
         * whole record before any serialiser, which is what makes the guard
         * hold whatever a future author calls the field.
         */
        log: redactLogRecord,
      },
      serializers: {
        /*
         * The failed statement, with every value bound to it withheld (#445).
         *
         * pino's own serialiser over a sanitised error: `redact` above is
         * path-based on `req.headers.*` and cannot reach a property hanging
         * off a serialised error, and a failed query arrives carrying every
         * bound parameter in both its `message` and an own `params` property.
         * One serialiser here covers every `log.*({ err })` in the API,
         * including the ones nobody has written yet.
         */
        err: serializeError,
        /*
         * The request line, with every query value redacted (#215).
         *
         * `redact` reaches headers but not the URL, and the default request
         * serializer writes the URL whole — which is how 27 live session JWTs
         * ended up in one lane's dev log. The stream no longer carries a
         * credential in its URL, and this stops the logger writing a query
         * value even if some future route puts one back.
         *
         * **It redacts the query string, not the path.** A credential placed in
         * a path segment — `/events/stream/<ticket>` — would still be logged
         * whole. No route is shaped that way today, and the fix if one ever is
         * would be to move the value out of the path rather than to widen this.
         */
        req(request) {
          return {
            method: request.method,
            url: redactQueryValues(request.url),
            host: request.headers.host,
            remoteAddress: request.socket?.remoteAddress,
            remotePort: request.socket?.remotePort,
          };
        },
      },
      ...(options.loggerStream ? { stream: options.loggerStream } : {}),
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  if (options.onRoute) {
    app.addHook('onRoute', options.onRoute);
  }

  await app.register(errorHandlerPlugin, { reporter: errorReporter, paymentRoutes: moneyRoutes });
  // The API serves JSON and nothing a browser renders, so a response that is ever
  // opened as a document is told to load nothing.
  await app.register(helmet, {
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"] } },
  });
  await app.register(cors, {
    origin: allowedOrigins(env),
    credentials: true,
    methods: [...ALLOWED_METHODS],
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: (request) => rateLimitKey(request, env.WEB_TIER_KEY),
  });
  /*
   * The limiter, ahead of authentication.
   *
   * The plugin above attaches its check to each *route*, and Fastify runs a
   * route's hooks after every instance-level hook — so the auth plugin's 401 or
   * 403 ended the request before it was counted, and a flood of garbage tokens
   * was never limited while still costing a verification and a lookup each.
   * Registered here, before the auth plugin, this runs first; the plugin's own
   * route hook then sees the request already counted and skips it.
   *
   * A route that declares its own `config.rateLimit` (a limit, or `false`) keeps
   * the route-level hook for that limit: the support route keys on the resolved
   * account, which only exists once the auth hook has run, and the ceilings are
   * not the API-wide one. A bearer token on such a route is also counted in the
   * API-wide bucket here, so a flood of bad tokens is limited there too —
   * `createRateLimit` never consults the "already ran" flag the plugin's own
   * hook uses, which is why it can count without silencing the route's ceiling.
   */
  const limitRequest = app.rateLimit();
  const countBearer = app.createRateLimit();
  // The plugin types `this` as a bare FastifyInstance; ours carries the Zod provider.
  const plain = app as unknown as FastifyInstance;
  /*
   * The body deadline: a request that declares a body must deliver all of it
   * within `requestTimeout`, or its socket is destroyed.
   */
  app.addHook('onRequest', async (request, reply) => {
    const { headers, raw } = request;
    // Bytes outstanding, not a header present: a bodiless `content-length: 0` request
    // (which a proxy adds to a GET) is never read, so `/events/stream` would never disarm it.
    const length = headers['content-length'];
    if (headers['transfer-encoding'] === undefined && (length === undefined || length === '0')) {
      return;
    }
    const timer = setTimeout(() => raw.destroy(), requestTimeout);
    timer.unref();
    const clear = (): void => clearTimeout(timer);
    raw.once('end', clear);
    reply.raw.once('close', clear);
  });

  app.addHook('onRequest', async (request, reply) => {
    const routeLimit = request.routeOptions.config?.rateLimit;

    if (routeLimit === undefined || routeLimit === null) {
      await limitRequest.call(plain, request, reply);
    } else if (routeLimit !== false && request.headers.authorization !== undefined) {
      const counted = await countBearer.call(plain, request);
      if (!counted.isAllowed && counted.isExceeded) {
        throw Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 });
      }
    }
  });
  // The per-file ceiling is also enforced when the part is buffered, so an
  // oversized upload is refused rather than read into memory in full.
  // The upload form is one file and no fields; the small allowance is headroom,
  // not a feature, and stops a body of thousands of empty fields being parsed.
  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
      fields: MAX_UPLOAD_FORM_FIELDS,
      parts: MAX_UPLOAD_FORM_FIELDS + 1,
    },
  });

  await app.register(backgroundPlugin);
  await app.register(clockPlugin, options.clock ? { clock: options.clock } : {});
  await app.register(databasePlugin, { db });
  await app.register(eventsPlugin);
  await app.register(storagePlugin, { storage, publicUrl: env.STORAGE_PUBLIC_URL });
  await app.register(stripePlugin, {
    secretKey: env.STRIPE_SECRET_KEY,
    deployEnv: env.DEPLOY_ENV,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    ...(env.STRIPE_CONNECT_WEBHOOK_SECRET
      ? { connectWebhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET }
      : {}),
    ...(options.stripe ? { gateway: options.stripe } : {}),
  });
  await app.register(emailPlugin, {
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    deployEnv: env.DEPLOY_ENV,
    sinkAddress: env.EMAIL_SINK_ADDRESS,
    ...(options.email ? { gateway: options.email } : {}),
  });
  await app.register(neonAuthPlugin, {
    baseUrl: env.NEON_AUTH_BASE_URL,
    ...(options.auth?.verifySessionToken
      ? { verifySessionToken: options.auth.verifySessionToken }
      : {}),
    ...(options.auth?.loadAuthUser ? { loadAuthUser: options.auth.loadAuthUser } : {}),
  });
  await app.register(authDirectoryPlugin, {
    connectionString: env.NEON_AUTH_DATABASE_URL,
    ...(options.auth?.directory ? { directory: options.auth.directory } : {}),
  });
  await app.register(operatorAlertsPlugin, {
    to: env.OPERATOR_ALERT_EMAIL,
    webOrigin: canonicalWebOrigin(env),
    timeZone: env.OPERATOR_TIMEZONE,
    digestIntervalMs: options.operatorDigestIntervalMs ?? OPERATOR_DIGEST_POLL_INTERVAL_MS,
    ...(options.operatorAlertWait ? { wait: options.operatorAlertWait } : {}),
  });
  await app.register(stepUpPlugin, { ...(options.stepUp ? { store: options.stepUp } : {}) });
  await app.register(payoutReleasePlugin, {
    intervalMs: options.payoutSweepIntervalMs ?? PAYOUT_SWEEP_INTERVAL_MS,
    reporter: errorReporter,
    webOrigin: canonicalWebOrigin(env),
  });
  await app.register(authReconcilePlugin, {
    intervalMs: options.authReconcileIntervalMs ?? AUTH_RECONCILE_INTERVAL_MS,
    reporter: errorReporter,
    webOrigin: canonicalWebOrigin(env),
  });
  await app.register(uploadSweepPlugin, {
    intervalMs: options.uploadSweepIntervalMs ?? UPLOAD_SWEEP_INTERVAL_MS,
    dryRun: options.uploadSweepDryRun ?? false,
    reporter: errorReporter,
  });
  await app.register(emailRetryPlugin, {
    intervalMs: options.emailRetryIntervalMs ?? EMAIL_RETRY_SWEEP_INTERVAL_MS,
    webOrigin: canonicalWebOrigin(env),
    reporter: errorReporter,
  });
  await app.register(expirySweepPlugin, {
    intervalMs: options.expirySweepIntervalMs ?? EXPIRY_SWEEP_INTERVAL_MS,
    webOrigin: canonicalWebOrigin(env),
    platformFeeRate: env.STRIPE_PLATFORM_FEE_RATE,
    reporter: errorReporter,
  });

  await app.register(healthRoutes);
  await app.register(throttleRoutes, { webTierKey: env.WEB_TIER_KEY });
  await app.register(adminRoutes, { webOrigin: canonicalWebOrigin(env) });
  await app.register(adminCategoryRoutes);
  await app.register(adminVendorInviteRoutes, { webOrigin: canonicalWebOrigin(env) });
  await app.register(vendorApplicationRoutes, { webOrigin: canonicalWebOrigin(env) });
  await app.register(categoryRoutes);
  await app.register(tagRoutes);
  await app.register(placeRoutes);
  await app.register(userRoutes);
  await app.register(customerRoutes);
  await app.register(vendorRoutes);
  await app.register(recordingRoutes(stripeConnectRoutes, moneyRoutes), {
    returnOrigin: canonicalWebOrigin(env),
  });
  await app.register(legalAgreementRoutes);
  await app.register(termsRoutes);
  await app.register(packageRoutes);
  await app.register(portfolioRoutes);
  await app.register(reviewRoutes, { webOrigin: canonicalWebOrigin(env) });
  await app.register(availabilityRoutes);
  await app.register(bookingRequestRoutes, {
    webOrigin: canonicalWebOrigin(env),
    rateLimitMax: env.BOOKING_REQUEST_RATE_LIMIT_MAX,
    platformFeeRate: env.STRIPE_PLATFORM_FEE_RATE,
  });
  await app.register(messagingRoutes, {
    allowedOrigins: allowedOrigins(env),
    conversationRateLimitMax: env.CONVERSATION_RATE_LIMIT_MAX,
    messageRateLimitMax: env.MESSAGE_RATE_LIMIT_MAX,
    ...(options.streamHeartbeatMs ? { heartbeatMs: options.streamHeartbeatMs } : {}),
  });
  await app.register(uploadRoutes, {
    rateLimitMax: env.UPLOAD_RATE_LIMIT_MAX,
    objectLimit: env.UPLOAD_OBJECT_LIMIT,
  });
  await app.register(supportRoutes, {
    supportEmailTo: env.SUPPORT_EMAIL_TO,
    webOrigin: canonicalWebOrigin(env),
  });
  await app.register(reportRoutes, { supportEmailTo: env.SUPPORT_EMAIL_TO });
  /*
   * The one route this API registers conditionally, and the condition is an
   * environment fact rather than a plugin's business — so it is decided here,
   * beside every other env-driven wiring choice, and the plugin keeps a
   * plain `signingSecret: string` contract.
   *
   * No secret means **no endpoint**, not a handler that answers 503: there is
   * then no code path in which an unsigned delivery event can reach the record,
   * because there is nothing for one to reach. Sending and recording attempts
   * are untouched either way — only the provider's later account of what
   * happened is missing. See the `RESEND_WEBHOOK_SECRET` registry row, which is
   * optional on every target for exactly this reason (#439).
   */
  if (env.RESEND_WEBHOOK_SECRET === undefined) {
    app.log.warn(
      'The Resend webhook is not configured, so POST /webhooks/resend is not registered; email delivery records will hold send attempts only',
    );
  } else {
    await app.register(resendWebhookRoutes, {
      signingSecret: env.RESEND_WEBHOOK_SECRET,
      ...options.webhooks,
    });
  }
  await app.register(recordingRoutes(paymentRoutes, moneyRoutes), {
    platformFeeRate: env.STRIPE_PLATFORM_FEE_RATE,
    webOrigin: canonicalWebOrigin(env),
  });
  await app.register(recordingRoutes(stripeWebhookRoutes, moneyRoutes), {
    rateLimitMax: env.RATE_LIMIT_MAX * WEBHOOK_RATE_LIMIT_FACTOR,
    platformFeeRate: env.STRIPE_PLATFORM_FEE_RATE,
    webOrigin: canonicalWebOrigin(env),
    keyMode: stripeKeyMode(env.STRIPE_SECRET_KEY),
    deployEnv: env.DEPLOY_ENV,
  });

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
  const env = bootEnv();
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
