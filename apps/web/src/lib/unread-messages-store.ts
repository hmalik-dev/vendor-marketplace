import { useSyncExternalStore } from 'react';

/**
 * Whether the signed-in reader has an unread message, as the header's
 * `Messages` link last read it.
 *
 * The link is the one place that asks (it listens for the bell's stream rather
 * than opening its own — the API allows a user five), so anything else that
 * draws the cue, like the customer sidebar's dot, reads it from here instead of
 * fetching the conversations again.
 */
let unread = false;
const listeners = new Set<() => void>();

export function setUnreadMessages(next: boolean): void {
  if (next === unread) {
    return;
  }
  unread = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** `false` on the server and until the header link has answered: no dot is the safe claim. */
export function useUnreadMessages(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => unread,
    () => false,
  );
}
