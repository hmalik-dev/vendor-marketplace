import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { MessagesScreen } from '@/components/messaging/messages-screen';
import { loadOwnConversations } from '@/lib/messaging-data';
import { requireCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Messages'),
  robots: { index: false, follow: false },
};

/** Never prerendered: the thread list is one signed-in customer's own. */
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ conversation?: string | string[] }>;
}

/**
 * Frame `10`. The negotiation, kept attached to the booking it is about.
 *
 * The thread id lives in `?conversation=` so a thread is linkable — every
 * notification about a message points straight at one.
 */
export default async function MessagesPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const query = await searchParams;

  /*
   * A notification links straight at one thread, so the thread has to survive
   * the sign-in round trip or the link only works for a session that is
   * already open. `signInPathReturningTo` re-validates what is built here.
   */
  // Next yields an array for `?conversation=a&conversation=b`; take the first.
  const raw = query.conversation;
  const conversation = Array.isArray(raw) ? raw[0] : raw;
  const user = await requireCurrentUser(
    conversation ? `/messages?${new URLSearchParams({ conversation }).toString()}` : '/messages',
  );
  const { conversations, failed } = await loadOwnConversations();

  return (
    <MessagesScreen
      initialConversations={conversations}
      viewerId={user.id}
      initialConversationId={conversation ?? null}
      listFailed={failed}
    />
  );
}
