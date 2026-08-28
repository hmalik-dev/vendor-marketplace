'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps a form's draft across reloads, back-navigations and expired sessions.
 *
 * The booking request is long — occasion, date, time, guest count, venue,
 * notes — and until now it lived in component state alone, so every one of
 * those lost the lot. It is also what frame `26`'s session-expired dialog
 * promises is safe, and that sentence cannot ship until it is true.
 *
 * **Per key, so two drafts never collide.** A customer comparing two vendors
 * has a half-written request to each, and one overwriting the other would be
 * worse than not saving at all.
 *
 * **Never throws.** Storage is unavailable in a private window, when site data
 * is blocked, and when the quota is full. A form that breaks because it could
 * not save a draft has traded a small loss for a total one, so every access is
 * guarded and failure degrades to exactly the old behaviour.
 */

/** Bumped when the stored shape changes, so an old draft is ignored, not crashed on. */
const DRAFT_VERSION = 1;

interface StoredDraft<T> {
  version: number;
  savedAt: number;
  value: T;
}

/** Drafts older than this are dropped: an event is a date, and dates go stale. */
const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);

    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredDraft<T>;

    if (parsed.version !== DRAFT_VERSION || typeof parsed.savedAt !== 'number') {
      return null;
    }

    if (Date.now() - parsed.savedAt > MAX_DRAFT_AGE_MS) {
      return null;
    }

    return parsed.value;
  } catch {
    // Unavailable, unreadable, or written by an older version of this code.
    return null;
  }
}

function write<T>(key: string, value: T): void {
  try {
    const payload: StoredDraft<T> = { version: DRAFT_VERSION, savedAt: Date.now(), value };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Full, blocked, or absent. The form keeps working without a draft.
  }
}

function forget(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do: it was never saved, or cannot be reached to be removed.
  }
}

export interface SavedDraft<T> {
  /** The restored draft, or `null`. Always `null` on the server and first paint. */
  restored: T | null;
  /** True once, when a draft was found — for telling the customer why the form is filled. */
  wasRestored: boolean;
  save: (value: T) => void;
  /** Called on a successful send, so the next request starts empty. */
  clear: () => void;
}

export function useSavedDraft<T>(key: string, isEmpty: (value: T) => boolean): SavedDraft<T> {
  const [restored, setRestored] = useState<T | null>(null);
  const [wasRestored, setWasRestored] = useState(false);

  /*
   * Read after mount, never during render. `localStorage` does not exist on
   * the server, and a value read during render would differ between the
   * server's HTML and the client's, which React reports as a hydration
   * mismatch and then discards.
   */
  useEffect(() => {
    const found = read<T>(key);

    if (found !== null) {
      setRestored(found);
      setWasRestored(true);
    }
  }, [key]);

  // Held in a ref so `save` keeps a stable identity and callers can put it in
  // an effect's dependencies without it firing on every render.
  const keyRef = useRef(key);
  keyRef.current = key;

  const save = useCallback(
    (value: T) => {
      /*
       * An empty form is not a draft. Saving it would mean a customer who
       * opened a request, typed nothing and left still gets told their draft
       * was restored the next time — which is both untrue and unsettling.
       */
      if (isEmpty(value)) {
        forget(keyRef.current);
        return;
      }

      write(keyRef.current, value);
    },
    [isEmpty],
  );

  const clear = useCallback(() => {
    forget(keyRef.current);
    setWasRestored(false);
  }, []);

  return { restored, wasRestored, save, clear };
}
