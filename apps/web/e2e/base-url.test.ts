import { describe, expect, it } from 'vitest';

import { resolveE2EBaseUrl } from './base-url.js';

describe('resolveE2EBaseUrl', () => {
  it('prefers E2E_BASE_URL, which is how a run is aimed at a deployed origin', () => {
    expect(
      resolveE2EBaseUrl({
        E2E_BASE_URL: 'https://web-gules-eta-41.vercel.app',
        WEB_URL: 'http://localhost:3031',
      }),
    ).toBe('https://web-gules-eta-41.vercel.app');
  });

  it('takes the first origin of WEB_URL, which is a comma-separated CORS list', () => {
    expect(resolveE2EBaseUrl({ WEB_URL: 'http://localhost:3031,http://localhost:3000' })).toBe(
      'http://localhost:3031',
    );
  });

  it('strips a trailing slash so paths do not become double-slashed', () => {
    expect(resolveE2EBaseUrl({ E2E_BASE_URL: 'http://localhost:3031/' })).toBe(
      'http://localhost:3031',
    );
    expect(resolveE2EBaseUrl({ WEB_URL: 'http://localhost:3031///' })).toBe(
      'http://localhost:3031',
    );
  });

  /*
   * The whole point of this module. `scripts/e2e-base-url.mjs` defaults to
   * :3000 because signing in from the main checkout should; a suite must not,
   * because :3000 is another lane's server on the shared database.
   */
  it('throws rather than defaulting to port 3000 when nothing is set', () => {
    expect(() => resolveE2EBaseUrl({})).toThrow(/refusing to default/i);
  });

  it('names the lane command in the failure, so the fix is in the message', () => {
    expect(() => resolveE2EBaseUrl({})).toThrow(/pnpm lane:exec/);
  });

  it('does not treat an empty or whitespace value as set', () => {
    expect(() => resolveE2EBaseUrl({ E2E_BASE_URL: '   ', WEB_URL: '' })).toThrow(
      /refusing to default/i,
    );
  });

  /*
   * WEB_PORT is deliberately NOT consulted. The auth script uses it, but a port
   * with no origin cannot distinguish localhost from a deployed host, and
   * honouring it here would reintroduce the silent-wrong-target failure.
   */
  it('ignores WEB_PORT rather than reconstructing an origin from it', () => {
    expect(() => resolveE2EBaseUrl({ WEB_PORT: '3031' })).toThrow(/refusing to default/i);
  });
});
