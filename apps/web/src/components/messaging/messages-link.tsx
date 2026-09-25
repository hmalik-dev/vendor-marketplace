'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MARKETING_LINK_CLASS } from '@/components/marketing-link';
import { reportSwallowedError } from '@/lib/report-error';
import { isHeaderReadSuppressed, isTermsRequired } from '@/lib/terms-gate-paths';
import { setUnreadMessages } from '@/lib/unread-messages-store';
import { useApi } from '@/lib/use-api';
import { wireConversationPageSchema } from '@/lib/wire-schemas';

/**
 * Dispatched on `window` when the reader's unread state may have changed: the
 * bell's stream saw a message arrive or reconnected, or the messages screen
 * marked a thread read (which the stream does not announce).
 *
 * The link listens instead of opening a stream of its own — the API allows a
 * user five, and the bell and the messages screen already hold two.
 */
export const CONVERSATIONS_CHANGED_EVENT = 'conversations-changed';

export interface MessagesLinkProps {
  /** Whether this session cannot clear the Terms gate, read on the server. */
  gated?: boolean;
}

/**
 * The header's `Messages` link and the source of the unread cue: it publishes
 * what it reads to `unread-messages-store`, which the customer sidebar's dot
 * draws from (VEN-745), so the sidebar fetches and streams nothing.
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

/**
 * The unread source with no link: a customer's header draws `My bookings`
 * instead of `Messages` (VEN-760), but the sidebar's dot still needs someone
 * to publish the state, and the bell's stream still announces changes here.
 */
export function UnreadMessagesSource({
  gated = false,
}: MessagesLinkProps): React.ReactElement | null {
  const pathname = usePathname();

  return isHeaderReadSuppressed(pathname, gated) ? null : <UnreadMessagesReader />;
}

function UnreadMessagesReader(): null {
  useUnreadMessages();

  return null;
}

function UnreadMessagesLink(): React.ReactElement {
  return <MessagesAnchor unread={useUnreadMessages()} />;
}

function useUnreadMessages(): boolean {
  const call = useApi();
  const pathname = usePathname();
  const [unread, setUnread] = useState(false);

  // Only the newest read may set the dot: two in flight can resolve out of order.
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latest.current;

    try {
      const page = await call('/conversations', { schema: wireConversationPageSchema });

      if (request === latest.current) {
        setUnread(page.hasUnread);
        setUnreadMessages(page.hasUnread);
      }
    } catch (error: unknown) {
      /*
       * The Terms gate is an answer, not a failure: `useApi` has already sent the
       * reader to accept them (or the page is one the gate exempts), so there is
       * nothing to report. Logging it printed a console error on `/suspended` and
       * `/account/closed`, the two screens a session with no account row reaches
       * (`e2e/route-landing.spec.ts`). The bell, which asks the same gate, stays silent too.
       */
      if (isTermsRequired(error)) {
        return;
      }

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
    window.addEventListener(CONVERSATIONS_CHANGED_EVENT, refresh);

    return () => window.removeEventListener(CONVERSATIONS_CHANGED_EVENT, refresh);
  }, [refresh]);

  return unread;
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
