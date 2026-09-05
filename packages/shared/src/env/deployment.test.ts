import { describe, expect, it } from 'vitest';
import {
  PLATFORM_ENV_KEYS,
  deploymentPlatform,
  isDeployedBuild,
  isDeployedRuntime,
} from './deployment.js';

describe('deploymentPlatform', () => {
  it.each([
    [
      'Vercel',
      { VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'orla.vercel.app' },
      'https://orla.vercel.app',
    ],
    [
      'Render',
      { RENDER: 'true', RENDER_EXTERNAL_URL: 'https://orla.onrender.com' },
      'https://orla.onrender.com',
    ],
    ['Railway', { RAILWAY_PUBLIC_DOMAIN: 'orla.up.railway.app' }, 'https://orla.up.railway.app'],
  ])('recognises %s and reads its origin', (platform, source, origin) => {
    expect(deploymentPlatform(source)).toEqual({ platform, origin });
  });

  it('prefers the stable production domain over a build-specific preview host', () => {
    // A preview's share cards should point at production, not at a hostname
    // that 404s next week.
    expect(
      deploymentPlatform({
        VERCEL: '1',
        VERCEL_URL: 'orla-git-branch-abc.vercel.app',
        VERCEL_PROJECT_PRODUCTION_URL: 'orla.vercel.app',
      })?.origin,
    ).toBe('https://orla.vercel.app');
  });

  /*
   * Platform detection is a list of names, and a list of names is open-ended:
   * a build on an unnamed host would otherwise take the laptop's value set and
   * bake localhost into the artefact. This is the way out that needs no
   * release.
   */
  it('honours an explicit declaration from a host it does not know', () => {
    expect(
      deploymentPlatform({ DEPLOYMENT_PLATFORM: 'Netlify', DEPLOYMENT_ORIGIN: 'orla.netlify.app' }),
    ).toEqual({ platform: 'Netlify', origin: 'https://orla.netlify.app' });
  });

  it('is still a deployment when no origin is announced', () => {
    expect(deploymentPlatform({ DEPLOYMENT_PLATFORM: 'a container' })).toEqual({
      platform: 'a container',
      origin: null,
    });
  });

  it('lets an explicit origin fill in for a platform that announces none', () => {
    expect(
      deploymentPlatform({ RAILWAY_ENVIRONMENT: 'production', DEPLOYMENT_ORIGIN: 'api.orla.test' })
        ?.origin,
    ).toBe('https://api.orla.test');
  });

  it.each([{}, { VERCEL: '' }, { NODE_ENV: 'production' }, { CI: 'true' }])(
    'is null off a platform (%p)',
    (source) => {
      expect(deploymentPlatform(source)).toBeNull();
    },
  );

  it('leaves an origin that already carries a scheme alone', () => {
    expect(deploymentPlatform({ RENDER: 'true', RENDER_EXTERNAL_URL: 'https://a.test/' })).toEqual({
      platform: 'Render',
      origin: 'https://a.test',
    });
  });
});

describe('isDeployedBuild', () => {
  /*
   * The whole difficulty: `next build` and `tsc` set `NODE_ENV=production` for
   * a build on a laptop as readily as for a release, so a build that read it
   * would fail `pnpm build` for every developer.
   */
  it('does not treat a local production build as a deployment', () => {
    expect(isDeployedBuild({ NODE_ENV: 'production', CI: 'true' })).toBe(false);
  });

  it('treats a build on a platform as a deployment', () => {
    expect(isDeployedBuild({ VERCEL: '1' })).toBe(true);
  });
});

describe('isDeployedRuntime', () => {
  /*
   * At boot `NODE_ENV` *is* decisive, and that is what makes this
   * platform-independent: no build or typecheck executes a server.
   */
  it('treats a production boot as a deployment on any platform', () => {
    expect(isDeployedRuntime({ NODE_ENV: 'production' })).toBe(true);
  });

  it('treats a platform boot as a deployment even with no NODE_ENV', () => {
    expect(isDeployedRuntime({ RENDER: 'true' })).toBe(true);
  });

  it.each(['development', 'test'])('leaves a %s process alone', (nodeEnv) => {
    expect(isDeployedRuntime({ NODE_ENV: nodeEnv })).toBe(false);
  });
});

describe('PLATFORM_ENV_KEYS', () => {
  /*
   * Turborepo runs in strict env mode, so any variable read here that is
   * missing from this list never reaches the task — and the build would decide
   * it was on a laptop, on the one platform the gate exists for. Derivation is
   * what makes the list impossible to forget; this pins the derivation.
   */
  it.each([
    'DEPLOYMENT_PLATFORM',
    'DEPLOYMENT_ORIGIN',
    'VERCEL',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'VERCEL_URL',
    'RENDER',
    'RENDER_EXTERNAL_URL',
    'RAILWAY_PUBLIC_DOMAIN',
    'RAILWAY_ENVIRONMENT',
  ])('carries %s', (key) => {
    expect(PLATFORM_ENV_KEYS).toContain(key);
  });
});
