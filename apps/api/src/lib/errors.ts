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

/** The account is banned: a 403 the browser recognises as terminal. */
export function accountSuspended(message = 'This account has been suspended'): AppError {
  return new AppError(403, ERROR_CODES.ACCOUNT_SUSPENDED, message);
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

/**
 * A customer with no real name asked for something that would show it to
 * another user (VEN-701). A 403 with its own code, like `termsRequiredError`,
 * because the reader clears it themselves on the name step.
 */
export function nameRequiredError(message = 'Add your name to continue.'): AppError {
  return new AppError(403, ERROR_CODES.NAME_REQUIRED, message);
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

/** The caller is over a cap this API holds itself; the client backs off. */
export function tooManyRequests(message: string): AppError {
  return new AppError(429, ERROR_CODES.RATE_LIMITED, message);
}
