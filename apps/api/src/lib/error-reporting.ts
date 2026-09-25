import * as Sentry from '@sentry/node';
import {
  ERROR_REPORTING_SAMPLING,
  PAYMENT_ERROR_TAGS,
  scrubErrorEvent,
} from '@vendor-marketplace/shared';
import { releaseIdentifier } from '@vendor-marketplace/shared/env';
import type { ApiEnv } from '../config/env.js';
import { redactErrorValues } from './log-error-serializer.js';

/** What the API knows about a failure beyond the error itself. */
export interface ErrorContext {
  /** The signed-in caller's auth user id — the id the web app reports too, so one person reads as one user across both projects. */
  userId?: string | null | undefined;
  /** A failure in money movement: checkout, a refund, a Connect account, a Stripe webhook, the payout sweep. */
  payment?: boolean;
  /** The route pattern, never the URL: a URL carries ids and query values. */
  route?: string | undefined;
  /** The request's id: the one the API log line and the web error page carry, so the three join. */
  requestId?: string | undefined;
}

/**
 * The seam between the API and its error tracker.
 *
 * The request path and the payout sweep call `capture`, never `Sentry.*`
 * directly, so the suites can assert what would have been reported — the user
 * id, the payment tag — without a network, and a laptop with no DSN reports
 * nothing through the same code path.
 */
export interface ErrorReporter {
  capture(error: unknown, context?: ErrorContext): void;
}

export const silentErrorReporter: ErrorReporter = { capture: () => undefined };

/**
 * The SDK options, or `null` when reporting is off.
 *
 * Off means no DSN, which the env registry allows only off a deployment — so
 * `null` here is a laptop, never a production API that forgot. The release is
 * the identifier the deploy workflow sets; `/ready` names the same value, which
 * is how the release that threw is the release that shipped.
 */
export function sentryOptions(
  env: Pick<ApiEnv, 'SENTRY_DSN' | 'DEPLOY_ENV'>,
  source: NodeJS.ProcessEnv = process.env,
): Sentry.NodeOptions | null {
  if (env.SENTRY_DSN === undefined) {
    return null;
  }

  return {
    dsn: env.SENTRY_DSN,
    release: releaseIdentifier(source) ?? undefined,
    environment: env.DEPLOY_ENV,
    sendDefaultPii: false,
    ...ERROR_REPORTING_SAMPLING,
    beforeSend: (event) => scrubErrorEvent(event),
    beforeSendTransaction: (event) => scrubErrorEvent(event),
  };
}

/** Reports through whichever Sentry client is initialised; tags and user are per-capture. */
export function sentryErrorReporter(): ErrorReporter {
  return {
    capture(error, context = {}) {
      Sentry.withScope((scope) => {
        if (context.userId) {
          scope.setUser({ id: context.userId });
        }
        if (context.route) {
          scope.setTag('route', context.route);
        }
        if (context.requestId) {
          scope.setTag('request_id', context.requestId);
        }
        if (context.payment === true) {
          scope.setTags(PAYMENT_ERROR_TAGS);
          scope.setLevel('fatal');
        }
        // Through the same withholding as the log sink: a failed statement's
        // message and stack carry every value bound to it (#445), and the SDK
        // reads both off the error it is handed.
        Sentry.captureException(redactErrorValues(error));
      });
    },
  };
}

/**
 * Initialises Sentry once per process and returns the reporter to wire in.
 *
 * Idempotent because `server.ts`'s serverless handler and a suite can each
 * build more than one instance in a process, and a second `init` would replace
 * the client the first instance is already reporting through.
 */
export function createErrorReporter(env: Pick<ApiEnv, 'SENTRY_DSN' | 'DEPLOY_ENV'>): ErrorReporter {
  const options = sentryOptions(env);

  if (options === null) {
    return silentErrorReporter;
  }

  if (!Sentry.isInitialized()) {
    Sentry.init(options);
  }

  return sentryErrorReporter();
}
