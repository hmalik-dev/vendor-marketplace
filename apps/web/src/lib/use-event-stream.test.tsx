import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getTokenMock = vi.fn();
let signedIn = true;

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: getTokenMock, isSignedIn: signedIn }),
}));

const { requestStreamTicket, useEventStream } = await import('./use-event-stream');

/** A Clerk session token, in the shape anything reading a URL would see. */
const SESSION_JWT = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEifQ.signature-part';
const JWT_SHAPED = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;

/** Every `EventSource` the component under test opened, in order. */
const opened: string[] = [];
const sources: FakeEventSource[] = [];

/** The most recently opened fake, for tests that drive open/error by hand. */
function latestSource(): FakeEventSource {
  const source = sources.at(-1);
  if (!source) {
    throw new Error('No EventSource has been opened yet');
  }
  return source;
}

class FakeEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    opened.push(url);
    sources.push(this);
  }

  close(): void {
    this.closed = true;
  }
}

beforeEach(() => {
  opened.length = 0;
  sources.length = 0;
  signedIn = true;
  getTokenMock.mockReset().mockResolvedValue(SESSION_JWT);
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ ticket: 'ticket-abc123' })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('requestStreamTicket', () => {
  it('exchanges the session for a ticket over an authenticated POST', async () => {
    const ticket = await requestStreamTicket(SESSION_JWT);

    expect(ticket).toBe('ticket-abc123');

    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain('/events/stream-ticket');
    expect(init?.method).toBe('POST');
  });

  /*
   * #215: the session must travel in a header. The exchange request is the one
   * place the JWT is still handled, and it must not be in the URL either.
   */
  it('sends the session in a header, never in the URL', async () => {
    await requestStreamTicket(SESSION_JWT);

    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).not.toMatch(JWT_SHAPED);
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${SESSION_JWT}`);
  });

  it('refuses a response the API rejected', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('nope', { status: 401 }));

    await expect(requestStreamTicket(SESSION_JWT)).rejects.toThrow(/401/);
  });

  it('refuses a response that does not match its schema', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ nothing: 'useful' }));

    await expect(requestStreamTicket(SESSION_JWT)).rejects.toThrow(/schema/i);
  });
});

function Subscriber(): null {
  useEventStream({ onEvent: () => {} });
  return null;
}

describe('useEventStream', () => {
  /*
   * The defect itself: every authenticated page load opened
   * `/events/stream?token=<824-char JWT>`, and the API's request logger wrote
   * it out. The URL still carries a credential — it just is not the session,
   * and it is spent on arrival.
   */
  it('opens the stream with a ticket and no session token', async () => {
    render(<Subscriber />);

    await waitFor(() => expect(opened).toHaveLength(1));

    const url = opened[0] ?? '';
    expect(url).toContain('ticket=ticket-abc123');
    expect(url).not.toMatch(JWT_SHAPED);
    expect(url).not.toContain('token=');
  });

  it('does not open a stream at all when signed out', async () => {
    signedIn = false;

    render(<Subscriber />);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(opened).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  /*
   * The property the whole scheme rests on, and the one the previous version of
   * this test only claimed. A ticket is single-use, so a reconnect that reuses
   * the last one 401s forever: notifications stop and nothing on screen says so.
   *
   * Caching the ticket in the effect closure left the old assertion green,
   * which is why this one fires `onerror` and reads the SECOND url.
   */
  it('exchanges a fresh ticket on every reconnect, never replaying the last', async () => {
    vi.useFakeTimers();
    let issued = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      issued += 1;
      return Response.json({ ticket: `ticket-${issued}` });
    });

    render(<Subscriber />);
    await vi.waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0]).toContain('ticket=ticket-1');

    const first = latestSource();
    first.onopen?.();
    first.onerror?.();

    // The browser's own retry is suppressed by closing the source.
    expect(first.closed).toBe(true);

    await vi.advanceTimersByTimeAsync(1_500);
    await vi.waitFor(() => expect(opened).toHaveLength(2));
    expect(opened[1]).toContain('ticket=ticket-2');

    vi.useRealTimers();
  });

  /*
   * A transient failure of the exchange itself — an API restart, a 429 — must
   * back off rather than end live updates for the life of the tab. Deleting the
   * retry from the catch left every other test in this file green.
   */
  it('retries after the exchange itself fails', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('nope', { status: 503 }))
      .mockResolvedValue(Response.json({ ticket: 'ticket-after-retry' }));

    render(<Subscriber />);

    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    expect(opened).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1_500);
    await vi.waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0]).toContain('ticket=ticket-after-retry');

    vi.useRealTimers();
  });

  /*
   * A rejected session is not transient. Retrying it spends a ticket every
   * thirty seconds and can never succeed — which is what a suspended account
   * did, because the ban check runs after the ticket is consumed.
   */
  it.each([401, 403])(
    'stops rather than looping when the session is rejected (%s)',
    async (status) => {
      vi.useFakeTimers();
      vi.mocked(fetch).mockResolvedValue(new Response('no', { status }));

      render(<Subscriber />);
      await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));

      await vi.advanceTimersByTimeAsync(60_000);

      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
      expect(opened).toHaveLength(0);

      vi.useRealTimers();
    },
  );

  /*
   * #318. The stream connected to a literal `http://localhost:4028` while the
   * lane's API was on 4020, so it retried a refused connection for ever. On a
   * machine running two lanes the same bug is worse than a refusal: the port
   * belongs to the *other* lane, so it connects, and one lane's notifications
   * arrive in the other's tab.
   */
  it('builds the stream URL from the configured API origin, not a literal', async () => {
    render(<Subscriber />);

    await vi.waitFor(() => expect(opened).toHaveLength(1));

    const origin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    expect(opened[0]?.startsWith(`${origin}/events/stream`)).toBe(true);
  });

  /*
   * The delays themselves, not merely that a retry happened. Asserting "it
   * retried" passes just as well against the tight loop this ticket is about,
   * which is why the ticket asks for the specific values.
   */
  it('backs off on the ladder rather than retrying at a fixed interval', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 503 }));

    render(<Subscriber />);

    /*
     * `vi.waitFor` advances fake timers itself, so it cannot be used to reach a
     * known point on the clock — flushing microtasks with a zero advance is
     * what keeps the boundaries below meaningful.
     */
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    // Just short of each delay changes nothing; crossing it spends one attempt.
    for (const [index, delay] of [1_000, 2_000, 4_000, 8_000].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(index + 1);

      await vi.advanceTimersByTimeAsync(1);
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(index + 2);
    }

    vi.useRealTimers();
  });

  /*
   * Bounded, so a lane with no API behind it stops writing an identical console
   * error every thirty seconds for the rest of the session — `browser-verifier`
   * reads the console at every checkpoint, and a real error has to be findable
   * among them.
   */
  it('stops after a bounded run of failures instead of retrying for ever', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 503 }));

    render(<Subscriber />);
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));

    // The whole ladder, then well past the ceiling several times over.
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000 + 8_000 + 16_000 + 30_000);
    const spent = vi.mocked(fetch).mock.calls.length;

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(spent);

    vi.useRealTimers();
  });

  /*
   * Bounded is not the same as given up. A dropped connection is the normal
   * case on a phone, so the browser's own "you are back" signals restart the
   * run — otherwise a device that reconnects an hour later stays silently
   * stale for the rest of the session.
   */
  it('resumes when the browser comes back online', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 503 }));

    render(<Subscriber />);
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000 + 8_000 + 16_000 + 30_000);

    const spent = vi.mocked(fetch).mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(spent);

    vi.mocked(fetch).mockResolvedValue(Response.json({ ticket: 'ticket-after-online' }));
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0]).toContain('ticket=ticket-after-online');

    vi.useRealTimers();
  });

  it('opens nothing when unmounted while the exchange is in flight', async () => {
    let release: (value: Response) => void = () => {};
    vi.mocked(fetch).mockImplementation(
      async () => new Promise<Response>((resolve) => (release = resolve)),
    );

    const { unmount } = render(<Subscriber />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));

    unmount();
    release(Response.json({ ticket: 'ticket-too-late' }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(opened).toHaveLength(0);
  });

  it('closes the stream when the subscriber unmounts', async () => {
    const { unmount } = render(<Subscriber />);
    await waitFor(() => expect(opened).toHaveLength(1));

    const source = latestSource();
    unmount();

    expect(source.closed).toBe(true);
  });
});
