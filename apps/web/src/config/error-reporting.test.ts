import * as Sentry from '@sentry/nextjs';
import { PAYMENT_ERROR_TAGS } from '@vendor-marketplace/shared';
import { releaseIdentifier } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';
import {
  boundaryCaptureContext,
  errorIngestOrigin,
  sentryBuildOptions,
  webSentryOptions,
} from './error-reporting';
import { contentSecurityPolicy } from './security-headers';

const DSN = 'https://abc123@o1.ingest.sentry.io/42';
const EMAIL = ['ada', 'example.com'].join('@');
// Composed rather than written: an upload token is exactly what the scanners stop.
const UPLOAD = ['sntrys', 'fixtureUploadTokenValue0123456789'].join('_');

/** The build environment the deploy workflow gives `next build`. */
function uploadEnv(
  tok: string | undefined,
  project: string | undefined,
): Record<string, string | undefined> {
  return { SENTRY_AUTH_TOKEN: tok, SENTRY_WEB_PROJECT: project };
}

describe('webSentryOptions', () => {
  it('turns reporting off without a DSN, which only a laptop may have', () => {
    expect(
      webSentryOptions({ dsn: undefined, release: 'a1b2c3d', environment: undefined }),
    ).toBeNull();
    expect(webSentryOptions({ dsn: '', release: undefined, environment: undefined })).toBeNull();
  });

  it('samples explicitly, sends no default PII and names the release', () => {
    const options = webSentryOptions({ dsn: DSN, release: 'a1b2c3d', environment: 'production' })!;

    expect(options).toMatchObject({
      dsn: DSN,
      release: 'a1b2c3d',
      environment: 'production',
      sendDefaultPii: false,
      sampleRate: 1,
      tracesSampleRate: 0.05,
    });
  });

  /*
   * The chain the deploy workflow relies on: it sets `SENTRY_RELEASE`, and
   * `next.config.ts` inlines `releaseIdentifier()` as the SDK's release and
   * names the same value to the source-map upload.
   */
  it('reports the release the workflow set, and uploads maps under the same name', () => {
    const release = releaseIdentifier({
      SENTRY_RELEASE: 'wf-sha',
      VERCEL_GIT_COMMIT_SHA: 'vercel',
    });
    const build = sentryBuildOptions(uploadEnv(UPLOAD, 'orla-web'), release);

    expect(webSentryOptions({ dsn: DSN, release: release!, environment: undefined })!.release).toBe(
      'wf-sha',
    );
    expect(build.release).toEqual({ name: 'wf-sha', create: true });
  });
});

/*
 * Through the real SDK, asserted at the scrubbing hook: the recorder returns
 * `null`, so nothing is sent.
 */
describe('what the web app reports, at the scrubbing hook', () => {
  it('keeps the user id and the checkout tags, and no email or session token', async () => {
    const options = webSentryOptions({ dsn: DSN, release: 'a1b2c3d', environment: 'production' })!;
    const seen: Sentry.ErrorEvent[] = [];
    const session = ['eyJhbGciOiJSUzI1NiJ9', 'eyJzdWIiOiJ1c2VyIn0', 'c2ln'].join('.');

    Sentry.init({
      ...options,
      defaultIntegrations: false,
      beforeSend: (event, hint) => {
        seen.push(options.beforeSend!(event, hint) as Sentry.ErrorEvent);
        return null;
      },
    });
    Sentry.setUser({ id: 'user_2abc', email: EMAIL });
    Sentry.captureException(
      new Error(`confirmPayment failed for ${EMAIL} with ${session}`),
      boundaryCaptureContext({ payment: true, digest: 'abc' }),
    );
    await Sentry.flush(2_000);

    expect(seen).toHaveLength(1);
    expect(seen[0]!.user).toEqual({ id: 'user_2abc' });
    expect(seen[0]!.release).toBe('a1b2c3d');
    expect(seen[0]!.tags).toMatchObject(PAYMENT_ERROR_TAGS);
    expect(JSON.stringify(seen[0])).not.toContain(EMAIL);
    expect(JSON.stringify(seen[0])).not.toContain(session);

    await Sentry.close();
  });
});

describe('boundaryCaptureContext', () => {
  it('tags the checkout boundary critical and leaves the others untagged', () => {
    expect(boundaryCaptureContext({ payment: true, digest: undefined })).toEqual({
      tags: PAYMENT_ERROR_TAGS,
      level: 'fatal',
    });
    expect(boundaryCaptureContext({ payment: false, digest: 'd1' })).toEqual({
      extra: { digest: 'd1' },
    });
  });
});

describe('sentryBuildOptions', () => {
  it('uploads source maps only with a token, a project and a release', () => {
    expect(sentryBuildOptions(uploadEnv(UPLOAD, 'orla-web'), 'a1b2c3d')).toMatchObject({
      authToken: UPLOAD,
      project: 'orla-web',
      sourcemaps: { disable: false, deleteSourcemapsAfterUpload: true },
      telemetry: false,
    });
  });

  it('skips the upload on every other build instead of failing it', () => {
    for (const [source, release] of [
      [uploadEnv(undefined, undefined), 'a1b2c3d'],
      [uploadEnv(UPLOAD, undefined), 'a1b2c3d'],
      [uploadEnv(UPLOAD, 'orla-web'), null],
    ] as const) {
      const options = sentryBuildOptions(source, release);

      expect(options.authToken).toBeUndefined();
      expect(options.sourcemaps).toEqual({ disable: true, deleteSourcemapsAfterUpload: true });
      expect(options.release?.create).toBe(false);
    }
  });
});

describe('the CSP and the ingest host', () => {
  it('admits exactly the DSN host on connect-src, and nothing when reporting is off', () => {
    const origin = errorIngestOrigin(DSN);
    const base = { apiOrigin: 'https://api.example.com', https: true, allowEval: false };

    expect(origin).toBe('https://o1.ingest.sentry.io');
    expect(contentSecurityPolicy({ ...base, errorIngestOrigin: origin })).toMatch(
      /connect-src [^;]* https:\/\/o1\.ingest\.sentry\.io(;|$)/,
    );
    expect(
      contentSecurityPolicy({ ...base, errorIngestOrigin: errorIngestOrigin(undefined) }),
    ).not.toContain('sentry');
  });
});
