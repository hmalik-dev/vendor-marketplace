'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import { wireStreamTicketSchema } from '@/lib/wire-schemas';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Trades the session for one stream ticket.
 *
 * Deliberately a plain `fetch` rather than `useApi`: this runs inside an
 * effect that already holds a token, and routing it through the hook would
 * make the effect depend on a value that changes identity on every render.
 */
export async function requestStreamTicket(token: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/events/stream-ticket`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Could not obtain a stream ticket (${response.status})`);
  }

  const parsed = wireStreamTicketSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error('Stream ticket response did not match its schema');
  }

  return parsed.data.ticket;
}

/** The two things the stream carries. One connection serves both. */
export type StreamEvent =
  | { type: 'new_message'; conversationId: string; message: unknown }
  | { type: 'new_notification'; notification: unknown };

/** Backoff schedule, in ms. Capped so a long outage still retries. */
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;

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
    let cancelled = false;
    let hasConnectedBefore = false;

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
        ticket = await requestStreamTicket(token);
      } catch {
        // Indistinguishable from the stream itself failing, and handled the
        // same way — back off and try again rather than give up on live
        // updates for the rest of the session.
        scheduleRetry();
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

    function scheduleRetry(): void {
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 30_000;
      attempt += 1;
      retry = setTimeout(() => void connect(), delay);
    }

    void connect();

    return () => {
      cancelled = true;
      if (retry) {
        clearTimeout(retry);
      }
      source?.close();
      setConnected(false);
    };
  }, [getToken, isSignedIn]);

  return { connected };
}
