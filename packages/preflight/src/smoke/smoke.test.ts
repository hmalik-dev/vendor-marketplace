import { describe, expect, it, vi } from 'vitest';
import { runSmokeCheck } from './smoke.js';

const API = 'https://api.test';
const WEB = 'https://web.test';

function response(body: string, status = 200): Response {
  return new Response(body, { status });
}

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const READY = `{"status":"ready","database":"up","storage":"up","commit":"${SHA}"}`;
const VENDORS = '{"items":[{"businessName":"Sunlit Studio","slug":"sunlit-studio"}]}';
const LANDING = '<html><body><h2>Sunlit Studio</h2></body></html>';

/** A healthy deployment: every route answers with what it should. */
function healthy(): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);

    if (url.endsWith('/ready')) return response(READY);
    if (url.startsWith(`${API}/vendors`)) return response(VENDORS);

    return response(LANDING);
  }) as unknown as typeof fetch;
}

/** No sleeping in the suite; the retry budget is exercised by the clock. */
function controls(): { sleepImpl: (ms: number) => Promise<void>; now: () => number } {
  let clock = 0;

  return {
    sleepImpl: async (ms) => {
      clock += ms;
    },
    now: () => clock,
  };
}

describe('runSmokeCheck', () => {
  it('passes when the API is ready and the front door renders its data', async () => {
    const result = await runSmokeCheck({ apiUrl: API, webUrl: WEB, fetchImpl: healthy() });

    expect(result.ok).toBe(true);
    expect(result.checks.map((check) => check.name)).toEqual([
      'API /ready',
      'API has real data',
      'Web renders real data',
    ]);
  });

  /* Liveness can answer while the database is unreachable; readiness cannot. */
  it('polls /ready, not /health', async () => {
    const fetchImpl = healthy();
    await runSmokeCheck({ apiUrl: API, webUrl: WEB, fetchImpl });

    const urls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) =>
      String(call[0]),
    );

    expect(urls).toContain(`${API}/ready`);
    expect(urls.some((url) => url.includes('/health'))).toBe(false);
  });

  it('fails when readiness reports a dependency down', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/ready')
        ? response('{"status":"degraded","database":"down"}', 503)
        : response(LANDING),
    ) as unknown as typeof fetch;

    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      fetchImpl,
      ...controls(),
      deadlineMs: 20,
      retryDelayMs: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: 'API /ready', ok: false });
    expect(result.checks[0]?.detail).toContain('503');
  });

  /*
   * The outage that motivated this ticket presented as a hang, not an error.
   * A check without a per-request ceiling would have waited alongside it.
   */
  it('fails on a hanging endpoint instead of waiting for it', async () => {
    const hang = vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    ) as unknown as typeof fetch;

    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      fetchImpl: hang,
      sleepImpl: async () => {},
      deadlineMs: 60,
      retryDelayMs: 20,
      requestTimeoutMs: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0]?.detail).toContain('timed out');
  });

  it('retries while a deploy is still building, then passes', async () => {
    let attempts = 0;
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/ready')) {
        attempts += 1;

        return attempts < 3 ? response('no such service', 502) : response(READY);
      }
      if (url.startsWith(`${API}/vendors`)) return response(VENDORS);

      return response(LANDING);
    }) as unknown as typeof fetch;

    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      fetchImpl,
      ...controls(),
      deadlineMs: 10_000,
      retryDelayMs: 100,
    });

    expect(attempts).toBe(3);
    expect(result.ok).toBe(true);
  });

  it('gives up at the deadline rather than retrying forever', async () => {
    const fetchImpl = vi.fn(async () => response('bad gateway', 502)) as unknown as typeof fetch;
    const { sleepImpl, now } = controls();

    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      fetchImpl,
      sleepImpl,
      now,
      deadlineMs: 100,
      retryDelayMs: 25,
    });

    expect(result.ok).toBe(false);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(4);
  });

  /*
   * The heart of the ticket. Since #33 a public page renders 200 during an API
   * outage, so a status-only check would call this deployment healthy.
   */
  it('fails when the page returns 200 without its data', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/ready')) return response(READY);
      if (url.startsWith(`${API}/vendors`)) return response(VENDORS);

      return response('<html><body><p>No vendors just yet.</p></body></html>');
    }) as unknown as typeof fetch;

    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      fetchImpl,
      ...controls(),
      deadlineMs: 20,
      retryDelayMs: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.checks[2]).toMatchObject({ name: 'Web renders real data', ok: false });
    expect(result.checks[2]?.detail).toContain('Sunlit Studio');
  });

  /* Asserting on a name read live from the API keeps the check from going stale. */
  it('asserts on a vendor name read from the API, not a hardcoded one', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/ready')) return response(READY);
      if (url.startsWith(`${API}/vendors`)) {
        return response('{"items":[{"businessName":"Renamed Co","slug":"renamed-co"}]}');
      }

      return response('<html><body><h2>Renamed Co</h2></body></html>');
    }) as unknown as typeof fetch;

    const result = await runSmokeCheck({ apiUrl: API, webUrl: WEB, fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.checks[1]?.detail).toContain('Renamed Co');
  });

  it('fails when the API is ready but serves no vendors at all', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/ready') ? response(READY) : response('{"items":[]}'),
    ) as unknown as typeof fetch;

    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      fetchImpl,
      ...controls(),
      deadlineMs: 20,
      retryDelayMs: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.checks[1]?.detail).toContain('no published vendor');
  });

  it('does not check the web front door once the API has already failed', async () => {
    const fetchImpl = vi.fn(async () => response('down', 500)) as unknown as typeof fetch;

    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      fetchImpl,
      ...controls(),
      deadlineMs: 10,
      retryDelayMs: 5,
    });

    expect(result.checks).toHaveLength(1);
    expect(result.ok).toBe(false);
  });

  /*
   * The false pass this check would otherwise give: seconds after a push, the
   * previous release is still up and still ready, and answers for the new one.
   */
  it('waits for the commit it was triggered for, rather than the one still serving', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/ready')
        ? response('{"status":"ready","database":"up","storage":"up","commit":"0000000deadbeef"}')
        : response(LANDING),
    ) as unknown as typeof fetch;

    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      expectCommit: SHA,
      fetchImpl,
      ...controls(),
      deadlineMs: 20,
      retryDelayMs: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0]?.detail).toContain('rather than a1b2c3d');
  });

  it('passes once the expected commit is the one answering', async () => {
    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      expectCommit: SHA,
      fetchImpl: healthy(),
    });

    expect(result.ok).toBe(true);
    expect(result.checks[0]?.detail).toContain('serving a1b2c3d');
  });

  /* A build off a platform has no SHA to report, and must not silently pass. */
  it('fails when readiness names no commit but one was expected', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith('/ready')
        ? response('{"status":"ready","database":"up","storage":"up","commit":null}')
        : response(LANDING),
    ) as unknown as typeof fetch;

    const result = await runSmokeCheck({
      apiUrl: API,
      webUrl: WEB,
      expectCommit: SHA,
      fetchImpl,
      ...controls(),
      deadlineMs: 20,
      retryDelayMs: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0]?.detail).toContain('unknown commit');
  });

  it('tolerates a trailing slash on either URL', async () => {
    const fetchImpl = healthy();
    await runSmokeCheck({ apiUrl: `${API}/`, webUrl: `${WEB}/`, fetchImpl });

    const urls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) =>
      String(call[0]),
    );

    expect(urls[0]).toBe(`${API}/ready`);
    expect(urls).toContain(`${WEB}/vendors/sunlit-studio`);
  });
});
