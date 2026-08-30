'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import { ApiClientError, apiRequest } from '@/lib/api-client';
import { wireStreamTicketSchema } from '@/lib/wire-schemas';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Trades the session for one stream ticket.
 *
 * Goes through `apiRequest` like every other call. The effect this runs in
 * cannot depend on `useApi` — a hook identity that changes each render would
 * tear the socket down and rebuild it — but `apiRequest` is a plain function
 * taking the token, so there is nothing to avoid. Using it is what makes the
 * failure legible: an `ApiClientError` carries the status, and the caller has
 * to know 401 from 503 to decide between stopping and backing off.
 */
export async function requestStreamTicket(token: string, signal?: AbortSignal): Promise<string> {
  const { ticket } = await apiRequest('/events/stream-ticket', {
    schema: wireStreamTicketSchema,
    method: 'POST',
    token,
    ...(signal ? { signal } : {}),
  });

  return ticket;
}

/**
 * Whether a failed exchange is worth retrying.
 *
 * A dropped connection is ordinary and self-resolving; a rejected session is
 * not. Retrying a 401 or a 403 spends a fresh ticket every thirty seconds for
 * the life of the tab and can never succeed — a suspended account did exactly
 * that, because the ban check runs after the ticket is consumed.
 */
function isRetryable(error: unknown): boolean {
  return (
    !(error instanceof ApiClientError) || (error.statusCode !== 401 && error.statusCode !== 403)
  );
}

/** The two things the stream carries. One connection serves both. */
export type StreamEvent =
  | { type: 'new_message'; conversationId: string; message: unknown }
  | { type: 'new_notification'; notification: unknown };

/** Backoff schedule, in ms. Capped so a long outage still retries. */
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;

/**
 * How many consecutive failures are attempted before the stream waits to be
 * woken rather than retrying again.
 *
 * One full pass of the ladder: roughly a minute of trying, ending at the 30s
 * ceiling. Long enough to ride out a redeploy or a tunnel, short enough that a
 * lane with no API behind it stops writing an identical console error every
 * half minute for the rest of the session.
 */
const MAX_CONSECUTIVE_ATTEMPTS = BACKOFF_MS.length;

export interface EventStream {
  /**
   * Whether the stream is currently connected.
   *
   * A dropped connection is the **normal** case on a phone — a screen lock, a
   * tunnel, a network switch — so this drives an informational banner rather
   * than an error one, and nothing about the page becomes unusable when false.
   */
  connected: boolean;
}

export interface UseEventStreamOptions {
  onEvent: (event: StreamEvent) => void;
  /**
   * Called after a reconnect, so the caller can refetch whatever happened
   * while the socket was down — the stream itself replays nothing.
   */
  onReconnect?: () => void;
}

/**
 * One `EventSource` for the whole app.
 *
 * `EventSource` cannot set request headers, so something has to travel in the
 * URL. It is a single-use stream ticket, exchanged for the session over a
 * normal authenticated request — never the session JWT, which used to go here
 * and ended up in the API's own logs (#215). A ticket found in a log, in
 * browser history or in a `Referer` has already been spent.
 *
 * The handler is held in a ref rather than being a dependency: it is a new
 * closure on every render, and depending on it would tear the socket down and
 * rebuild it several times a second.
 */
export function useEventStream({ onEvent, onReconnect }: UseEventStreamOptions): EventStream {
  const { getToken, isSignedIn } = useAuth();
  const [connected, setConnected] = useState(false);

  const handler = useRef(onEvent);
  const reconnected = useRef(onReconnect);
  handler.current = onEvent;
  reconnected.current = onReconnect;

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    /** Set once the bounded run is spent; cleared by `resume`. */
    let exhausted = false;
    let cancelled = false;
    let hasConnectedBefore = false;
    const aborter = new AbortController();

    async function connect(): Promise<void> {
      const token = await getToken();

      if (cancelled || !token) {
        return;
      }

      /*
       * A fresh ticket per connection, including every reconnect: they are
       * single use, so a retry cannot replay the last one.
       */
      let ticket: string;
      try {
        ticket = await requestStreamTicket(token, aborter.signal);
      } catch (error) {
        /*
         * A transient failure is indistinguishable from the stream itself
         * dropping and is handled the same way — back off rather than give up
         * on live updates for the rest of the session. A rejected session is
         * not transient: retrying it spends a ticket every thirty seconds and
         * can never succeed, so the stream stays down and says so.
         */
        if (!cancelled && isRetryable(error)) {
          scheduleRetry();
        }
        return;
      }

      if (cancelled) {
        return;
      }

      source = new EventSource(`${BASE_URL}/events/stream?ticket=${encodeURIComponent(ticket)}`);

      source.onopen = () => {
        setConnected(true);
        // A reconnect, not the first connect — only then is there a gap.
        if (hasConnectedBefore) {
          reconnected.current?.();
        }
        hasConnectedBefore = true;
        attempt = 0;
      };

      source.onmessage = (event) => {
        try {
          handler.current(JSON.parse(event.data) as StreamEvent);
        } catch {
          // A frame we cannot parse is one event lost, not a reason to drop
          // the connection carrying the rest.
        }
      };

      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;

        if (cancelled) {
          return;
        }

        /*
         * `EventSource` reconnects on its own, but with no backoff and no way
         * to obtain a fresh ticket — which is why it is closed and rebuilt
         * here instead. Its ticket is spent the moment it connects, so its own
         * retry would loop forever against a 401.
         */
        scheduleRetry();
      };
    }

    /*
     * Gives up after a bounded run of failures, and waits to be woken.
     *
     * Retrying for ever at the 30s ceiling is not a tight loop, but it is
     * still noise nobody reads: a lane whose API is down produces an identical
     * console error every half minute, and `browser-verifier` reads the
     * console at every checkpoint, so a real error has to be found among them.
     *
     * Simply stopping would be worse than the noise, though. A dropped
     * connection is the **normal** case on a phone — a screen lock, a tunnel, a
     * network switch — and a stream that gave up permanently would leave a
     * device silently stale for the rest of the session. So the attempts are
     * bounded and the browser's own signals restart them: coming back online,
     * or the tab being looked at again. Both are exactly the moments a
     * reconnect is likely to succeed.
     */
    function scheduleRetry(): void {
      if (attempt >= MAX_CONSECUTIVE_ATTEMPTS) {
        exhausted = true;
        return;
      }

      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 30_000;
      attempt += 1;
      retry = setTimeout(() => void connect(), delay);
    }

    function resume(): void {
      if (cancelled || !exhausted) {
        return;
      }
      if (document.visibilityState === 'hidden') {
        return;
      }

      exhausted = false;
      attempt = 0;
      void connect();
    }

    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);

    void connect();

    return () => {
      cancelled = true;
      // An exchange in flight outlives the effect otherwise, and lands a
      // ticket nothing will ever spend.
      aborter.abort();
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
      if (retry) {
        clearTimeout(retry);
      }
      source?.close();
      setConnected(false);
    };
  }, [getToken, isSignedIn]);

  return { connected };
}
