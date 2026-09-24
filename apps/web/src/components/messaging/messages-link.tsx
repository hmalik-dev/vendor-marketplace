'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { MARKETING_LINK_CLASS } from '@/components/marketing-link';
import { reportSwallowedError } from '@/lib/report-error';
import { isHeaderReadSuppressed } from '@/lib/terms-gate-paths';
import { useApi } from '@/lib/use-api';
import { useEventStream } from '@/lib/use-event-stream';
import { wireConversationPageSchema } from '@/lib/wire-schemas';

/**
 * Dispatched on `window` once a thread is marked read, so the header's dot
 * clears without a reload. The header and the messages screen share no state,
 * and a read receipt is the one change the stream does not announce.
 */
export const CONVERSATION_READ_EVENT = 'conversation-read';

export interface MessagesLinkProps {
  /** Whether this session cannot clear the Terms gate, read on the server. */
  gated?: boolean;
}

/**
 * The header's `Messages` link, carrying the only unread cue a customer or
 * vendor has now that the bookings sidebar is gone (VEN-706).
 *
 * Fetched here rather than server-rendered for the bell's reason: the header is
 * on every page, and a user-scoped read in it would add a round trip to each.
 * It never mounts for a signed-out visitor, so they issue no request.
 */
export function MessagesLink({ gated = false }: MessagesLinkProps): React.ReactElement {
  const pathname = usePathname();

  if (isHeaderReadSuppressed(pathname, gated)) {
    return <MessagesAnchor unread={false} />;
  }

  return <UnreadMessagesLink />;
}

function UnreadMessagesLink(): React.ReactElement {
  const call = useApi();
  const pathname = usePathname();
  const [unread, setUnread] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const page = await call('/conversations', { schema: wireConversationPageSchema });
      setUnread(page.hasUnread);
    } catch (error: unknown) {
      // The dot keeps its last known value: dropping it would read as "all read"
      // when it means "could not ask".
      reportSwallowedError('header: reading the unread state failed', error);
    }
  }, [call]);

  // A new page is the moment a thread was most likely opened or left.
  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    window.addEventListener(CONVERSATION_READ_EVENT, refresh);

    return () => window.removeEventListener(CONVERSATION_READ_EVENT, refresh);
  }, [refresh]);

  useEventStream({
    onEvent: (event) => {
      if (event.type === 'new_message') {
        void refresh();
      }
    },
    onReconnect: () => void refresh(),
  });

  return <MessagesAnchor unread={unread} />;
}

function MessagesAnchor({ unread }: { unread: boolean }): React.ReactElement {
  return (
    <Link
      href="/messages"
      aria-label={unread ? 'Messages, unread' : undefined}
      className={MARKETING_LINK_CLASS}
    >
      Messages
      {unread ? (
        <span
          aria-hidden="true"
          data-testid="messages-unread-dot"
          className="ml-1.5 size-2 rounded-full bg-clay-400"
        />
      ) : null}
    </Link>
  );
}
