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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed';
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
        const body: ApiError = {
          statusCode,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: messageOf(error),
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
