import * as Sentry from '@sentry/nextjs';
import { webSentryOptions } from './config/error-reporting';

/*
 * Browser error reporting. Each `process.env.NEXT_PUBLIC_*` is written out in
 * full because that is the only form the bundler inlines.
 */
const options = webSentryOptions({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV,
  deployed: process.env.NODE_ENV === 'production',
});

if (options !== null) {
  Sentry.init(options);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
