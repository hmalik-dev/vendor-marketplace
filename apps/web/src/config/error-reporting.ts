import type { BrowserOptions, captureException } from '@sentry/nextjs';
import type { SentryBuildOptions } from '@sentry/nextjs';
import {
  ERROR_REPORTING_SAMPLING,
  PAYMENT_ERROR_TAGS,
  scrubErrorEvent,
} from '@vendor-marketplace/shared';

/**
 * The web app's Sentry options — one function for the browser, the Node server
 * and the edge runtime, so the three cannot disagree about sampling or about
 * what leaves the process.
 *
 * Inputs are passed in rather than read here because the browser only receives
 * a `NEXT_PUBLIC_*` value where the bundle names it literally: each
 * `instrumentation*.ts` file reads `process.env.NEXT_PUBLIC_SENTRY_DSN` itself
 * and hands it over.
 */
export interface WebReportingInputs {
  /** `NEXT_PUBLIC_SENTRY_DSN`. The env registry requires it on a deployed build. */
  readonly dsn: string | undefined;
  /** `NEXT_PUBLIC_SENTRY_RELEASE`, inlined by `next.config.ts` from `releaseIdentifier`. */
  readonly release: string | undefined;
  /** `VERCEL_ENV` on the platform; absent on a laptop. */
  readonly environment: string | undefined;
  /**
   * Whether this process is serving a deployment: `NODE_ENV === 'production'`,
   * written out at each call site because the browser bundle inlines only that
   * literal form. It is what decides the tag when `environment` is empty.
   */
  readonly deployed: boolean;
}

/** `null` means reporting is off: no DSN, which the registry allows only off a deployment. */
export function webSentryOptions(inputs: WebReportingInputs): BrowserOptions | null {
  if (!inputs.dsn) {
    return null;
  }

  return {
    dsn: inputs.dsn,
    release: inputs.release || undefined,
    environment: inputs.environment || (inputs.deployed ? 'production' : 'development'),
    sendDefaultPii: false,
    ...ERROR_REPORTING_SAMPLING,
    beforeSend: (event) => scrubErrorEvent(event),
    beforeSendTransaction: (event) => scrubErrorEvent(event),
  };
}

/** The capture context an error boundary passes: payment boundaries tag their failures critical. */
export function boundaryCaptureContext(options: {
  readonly payment: boolean;
  readonly digest: string | undefined;
}): NonNullable<Parameters<typeof captureException>[1]> {
  return {
    ...(options.payment ? { tags: { ...PAYMENT_ERROR_TAGS }, level: 'fatal' as const } : {}),
    ...(options.digest ? { extra: { digest: options.digest } } : {}),
  };
}

/**
 * The origin the browser SDK posts events to, for the CSP's `connect-src`.
 *
 * Read from the DSN rather than allow-listing `*.sentry.io`, so the policy
 * admits exactly the one ingest host this build reports to.
 */
export function errorIngestOrigin(dsn: string | undefined): string | undefined {
  if (!dsn) {
    return undefined;
  }

  try {
    return new URL(dsn).origin;
  } catch {
    return undefined;
  }
}

/**
 * Options for `withSentryConfig`, which uploads source maps at build time.
 *
 * Only a build holding the upload token uploads — the production web build in
 * the deploy workflow. Every other build (a laptop, CI, a preview) skips the
 * upload rather than failing on a credential it was never meant to have, and
 * the deploy workflow refuses to start without one, which is where its absence
 * is a defect. The release named here is the one the SDK reports, so a stack
 * frame resolves against the maps uploaded for the commit that threw.
 */
export function sentryBuildOptions(
  source: Readonly<Record<string, string | undefined>>,
  release: string | null,
): SentryBuildOptions {
  const authToken = source.SENTRY_AUTH_TOKEN?.trim() || undefined;
  const project = source.SENTRY_WEB_PROJECT?.trim() || undefined;
  const uploading = authToken !== undefined && project !== undefined && release !== null;

  return {
    ...(uploading ? { authToken, project } : {}),
    release: { ...(release === null ? {} : { name: release }), create: uploading },
    sourcemaps: { disable: !uploading, deleteSourcemapsAfterUpload: true },
    telemetry: false,
    silent: !uploading,
  };
}
