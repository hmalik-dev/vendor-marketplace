import { clearSessionToken, SESSION_TOKEN_PATH } from './client';

/**
 * "The session ended here" for the browser (VEN-699): one helper every path
 * that learns of it goes through — the sign-out button, another tab's
 * broadcast, the focus probe, a 401 on any API call and the live stream — and
 * the channel that carries a sign-out to the other tabs of the same browser.
 *
 * `BroadcastChannel`, not a cookie or `localStorage`: the product writes no
 * cookie of its own, and the channel needs no storage at all. A tab that never
 * hears it (throttled, offline, another device's sign-out) is caught by the
 * probe and by the 401 reaction instead.
 */

const SESSION_CHANNEL_NAME = 'vendor-marketplace:session';
const SESSION_ENDED_MESSAGE = 'session-ended';

let channel: BroadcastChannel | null | undefined;
let lastNavigationAt: number | null = null;

/** Calls this close together are one burst of failures, and navigate once. */
export const NAVIGATION_BURST_MS = 2_000;

/**
 * One channel object for posting and listening alike. A message is never
 * delivered to the object that posted it, so the tab that signed out does not
 * hear itself and cannot navigate over its own destination.
 */
function sessionChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    try {
      channel =
        typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(SESSION_CHANNEL_NAME);
    } catch {
      // A sandboxed frame can refuse the constructor; the probe covers the missed signal.
      channel = null;
    }
  }

  return channel;
}

/** Tells the browser's other tabs the session ended. Call only after the sign-out succeeded. */
export function announceSessionEnded(): void {
  sessionChannel()?.postMessage(SESSION_ENDED_MESSAGE);
}

/** Runs `onEnded` for every sign-out another tab announces; returns the unsubscribe. */
export function subscribeSessionEnded(onEnded: () => void): () => void {
  const listener = (event: MessageEvent<unknown>): void => {
    if (event.data === SESSION_ENDED_MESSAGE) {
      onEnded();
    }
  };
  const source = sessionChannel();
  source?.addEventListener('message', listener);

  return () => source?.removeEventListener('message', listener);
}

/**
 * Drops the cached token, then leaves the page — once, however many callers
 * learn of it together (a burst, not a latch: a `beforeunload` prompt the
 * reader declines cancels the navigation, and the next call must still leave).
 * A full navigation, as `SignOutButton` explains, so
 * nothing signed-in stays cached. With no `destination` it reloads the current
 * page: a public page comes back signed out and a gated one is redirected to
 * sign-in carrying its own path by the server, which is the one authority on
 * which pages are gated. The fragment is dropped, because navigating to the
 * same URL with one is not a navigation.
 */
export function endSession(destination?: string): void {
  clearSessionToken();

  const now = Date.now();
  if (lastNavigationAt !== null && now - lastNavigationAt < NAVIGATION_BURST_MS) {
    return;
  }

  lastNavigationAt = now;
  window.location.assign(destination ?? `${window.location.pathname}${window.location.search}`);
}

/**
 * Whether the server says this browser has no session. A fresh read of the
 * token route, which bypasses `getSessionToken`'s cache — the stale thing the
 * probe exists to see past. Only a refusal (401) counts: a network failure or
 * a 5xx says nothing about the session, so the tab stays as it is.
 */
export async function sessionIsGone(): Promise<boolean> {
  try {
    const response = await fetch(SESSION_TOKEN_PATH, {
      cache: 'no-store',
      credentials: 'same-origin',
    });

    return response.status === 401;
  } catch {
    return false;
  }
}

/** Resets module state between tests; exported for them and for nothing else. */
export function resetSessionEndedForTests(): void {
  channel?.close();
  channel = undefined;
  lastNavigationAt = null;
}
