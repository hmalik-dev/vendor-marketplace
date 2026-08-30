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

class FakeEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    opened.push(url);
  }

  close(): void {
    this.closed = true;
  }
}

beforeEach(() => {
  opened.length = 0;
  signedIn = true;
  getTokenMock.mockReset().mockResolvedValue(SESSION_JWT);
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ ticket: 'ticket-abc123', expiresAt: new Date().toISOString() }),
    ),
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

  it('asks for a ticket before every connection, so none is replayed', async () => {
    render(<Subscriber />);

    await waitFor(() => expect(opened).toHaveLength(1));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
