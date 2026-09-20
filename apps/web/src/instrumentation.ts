import * as Sentry from '@sentry/nextjs';
import { webSentryOptions } from './config/error-reporting';

/**
 * Server and edge error reporting. Next calls `register` once per runtime, and
 * `@sentry/nextjs` resolves to the matching SDK for each, so one `init` covers
 * both. No DSN — a laptop — leaves the SDK uninitialised and every capture a
 * no-op.
 */
export function register(): void {
  const options = webSentryOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    environment: process.env.DEPLOY_ENV,
    deployed: process.env.NODE_ENV === 'production',
  });

  if (options !== null) {
    Sentry.init(options);
  }
}

/** Errors thrown while rendering a server component, a route handler or middleware. */
export const onRequestError = Sentry.captureRequestError;
