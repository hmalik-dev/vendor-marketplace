'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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
 * `EventSource` cannot set request headers, so the Clerk token travels as a
 * query parameter — the API admits that on this route family alone, for
 * exactly this reason.
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

      source = new EventSource(`${BASE_URL}/events/stream?token=${encodeURIComponent(token)}`);

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
         * to refresh the token — which is why it is closed and rebuilt here
         * instead: a stream whose token expired would otherwise retry forever
         * against a 401.
         */
        const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 30_000;
        attempt += 1;
        retry = setTimeout(() => void connect(), delay);
      };
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
