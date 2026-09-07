import { ERROR_CODES, type ErrorCode } from '@vendor-marketplace/shared';

/**
 * The only error class the API throws deliberately. The error handler plugin
 * turns it into the `apiErrorSchema` response shape; anything else that
 * reaches the handler is logged and reported as a generic 500 so internals
 * (stack traces, SQL, hostnames) never reach a client.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError(401, ERROR_CODES.UNAUTHORIZED, message);
}

export function forbidden(message = 'You do not have access to this resource'): AppError {
  return new AppError(403, ERROR_CODES.FORBIDDEN, message);
}

/**
 * The session is real; the account has not accepted the current Terms.
 *
 * A 403 rather than a 401 because the caller has proved who they are, and its
 * own code rather than `FORBIDDEN` because the two are opposite instructions to
 * the frontend: a `FORBIDDEN` is terminal and sends the reader to `/suspended`,
 * while this is a gate they clear themselves in one click.
 */
export function termsRequiredError(message = 'Accept the Terms of Service to continue.'): AppError {
  return new AppError(403, ERROR_CODES.TERMS_REQUIRED, message);
}

export function notFound(message = 'Resource not found'): AppError {
  return new AppError(404, ERROR_CODES.NOT_FOUND, message);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, ERROR_CODES.CONFLICT, message, details);
}

export function validationFailed(message: string, details?: unknown): AppError {
  return new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
}
