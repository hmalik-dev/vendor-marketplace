/**
 * @vitest-environment node
 *
 * The server-side deadline (#390).
 *
 * Its own file, on the **node** environment, because the behaviour under test
 * only exists on the server: `apiRequest` reads `typeof window` to decide
 * whether to arm a deadline at all, and the rest of the web suite runs on
 * jsdom, where `window` is defined and no deadline is armed. Asserting a
 * timeout from a jsdom test would be asserting the browser path, which is
 * deliberately unbounded — a green that proves the opposite of the claim.
 *
 * The defect this covers: a suspended API accepts the connection and never
 * answers, which is not a failure `fetch` reports — it is a wait. Measured
 * 2026-08-31, `/` and `/vendors/<slug>` each held the response open for 35s
 * and flushed **zero bytes**, so the visitor watched a blank tab until the
 * platform's gateway ended it.
 *
 * **The stall is modelled as a stall.** `stalledFetch` never resolves on its
 * own and rejects only when its signal aborts, with that signal's reason — so
 * a deadline that failed to fire would hang this test rather than pass it. A
 * mock that resolved by itself would encode the bug as correct behaviour and
 * report a confident green against the broken version.
 *
 * The clock is controlled by replacing `AbortSignal.timeout` rather than with
 * fake timers: it is implemented in Node's core and does not run on the global
 * `setTimeout` Vitest can fake, so faked timers never fire it. Replacing the
 * same call the production code makes is also what lets the duration it asked
 * for be asserted.
 */
import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_REQUEST_TIMEOUT_MS, ApiClientError, ApiTimeoutError, apiRequest } from './api-client';

const bodySchema = z.object({ id: z.string(), name: z.string() });

/** Never resolves; rejects the moment its signal aborts, with that reason. */
function stalledFetch(): typeof fetch {
  return vi.fn(
    (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error);
        });
      }),
  ) as unknown as typeof fetch;
}

const realTimeout = AbortSignal.timeout.bind(AbortSignal);
/** Every duration the code under test asked for, in order. */
let asked: number[] = [];

describe('the server-side deadline', () => {
  beforeEach(() => {
    asked = [];
    // Same semantics, 20ms instead of 8s, so the suite does not wait on it.
    AbortSignal.timeout = ((ms: number) => {
      asked.push(ms);
      return realTimeout(20);
    }) as typeof AbortSignal.timeout;
  });

  afterEach(() => {
    AbortSignal.timeout = realTimeout as typeof AbortSignal.timeout;
    vi.unstubAllGlobals();
  });

  it('abandons a stalled request as an ApiTimeoutError naming the path', async () => {
    vi.stubGlobal('fetch', stalledFetch());

    await expect(apiRequest('/vendors/june-harlow', { schema: bodySchema })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiTimeoutError &&
        error.path === '/vendors/june-harlow' &&
        error.timeoutMs === API_REQUEST_TIMEOUT_MS,
    );
  });

  it('is not an ApiClientError, so a timeout can never be read as a 404', async () => {
    vi.stubGlobal('fetch', stalledFetch());

    /*
     * The distinction `getPublicVendorProfile` turns on: it maps a 404 to the
     * designed not-found page, so a timeout arriving as an `ApiClientError`
     * would tell a visitor a vendor does not exist because the upstream was
     * slow — the wrong answer, and one a crawler would cache.
     */
    await expect(
      apiRequest('/vendors/june-harlow', { schema: bodySchema }),
    ).rejects.not.toBeInstanceOf(ApiClientError);
  });

  it('asks for the one declared deadline rather than a per-call-site value', async () => {
    vi.stubGlobal('fetch', stalledFetch());

    await expect(apiRequest('/categories', { schema: bodySchema })).rejects.toBeInstanceOf(
      ApiTimeoutError,
    );
    expect(asked).toEqual([API_REQUEST_TIMEOUT_MS]);
  });

  it('bounds a body that stalls after the headers arrive', async () => {
    /*
     * The half of the exchange a `fetch`-only guard misses. Headers can arrive
     * promptly from an upstream that then stops writing, and the abort then
     * surfaces from reading the body — past any guard wrapped around the call
     * that produced the response.
     */
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: unknown, init?: RequestInit) => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"id":"u1",'));
            init?.signal?.addEventListener('abort', () => {
              controller.error(init.signal?.reason);
            });
          },
        });

        return Promise.resolve(new Response(body, { status: 200 }));
      }) as unknown as typeof fetch,
    );

    await expect(apiRequest('/users/me', { schema: bodySchema })).rejects.toBeInstanceOf(
      ApiTimeoutError,
    );
  });

  it('keeps a known status when the deadline fires while reading an error body', async () => {
    /*
     * The status is already known once the headers land, so a deadline that
     * fires during the *error* body must not discard it. Relabelling a 401 as
     * a timeout skips `rethrowUnlessSessionFailure`, and an expired session
     * then renders the error boundary instead of redirecting to sign-in.
     */
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: unknown, init?: RequestInit) => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            init?.signal?.addEventListener('abort', () => {
              controller.error(init.signal?.reason);
            });
          },
        });

        return Promise.resolve(new Response(body, { status: 401 }));
      }) as unknown as typeof fetch,
    );

    await expect(apiRequest('/vendor/dashboard', { schema: bodySchema })).rejects.toSatisfy(
      (error: unknown) => error instanceof ApiClientError && error.statusCode === 401,
    );
  });
});

describe('a caller that cancels its own request', () => {
  beforeEach(() => {
    asked = [];
    AbortSignal.timeout = ((ms: number) => {
      asked.push(ms);
      return realTimeout(20);
    }) as typeof AbortSignal.timeout;
  });

  afterEach(() => {
    AbortSignal.timeout = realTimeout as typeof AbortSignal.timeout;
    vi.unstubAllGlobals();
  });

  it('gets its own error back, not a timeout', async () => {
    vi.stubGlobal('fetch', stalledFetch());
    const controller = new AbortController();
    const pending = apiRequest('/vendors?q=ph', {
      schema: bodySchema,
      signal: controller.signal,
    });

    /*
     * `search-shell` cancels the in-flight search on every keystroke and has to
     * keep seeing an `AbortError`. Folding that into `ApiTimeoutError` would
     * report a working search box as a failing upstream.
     */
    controller.abort();

    await expect(pending).rejects.toSatisfy(
      (error: unknown) => !(error instanceof ApiTimeoutError),
    );
  });

  it('wins even when the deadline aborted too', async () => {
    /*
     * The precedence clause, exercised where it can actually decide something.
     *
     * The test above aborts at t≈0, when `deadline.aborted` is still false — so
     * it passes whether or not the clause exists, and deleting the clause keeps
     * it green. Here **both** signals have fired before the request settles,
     * which is the real race: the deadline expires while the user is typing the
     * next keystroke. Only the order of the `&&` decides the answer, and it has
     * to come out as the caller's abort, because `search-shell` reports
     * anything else as a failed search.
     *
     * Both aborts are driven by hand rather than by a timer, so the ordering is
     * the test's rather than the scheduler's.
     */
    const deadlineController = new AbortController();
    AbortSignal.timeout = (() => deadlineController.signal) as typeof AbortSignal.timeout;

    let rejectFetch: (reason: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            rejectFetch = reject;
          }),
      ) as unknown as typeof fetch,
    );

    const caller = new AbortController();
    const pending = apiRequest('/vendors?q=ph', {
      schema: bodySchema,
      signal: caller.signal,
    });
    pending.catch(() => {});

    deadlineController.abort(new DOMException('The operation timed out.', 'TimeoutError'));
    caller.abort();
    expect(deadlineController.signal.aborted && caller.signal.aborted).toBe(true);
    rejectFetch(caller.signal.reason);

    await expect(pending).rejects.toSatisfy(
      (error: unknown) => !(error instanceof ApiTimeoutError),
    );
  });
});

describe('the browser path', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arms no deadline, so a client write is never abandoned mid-flight', async () => {
    /*
     * Deliberate, and the reason is data loss rather than politeness. Every
     * client write goes through here and none carries an idempotency key: a
     * message that reaches the API and is aborted browser-side is reported to
     * the customer as "did not send" with the draft preserved, and sending
     * again puts it in the thread twice.
     */
    const asked: number[] = [];
    const spy = ((ms: number) => {
      asked.push(ms);
      return realTimeout(20);
    }) as typeof AbortSignal.timeout;

    AbortSignal.timeout = spy;
    vi.stubGlobal('window', {});
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ id: 'u1', name: 'Ada' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ) as unknown as typeof fetch,
    );

    try {
      await expect(
        apiRequest('/conversations/c1/messages', {
          schema: bodySchema,
          method: 'POST',
          body: { text: 'hi' },
        }),
      ).resolves.toEqual({ id: 'u1', name: 'Ada' });

      expect(asked).toEqual([]);
    } finally {
      AbortSignal.timeout = realTimeout as typeof AbortSignal.timeout;
    }
  });
});
