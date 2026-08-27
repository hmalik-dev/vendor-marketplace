import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiRequest } from './api-client';

const bodySchema = z.object({ id: z.string(), name: z.string() });

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const fetchMock = vi.fn<typeof fetch>();

describe('apiRequest', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1', name: 'Ada' }));

    await expect(apiRequest('/users/me', { schema: bodySchema })).resolves.toEqual({
      id: 'u1',
      name: 'Ada',
    });
  });

  it('sends the bearer token when one is supplied', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1', name: 'Ada' }));

    await apiRequest('/users/me', { schema: bodySchema, token: 'session-token' });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toBeDefined();
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer session-token');
  });

  it('omits the authorization header when there is no token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1', name: 'Ada' }));

    await apiRequest('/users/me', { schema: bodySchema, token: null });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it('serializes a body and sets the content type for writes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1', name: 'Byron' }));

    await apiRequest('/users/me', {
      schema: bodySchema,
      method: 'PUT',
      body: { name: 'Byron' },
    });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe('{"name":"Byron"}');
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('surfaces the API error code and message from a structured failure', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        statusCode: 403,
        error: 'FORBIDDEN',
        message: 'This account has been suspended',
      }),
    );

    await expect(apiRequest('/users/me', { schema: bodySchema })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiClientError &&
        error.statusCode === 403 &&
        error.code === 'FORBIDDEN' &&
        error.message === 'This account has been suspended',
    );
  });

  it('falls back to the HTTP status when the failure body is not our error shape', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(apiRequest('/users/me', { schema: bodySchema })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiClientError &&
        error.statusCode === 502 &&
        error.code === 'INTERNAL_ERROR',
    );
  });

  it('rejects a success body that does not match the schema', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1' }));

    await expect(apiRequest('/users/me', { schema: bodySchema })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiClientError && error.message.includes('did not match its schema'),
    );
  });

  it('reads a bodiless 204 as null rather than failing to parse it', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      apiRequest('/vendor/portfolio/abc', { schema: z.null(), method: 'DELETE' }),
    ).resolves.toBeNull();
  });

  it('still rejects an empty body against a schema that expects one', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiRequest('/users/me', { schema: bodySchema })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiClientError && error.message.includes('did not match its schema'),
    );
  });

  it('reports a success body that is not valid JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('<!doctype html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(apiRequest('/users/me', { schema: bodySchema })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiClientError && error.message.includes('was not valid JSON'),
    );
  });
});
