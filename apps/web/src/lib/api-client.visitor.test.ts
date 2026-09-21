// @vitest-environment node
import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const incoming = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock('next/headers', () => ({ headers: async () => incoming.headers }));

import { apiRequest } from './api-client';
import { callerAddress } from './auth/proxy-throttle';

const schema = z.object({ ok: z.boolean() });
const TIER_VALUE = 'k'.repeat(40);
const fetchMock = vi.fn<typeof fetch>();

function sentHeaders(): Record<string, string> {
  return fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
}

describe('apiRequest naming the visitor', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    incoming.headers = new Headers({ 'x-forwarded-for': '10.0.0.1, 203.0.113.7' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('takes the address the nearest proxy appended, not one the caller wrote first', async () => {
    vi.stubEnv('WEB_TIER_KEY', TIER_VALUE);

    await apiRequest('/categories', { schema });

    expect(sentHeaders()['x-visitor-ip']).toBe('203.0.113.7');
    expect(sentHeaders()['x-web-tier-key']).toBe(TIER_VALUE);
  });

  it('names the same visitor the auth throttle keys on', async () => {
    vi.stubEnv('WEB_TIER_KEY', TIER_VALUE);
    incoming.headers = new Headers({ 'x-forwarded-for': 'a, b' });

    await apiRequest('/categories', { schema });

    expect(sentHeaders()['x-visitor-ip']).toBe('b');
    expect(sentHeaders()['x-visitor-ip']).toBe(callerAddress(incoming.headers));
  });

  it('names the platform address on Vercel, as the throttle does', async () => {
    vi.stubEnv('WEB_TIER_KEY', TIER_VALUE);
    vi.stubEnv('VERCEL', '1');
    incoming.headers = new Headers({
      'x-real-ip': '198.51.100.9',
      'x-forwarded-for': '6.6.6.6, 203.0.113.7',
    });

    await apiRequest('/categories', { schema });

    expect(sentHeaders()['x-visitor-ip']).toBe('198.51.100.9');
  });

  it('forwards the visitor and the key on an uncached server call', async () => {
    vi.stubEnv('WEB_TIER_KEY', TIER_VALUE);
    incoming.headers = new Headers({ 'x-forwarded-for': '203.0.113.8' });

    await apiRequest('/categories', { schema });

    expect(sentHeaders()['x-visitor-ip']).toBe('203.0.113.8');
    expect(sentHeaders()['x-web-tier-key']).toBe(TIER_VALUE);
  });

  it('sends nothing when the request names no visitor', async () => {
    vi.stubEnv('WEB_TIER_KEY', TIER_VALUE);
    incoming.headers = new Headers();

    await apiRequest('/categories', { schema });

    expect(sentHeaders()['x-web-tier-key']).toBeUndefined();
  });

  it('sends nothing extra when no key is configured', async () => {
    vi.stubEnv('WEB_TIER_KEY', '');

    await apiRequest('/categories', { schema });

    expect(sentHeaders()['x-visitor-ip']).toBeUndefined();
    expect(sentHeaders()['x-web-tier-key']).toBeUndefined();
  });

  it('leaves a cached call alone, so it stays shareable between visitors', async () => {
    vi.stubEnv('WEB_TIER_KEY', TIER_VALUE);

    await apiRequest('/categories', { schema, revalidate: 60 });

    expect(sentHeaders()['x-visitor-ip']).toBeUndefined();
  });
});
