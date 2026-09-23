import { describe, expect, it } from 'vitest';
import { apiOrigin } from '@/config/public-env';
import { apiBaseUrl } from './api-base-url';

describe('apiBaseUrl', () => {
  it('is the API origin under the /v1 prefix every versioned route is served at', () => {
    expect(apiBaseUrl()).toBe(`${apiOrigin()}/v1`);
  });

  it('carries a server-only fallback origin through to the same prefix', () => {
    const origin = apiOrigin('http://api.internal:4000');

    expect(apiBaseUrl('http://api.internal:4000')).toBe(`${origin}/v1`);
  });
});
