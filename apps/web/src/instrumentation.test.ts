import * as Sentry from '@sentry/nextjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

const DSN = 'https://abc123@o1.ingest.sentry.io/42';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.mocked(Sentry.init).mockClear();
});

describe('Sentry environment', () => {
  it.each(['local', 'staging', 'production'])(
    'the server reports DEPLOY_ENV=%s, not the platform env',
    async (tier) => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
      vi.stubEnv('DEPLOY_ENV', tier);
      vi.stubEnv('VERCEL_ENV', 'production');

      const { register } = await import('./instrumentation');
      register();

      expect(vi.mocked(Sentry.init).mock.calls[0]?.[0]?.environment).toBe(tier);
    },
  );

  it.each(['local', 'staging', 'production'])(
    'the browser reports NEXT_PUBLIC_DEPLOY_ENV=%s, not the platform env',
    async (tier) => {
      vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN);
      vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', tier);
      vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production');

      await import('./instrumentation-client');

      expect(vi.mocked(Sentry.init).mock.calls[0]?.[0]?.environment).toBe(tier);
    },
  );
});
