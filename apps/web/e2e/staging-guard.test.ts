import { describe, expect, it } from 'vitest';
import { assertStagingEnvironment, StagingGuardError } from './staging-guard.js';

const STAGING_URL = 'https://vendor-marketplace-web-git-staging-example.vercel.app';

describe('assertStagingEnvironment', () => {
  it('returns the origin when STAGING_WEB_URL names staging and DEPLOY_ENV is local', () => {
    expect(assertStagingEnvironment({ STAGING_WEB_URL: STAGING_URL, DEPLOY_ENV: 'local' })).toBe(
      STAGING_URL,
    );
  });

  it('treats an unset DEPLOY_ENV as local', () => {
    expect(assertStagingEnvironment({ STAGING_WEB_URL: STAGING_URL })).toBe(STAGING_URL);
  });

  it('refuses a non-local DEPLOY_ENV', () => {
    expect(() =>
      assertStagingEnvironment({ STAGING_WEB_URL: STAGING_URL, DEPLOY_ENV: 'production' }),
    ).toThrow(StagingGuardError);
  });

  it('refuses a missing STAGING_WEB_URL', () => {
    expect(() => assertStagingEnvironment({ DEPLOY_ENV: 'local' })).toThrow(StagingGuardError);
  });

  it('refuses a STAGING_WEB_URL that is not a valid URL', () => {
    expect(() =>
      assertStagingEnvironment({ STAGING_WEB_URL: 'not a url', DEPLOY_ENV: 'local' }),
    ).toThrow(StagingGuardError);
  });

  it('refuses a host that does not name staging', () => {
    expect(() =>
      assertStagingEnvironment({
        STAGING_WEB_URL: 'https://vendor-marketplace-web.vercel.app',
        DEPLOY_ENV: 'local',
      }),
    ).toThrow(StagingGuardError);
  });

  it('refuses when CI is set, even with an otherwise-valid environment', () => {
    expect(() =>
      assertStagingEnvironment({ STAGING_WEB_URL: STAGING_URL, DEPLOY_ENV: 'local', CI: 'true' }),
    ).toThrow(StagingGuardError);
  });

  it('accepts a staging host regardless of case', () => {
    expect(() =>
      assertStagingEnvironment({
        STAGING_WEB_URL: 'https://vendor-marketplace-web-git-STAGING.vercel.app',
        DEPLOY_ENV: 'local',
      }),
    ).not.toThrow();
  });
});
