import { apiErrorSchema, ERROR_CODES, type ErrorCode } from '@vendor-marketplace/shared';
import type { z } from 'zod';

/**
 * Browser calls need an absolute origin at build time; server calls may use a
 * private origin that never reaches the client bundle.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

/**
 * How long any one **server-side** call to the API may take before it is
 * abandoned. Browser calls are deliberately unbounded — see the deadline in
 * `apiRequest` for why abandoning a client write is worse than waiting.
 *
 * Declared once, here, because the value has to be a property of the fetch
 * path rather than of a call site: a deadline that each loader opts into is a
 * deadline the next loader forgets, and the loader that forgets is the one
 * that renders the front door.
 *
 * Without it "slow" and "never" are the same event. A suspended API accepts
 * the connection and never answers, so `fetch` waits on undici's 300s header
 * timeout while the visitor holds a blank tab and the platform's own gateway
 * eventually ends it — on Vercel a 504 in its chrome, not ours. Measured on
 * 2026-08-31: `/` and `/vendors/<slug>` both sat at 35s and 0 bytes.
 *
 * 8s rather than something tighter: the API answers in ~100ms warm, so this
 * only ever fires on a genuinely wedged upstream, and a cold serverless
 * database connection is allowed to be slow once without turning a working
 * page into an error state.
 */
export const API_REQUEST_TIMEOUT_MS = 8_000;

/**
 * The API did not answer inside {@link API_REQUEST_TIMEOUT_MS}.
 *
 * Deliberately **not** an `ApiClientError`: that type means the API answered
 * and said no, and the two must not be confused. `getPublicVendorProfile`
 * turns a 404 into the designed not-found page, and a timeout routed through
 * that path would tell a visitor a vendor does not exist because the network
 * was slow — the wrong answer, cached and shared.
 */
export class ApiTimeoutError extends Error {
  readonly path: string;
  readonly timeoutMs: number;

  constructor(path: string, timeoutMs: number) {
    super(`API request for ${path} timed out after ${timeoutMs}ms`);
    this.name = 'ApiTimeoutError';
    this.path = path;
    this.timeoutMs = timeoutMs;
  }
}

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

  /*
    **The deadline is server-side only, and that is the whole point of it.**

    What #390 fixed is a *render* that never finishes: a Server Component
    awaiting a wedged upstream holds the response open and flushes nothing, so
    the visitor watches a blank tab until the platform's gateway ends it. A
    request from the browser is not rendering anything — the page is already on
    screen — so abandoning it buys no one anything, and for a write it is
    actively harmful.

    Concretely: `useApi` routes every client POST through here, and none of
    them carries an idempotency key. A message sent over a slow radio link
    reaches the API and inserts its row; an 8s deadline aborts the browser's
    half; `messages-screen` shows "That message did not send" and preserves the
    draft, exactly as designed; the customer sends again and the thread has the
    message twice. The same shape reaches the review form and the Stripe
    connect call, whose banner promises "Nothing has changed" — a promise an
    aborted request cannot keep.

    Keeping it off the browser also keeps this path on the baseline the app
    supports. `AbortSignal.any` is Safari 17.4+ and Chrome 116+, past Next 15's
    documented floor of Safari 16.4 / Chrome 111; on the server it runs on
    Node 24, where both have been available for years.
  */
  const deadline =
    typeof window === 'undefined' ? AbortSignal.timeout(API_REQUEST_TIMEOUT_MS) : null;

  /**
   * Runs one awaited step of the exchange under the deadline.
   *
   * Both steps, not just the first. Headers can arrive promptly from an
   * upstream that then stalls mid-body, and a deadline that covers only
   * `fetch` leaves that case hanging exactly as before — the abort does reach
   * the body stream, but the rejection surfaces from `response.text()`, past
   * any guard wrapped around the call above.
   *
   * The check reads the deadline's own state rather than the thrown error's
   * name. When both signals fire, which `reason` surfaces is a race, and
   * undici wraps an abort in its own `TypeError` on some paths —
   * `deadline.aborted` is the one fact that is true whatever shape the
   * rejection arrived in. A caller abort takes precedence — `signal.aborted`
   * latches true and never clears — so `search-shell` still sees the
   * `AbortError` it expects when it cancels a search.
   */
  const underDeadline = async <R>(step: () => Promise<R>): Promise<R> => {
    try {
      return await step();
    } catch (error) {
      if ((deadline?.aborted ?? false) && !(signal?.aborted ?? false)) {
        throw new ApiTimeoutError(path, API_REQUEST_TIMEOUT_MS);
      }

      throw error;
    }
  };

  /*
    The caller's own signal and the deadline, composed rather than chosen
    between. `search-shell` aborts its in-flight search when the query changes
    and must keep doing so, but a server-side request nobody cancelled still
    needs an end.
  */
  const requestSignal =
    deadline && signal ? AbortSignal.any([signal, deadline]) : (deadline ?? signal);

  const response = await underDeadline(() =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(requestSignal ? { signal: requestSignal } : {}),
      // `cache` and `next.revalidate` are mutually exclusive — sending both makes
      // Next ignore the revalidate and store nothing.
      ...(revalidate === undefined ? { cache: 'no-store' as const } : { next: { revalidate } }),
    }),
  );

  if (!response.ok) {
    /*
      The status is already known here, so a deadline that fires while the
      *error body* is being read must not discard it. Relabelling a 401 as a
      timeout would skip `rethrowUnlessSessionFailure`, and an expired session
      would render the error boundary instead of redirecting to sign-in.
    */
    try {
      throw await toClientError(response);
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      throw new ApiClientError(
        response.status,
        ERROR_CODES.INTERNAL_ERROR,
        `Request failed with status ${response.status}`,
      );
    }
  }

  const parsed = schema.safeParse(await underDeadline(() => readJsonBody(response, path)));
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
