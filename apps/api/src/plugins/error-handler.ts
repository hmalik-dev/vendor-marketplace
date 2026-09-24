import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { isDatabaseTimeout } from '@vendor-marketplace/db';
import { ERROR_CODES, type ApiError } from '@vendor-marketplace/shared';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors.js';
import { type ErrorReporter, silentErrorReporter } from '../lib/error-reporting.js';

/** Fastify types the error handler's argument as `unknown` under strict mode. */
function statusCodeOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const { statusCode } = error as { statusCode: unknown };
    return typeof statusCode === 'number' ? statusCode : null;
  }

  return null;
}

/**
 * Fastify and its plugins signal with a `FST_`-prefixed code, and their
 * messages are written about the request — "Request file too large", "Unsupported
 * Media Type" — so they are safe to hand back.
 */
function isFastifyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('FST_')
  );
}

/**
 * The message a 4xx may carry back to the client.
 *
 * **Only Fastify's own errors get to speak.** A third-party SDK error is not
 * copy anyone wrote for a reader, and several of them carry a numeric
 * `statusCode` that lands in the same branch: `stripe-node` sets one and a
 * message naming the API key and its mode, auth sets `status`, the AWS SDK
 * sets `$metadata.httpStatusCode`. Passing those through turned an upstream
 * misconfiguration into a client-visible disclosure. The status still passes
 * through, because it is the right answer; the sentence does not.
 */
function messageOf(error: unknown, statusCode: number): string {
  if (isFastifyError(error) && error instanceof Error) {
    return error.message;
  }

  return statusCode === 404 ? 'Resource not found' : 'Request failed';
}

export interface ErrorHandlerOptions {
  /** Where a failure the client cannot be told about is reported. Silent when absent. */
  reporter?: ErrorReporter;
  /**
   * Route patterns that move money. A failure on one is reported as a payment
   * error, which is what the admin's alert rule pages on.
   */
  paymentRoutes?: ReadonlySet<string>;
}

/**
 * Single exit point for every failed request. Known failures map to their
 * `apiErrorSchema` shape; everything else is logged with full context and
 * answered with an opaque 500 so stack traces, SQL, and paths never leave
 * the process.
 */
export const errorHandlerPlugin = fp<ErrorHandlerOptions>(
  async (app, options) => {
    const reporter = options.reporter ?? silentErrorReporter;
    const paymentRoutes = options.paymentRoutes ?? new Set<string>();

    /*
     * Everything logged at error level below is also reported: those are the
     * failures the client is answered opaquely about, so the tracker is the
     * only place anyone learns of them. A 4xx the caller caused is not.
     */
    const report = (error: unknown, request: FastifyRequest): void => {
      const route = request.routeOptions.url;

      reporter.capture(error, {
        userId: request.auth?.authUserId ?? null,
        route,
        payment: route !== undefined && paymentRoutes.has(route),
      });
    };

    app.setErrorHandler((error, request, reply) => {
      if (hasZodFastifySchemaValidationErrors(error)) {
        const body: ApiError = {
          statusCode: 400,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Request validation failed',
          details: error.validation,
        };
        return reply.status(400).send(body);
      }

      if (isResponseSerializationError(error)) {
        request.log.error(
          { err: error, route: request.routeOptions.url },
          'Response failed its schema',
        );
        report(error, request);
        const body: ApiError = {
          statusCode: 500,
          error: ERROR_CODES.INTERNAL_ERROR,
          message: 'Internal server error',
        };
        return reply.status(500).send(body);
      }

      /*
       * A body the client never finished delivering: the request deadline (or the
       * client itself) destroyed the socket mid-read, so the stream error is the
       * defence working. Nothing to page, and no one left to answer.
       */
      if (request.raw.destroyed && !request.raw.readableEnded) {
        request.log.info(
          { method: request.method, route: request.routeOptions.url },
          'Request body abandoned',
        );
        return reply.status(408).send();
      }

      if (error instanceof AppError) {
        const body: ApiError = {
          statusCode: error.statusCode,
          error: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        };
        if (error.statusCode >= 500) {
          request.log.error({ err: error }, 'Application error');
          report(error, request);
        }
        return reply.status(error.statusCode).send(body);
      }

      /*
       * The database gave up on a statement or a lock wait (VEN-607). Retryable,
       * so a 503, and the message is ours: the SQL and the table stay in the log.
       */
      if (isDatabaseTimeout(error)) {
        request.log.error(
          { err: error, method: request.method, route: request.routeOptions.url },
          'Database timed out',
        );
        report(error, request);
        const body: ApiError = {
          statusCode: 503,
          error: ERROR_CODES.SERVICE_BUSY,
          message: 'This is taking longer than expected. Please try again in a moment.',
        };
        return reply.status(503).send(body);
      }

      // @fastify/rate-limit and other plugins throw plain Fastify errors.
      const statusCode = statusCodeOf(error);

      if (statusCode === 429) {
        const body: ApiError = {
          statusCode: 429,
          error: ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests. Please try again shortly.',
        };
        return reply.status(429).send(body);
      }

      if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
        // Logged in full even though the reply is generic: the upstream detail
        // is exactly what a support question needs and exactly what a client
        // must not be shown.
        if (!isFastifyError(error)) {
          request.log.error(
            { err: error, method: request.method, route: request.routeOptions.url },
            'Upstream dependency answered 4xx',
          );
          report(error, request);
        }

        const body: ApiError = {
          statusCode,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: messageOf(error, statusCode),
        };
        return reply.status(statusCode).send(body);
      }

      request.log.error(
        { err: error, method: request.method, route: request.routeOptions.url },
        'Unhandled error',
      );
      report(error, request);
      const body: ApiError = {
        statusCode: 500,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
      };
      return reply.status(500).send(body);
    });

    app.setNotFoundHandler((request, reply) => {
      // The path only: a query string can carry a token, and echoing it puts
      // it in every log between here and the caller (VEN-618).
      const path = request.routeOptions.url ?? request.url.split('?')[0];
      const body: ApiError = {
        statusCode: 404,
        error: ERROR_CODES.NOT_FOUND,
        message: `Route ${request.method} ${path} not found`,
      };
      return reply.status(404).send(body);
    });
  },
  { name: 'error-handler' },
);
