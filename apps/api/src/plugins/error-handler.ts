import fp from 'fastify-plugin';
import { ERROR_CODES, type ApiError } from '@vendor-marketplace/shared';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors.js';

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
 * message naming the API key and its mode, Clerk sets `status`, the AWS SDK
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

/**
 * Single exit point for every failed request. Known failures map to their
 * `apiErrorSchema` shape; everything else is logged with full context and
 * answered with an opaque 500 so stack traces, SQL, and paths never leave
 * the process.
 */
export const errorHandlerPlugin = fp(
  async (app) => {
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
        const body: ApiError = {
          statusCode: 500,
          error: ERROR_CODES.INTERNAL_ERROR,
          message: 'Internal server error',
        };
        return reply.status(500).send(body);
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
        }
        return reply.status(error.statusCode).send(body);
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
      const body: ApiError = {
        statusCode: 500,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
      };
      return reply.status(500).send(body);
    });

    app.setNotFoundHandler((request, reply) => {
      const body: ApiError = {
        statusCode: 404,
        error: ERROR_CODES.NOT_FOUND,
        message: `Route ${request.method} ${request.url} not found`,
      };
      return reply.status(404).send(body);
    });
  },
  { name: 'error-handler' },
);
