/**
 * Where a booking request's draft lives in `localStorage`, and how sign-out
 * forgets it (VEN-617).
 *
 * A draft holds someone's event — its date, guest count and notes — and a
 * shared computer hands the browser to the next person. So the key names the
 * signed-in person as well as the vendor, and signing out removes every draft
 * this browser holds.
 */

/** Namespaced so a draft cannot collide with anything else in storage. */
const DRAFT_KEY_PREFIX = 'orla:booking-request:';

/** One person's draft to one vendor. */
export function bookingRequestDraftKey(userId: string, vendorId: string): string {
  return `${DRAFT_KEY_PREFIX}${userId}:${vendorId}`;
}

/**
 * Drops the draft stored under the pre-VEN-617 key, by vendor alone. It names
 * no one, so it cannot be handed to the right person; it is unsent, so nothing
 * of value goes with it.
 */
export function forgetLegacyBookingRequestDraft(vendorId: string): void {
  try {
    window.localStorage.removeItem(`${DRAFT_KEY_PREFIX}${vendorId}`);
  } catch {
    // Unavailable or blocked: nothing was saved there to leak.
  }
}

/**
 * Removes every booking-request draft in this browser and leaves every other
 * key. Never throws: storage that cannot be reached holds nothing to remove,
 * and a sign-out must not fail over a draft.
 */
export function forgetBookingRequestDrafts(): void {
  try {
    const storage = window.localStorage;
    const drafts: string[] = [];

    // Collected first: removing while indexing shifts every later key down one.
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key?.startsWith(DRAFT_KEY_PREFIX)) {
        drafts.push(key);
      }
    }

    for (const key of drafts) {
      storage.removeItem(key);
    }
  } catch {
    // Unavailable or blocked: nothing was saved there to leak.
  }
}
