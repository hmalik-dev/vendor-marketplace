import { ERROR_CODES, type ErrorCode } from '@vendorhub/shared';

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

export function notFound(message = 'Resource not found'): AppError {
  return new AppError(404, ERROR_CODES.NOT_FOUND, message);
}

export function validationFailed(message: string, details?: unknown): AppError {
  return new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
}
