'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import {
  wireAdminConversationMessagesSchema,
  type WireAdminConversationMessages,
} from '@/lib/wire-schemas';

/**
 * The reported thread, read from the case that names it (#436).
 *
 * **On a button, not on page load, and that is the audit design rather than a
 * loading strategy.** Every successful read writes an `admin_actions` row, so
 * fetching this with the rest of the case would put a row in the log for every
 * refresh, every back-button return and every glance at the money fields — and
 * a log that records reads nobody made is a log nobody can use to answer who
 * read what. One deliberate press, one row.
 *
 * **There is no reply box, and there is not meant to be.** The operator reads,
 * then acts through moderation or through support. Nothing here posts into the
 * thread: a participant is a party to the conversation and an operator is not.
 */
export function CaseConversation({
  conversationId,
}: {
  conversationId: string;
}): React.ReactElement {
  const request = useApi();
  const [thread, setThread] = useState<WireAdminConversationMessages | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function read(): Promise<void> {
    setLoading(true);
    setFailure(null);

    try {
      setThread(
        await request(`/admin/conversations/${conversationId}/messages`, {
          schema: wireAdminConversationMessagesSchema,
        }),
      );
    } catch (error) {
      /*
       * The 403 this route answers is not a permission bug to hide behind a
       * generic sentence — it is the scope working, and its message says so:
       * a thread is readable from the report that raised it, and only while
       * that case is open. `userFacingError` keeps that wording.
       */
      setFailure(userFacingError(error, 'That thread did not load. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  if (!thread) {
    return (
      <div>
        <p className="text-sm text-stone-600">
          Opening this thread is recorded against your account, with the case it was read under.
        </p>
        <div className="mt-3">
          <Button variant="secondary" loading={loading} onClick={() => void read()}>
            Read the reported thread
          </Button>
        </div>
        {failure === null ? null : (
          <p role="alert" className="mt-3 text-sm text-error-500">
            {failure}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-stone-600">
        {thread.customerName} and {thread.vendorName} · {thread.messages.total}{' '}
        {thread.messages.total === 1 ? 'message' : 'messages'}
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {thread.messages.items.map((message) => (
          <li
            key={message.id}
            className="rounded-xl border border-stone-300 bg-stone-0 px-3.5 py-2.5"
          >
            <p className="text-label font-semibold tracking-label text-stone-600 uppercase">
              {message.senderSide === 'customer' ? thread.customerName : thread.vendorName} ·{' '}
              {message.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC
              {message.readAt === null ? ' · unread' : ''}
            </p>
            {/*
              What somebody typed, paragraphs intact. `break-words` because
              every character of this is user input and a single unbroken run
              would otherwise decide the width of the card an operator rules
              from.
            */}
            <p className="mt-1 text-base leading-prose break-words whitespace-pre-wrap text-stone-900">
              {message.content}
            </p>
          </li>
        ))}
      </ul>

      {thread.messages.total > thread.messages.items.length ? (
        <p className="mt-3 text-sm text-stone-600">
          The most recent {thread.messages.items.length} of {thread.messages.total} messages.
        </p>
      ) : null}
    </div>
  );
}
