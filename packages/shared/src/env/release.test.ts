import { describe, expect, it } from 'vitest';
import { RELEASE_ENV_KEYS, releaseIdentifier } from './release.js';

describe('releaseIdentifier', () => {
  it('prefers the release the deploy workflow sets over the platform commit', () => {
    expect(
      releaseIdentifier({ SENTRY_RELEASE: 'abc1234', RAILWAY_GIT_COMMIT_SHA: 'def5678' }),
    ).toBe('abc1234');
  });

  it('falls back to each platform commit variable in order', () => {
    for (const key of RELEASE_ENV_KEYS) {
      expect(releaseIdentifier({ [key]: ` ${key}-sha ` }), key).toBe(`${key}-sha`);
    }
  });

  it('answers null off a deployment, and treats blank as absent', () => {
    expect(releaseIdentifier({})).toBeNull();
    expect(releaseIdentifier({ SENTRY_RELEASE: '  ' })).toBeNull();
  });
});
