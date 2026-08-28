import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { MessagesScreen } from '@/components/messaging/messages-screen';
import { getOwnConversations } from '@/lib/messaging-data';
import { requireCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Messages'),
  robots: { index: false, follow: false },
};

/** Never prerendered: the thread list is one signed-in customer's own. */
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ conversation?: string }>;
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
  const [user, query] = await Promise.all([requireCurrentUser(), searchParams]);
  const conversations = await getOwnConversations();

  return (
    <MessagesScreen
      initialConversations={conversations}
      viewerId={user.id}
      initialConversationId={query.conversation ?? null}
    />
  );
}
