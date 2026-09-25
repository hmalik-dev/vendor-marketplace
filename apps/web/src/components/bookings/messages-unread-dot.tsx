'use client';

import { useUnreadMessages } from '@/lib/unread-messages-store';

/**
 * The frame's 7px clay dot on the sidebar's `Messages` row, right-aligned.
 *
 * Named in the accessible name rather than drawn alone: a colour-only signal is
 * the `04-laws.md` case the six laws exist for, and a screen reader reaching the
 * row would otherwise hear the same thing whether or not anything was waiting.
 */
export function MessagesUnreadDot(): React.ReactElement | null {
  if (!useUnreadMessages()) {
    return null;
  }

  return (
    <>
      <span
        aria-hidden="true"
        data-testid="sidebar-unread-dot"
        className="ml-auto size-1.75 shrink-0 rounded-full bg-clay-400"
      />
      <span className="sr-only">unread</span>
    </>
  );
}
