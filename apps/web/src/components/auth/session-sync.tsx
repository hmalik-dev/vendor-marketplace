'use client';

import { useEffect } from 'react';
import { endSession, sessionIsGone, subscribeSessionEnded } from '@/lib/auth/session-ended';

/** The web tier's per-caller budget is shared, so a tab probes at most this often. */
export const SESSION_PROBE_INTERVAL_MS = 30_000;

/**
 * Keeps a signed-in tab honest about its session (VEN-699). Mounted only in
 * the signed-in chrome, so a signed-out visitor and the public pages gain
 * neither the listener nor the probe.
 *
 * A sign-out in another tab arrives on the channel and ends this one at once.
 * A tab that missed it — throttled in the background, or signed out from
 * another device — asks the server when it is next shown or focused.
 */
export function SessionSync(): null {
  useEffect(() => {
    let cancelled = false;
    let lastProbeAt: number | null = null;

    function probe(): void {
      if (document.visibilityState !== 'visible') {
        return;
      }

      const now = Date.now();
      if (lastProbeAt !== null && now - lastProbeAt < SESSION_PROBE_INTERVAL_MS) {
        return;
      }
      lastProbeAt = now;

      void sessionIsGone().then((gone) => {
        if (gone && !cancelled) {
          endSession();
        }
      });
    }

    const unsubscribe = subscribeSessionEnded(() => endSession());
    document.addEventListener('visibilitychange', probe);
    window.addEventListener('focus', probe);

    return () => {
      cancelled = true;
      unsubscribe();
      document.removeEventListener('visibilitychange', probe);
      window.removeEventListener('focus', probe);
    };
  }, []);

  return null;
}
