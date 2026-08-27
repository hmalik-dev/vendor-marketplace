import { apiErrorSchema, ERROR_CODES, type ErrorCode } from '@vendor-marketplace/shared';
import type { z } from 'zod';

/**
 * Browser calls need an absolute origin at build time; server calls may use a
 * private origin that never reaches the client bundle.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

/** A failed API call, carrying the structured `apiErrorSchema` fields. */
export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestOptions<T> {
  /** Validates the success body; the parsed value is what callers receive. */
  schema: z.ZodType<T>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Clerk session token. `null` sends the request unauthenticated. */
  token?: string | null;
  signal?: AbortSignal;
  /**
   * Seconds to cache this response on the server, for **public reference data
   * only** — the taxonomy and the tag vocabulary, which every page needs and
   * which change when ops edit them rather than per request.
   *
   * Anything scoped to a session or a vendor must leave this unset and keep
   * the default `no-store`: a cached response is shared between visitors, and
   * one customer reading another's data is the failure this guards against.
   * Ignored in the browser, where `fetch` has no `next` option.
   */
  revalidate?: number;
}

/** Reads the API's structured error body, tolerating a non-JSON failure page. */
async function toClientError(response: Response): Promise<ApiClientError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const parsed = apiErrorSchema.safeParse(payload);
  if (parsed.success) {
    return new ApiClientError(
      parsed.data.statusCode,
      parsed.data.error,
      parsed.data.message,
      parsed.data.details,
    );
  }

  return new ApiClientError(
    response.status,
    ERROR_CODES.INTERNAL_ERROR,
    `Request failed with status ${response.status}`,
  );
}

/**
 * Reads a success body. A 204 carries no body at all, so `response.json()`
 * would reject on it — the empty body becomes `null`, which a `z.null()`
 * schema accepts and every other schema correctly rejects.
 */
async function readJsonBody(response: Response, path: string): Promise<unknown> {
  const raw = await response.text();

  if (raw.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiClientError(
      response.status,
      ERROR_CODES.INTERNAL_ERROR,
      `API response for ${path} was not valid JSON`,
    );
  }
}

/**
 * The single fetch path to the Fastify API. Every response is validated
 * against a schema, so a contract drift surfaces here rather than as a
 * `undefined` deep inside a component.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
  const { schema, method = 'GET', body, token, signal, revalidate } = options;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
    // `cache` and `next.revalidate` are mutually exclusive — sending both makes
    // Next ignore the revalidate and store nothing.
    ...(revalidate === undefined ? { cache: 'no-store' as const } : { next: { revalidate } }),
  });

  if (!response.ok) {
    throw await toClientError(response);
  }

  const parsed = schema.safeParse(await readJsonBody(response, path));
  if (!parsed.success) {
    throw new ApiClientError(
      response.status,
      ERROR_CODES.INTERNAL_ERROR,
      `API response for ${path} did not match its schema`,
      parsed.error.issues,
    );
  }

  return parsed.data;
}
