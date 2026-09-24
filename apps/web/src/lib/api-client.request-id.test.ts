/**
 * @vitest-environment node
 *
 * VEN-690. On the **node** environment because the id is sent only server
 * side (`typeof window === 'undefined'`); a browser call would need the header
 * in the API's CORS allow-list.
 */
import { REQUEST_ID_HEADER } from '@vendor-marketplace/shared';
import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiRequest } from './api-client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const bodySchema = z.object({ id: z.string() });
const fetchMock = vi.fn<typeof fetch>();

function failure(headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ statusCode: 500, error: 'INTERNAL_ERROR', message: 'Internal server error' }),
    { status: 500, headers: { 'content-type': 'application/json', ...headers } },
  );
}

function sentId(): string {
  const init = fetchMock.mock.calls[0]?.[1];
  return (init?.headers as Record<string, string>)[REQUEST_ID_HEADER]!;
}

describe('apiRequest request id', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a fresh UUID on every server-side call', async () => {
    fetchMock.mockImplementation(async () => new Response('{"id":"a"}', { status: 200 }));

    await apiRequest('/x', { schema: bodySchema });
    await apiRequest('/x', { schema: bodySchema });

    const ids = fetchMock.mock.calls.map(
      ([, init]) => (init?.headers as Record<string, string>)[REQUEST_ID_HEADER],
    );
    expect(ids[0]).toMatch(UUID);
    expect(ids[1]).toMatch(UUID);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("puts the API's id on the failure as its digest, which is what the error page shows", async () => {
    const answered = '5f0c2a52-7d7e-4a52-9f3e-2f6c1f7a9b10';
    fetchMock.mockResolvedValue(failure({ [REQUEST_ID_HEADER]: answered }));

    const error = await apiRequest('/x', { schema: bodySchema }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).digest).toBe(answered);
  });

  it('sends no id on a cached call, because Next keys the Data Cache on request headers', async () => {
    fetchMock.mockImplementation(async () => new Response('{"id":"a"}', { status: 200 }));

    await apiRequest('/categories', { schema: bodySchema, revalidate: 300 });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(Object.keys(init?.headers as Record<string, string>)).not.toContain(REQUEST_ID_HEADER);
  });

  it('ignores an answered id that is not a UUID, so a proxy header cannot become a digest', async () => {
    fetchMock.mockResolvedValue(failure({ [REQUEST_ID_HEADER]: 'NEXT_REDIRECT;replace;/x;307;' }));

    const error = await apiRequest('/x', { schema: bodySchema }).catch((e: unknown) => e);

    expect((error as ApiClientError).digest).toBe(sentId());
    expect((error as ApiClientError).digest).toMatch(UUID);
  });

  it('falls back to the id it sent when the response names none', async () => {
    fetchMock.mockResolvedValue(failure());

    const error = await apiRequest('/x', { schema: bodySchema }).catch((e: unknown) => e);

    expect((error as ApiClientError).digest).toBe(sentId());
  });
});
