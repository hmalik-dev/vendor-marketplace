'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import { cn } from '@/lib/utils';
import {
  wireAdminConversationMessagesSchema,
  type WireAdminConversationMessages,
} from '@/lib/wire-schemas';

/** Month-first and 24-hour, like every other stamp on the case detail. */
const SENT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

/**
 * The scope, said at the foot of the card whether or not the thread is open.
 *
 * **Scoped to the case, not to the event date** as Pattern C words it. The read
 * is granted by an open case that reports the thread and returns its most
 * recent messages; nothing narrows it to one day, so a line promising that
 * would be a claim about access the API does not make.
 */
export const THREAD_SCOPE =
  'Read-only, and scoped to this case. Operators can open the thread only while the case that reports it is open, and every read is logged.';

function ScopeLine(): React.ReactElement {
  return (
    <div className="mt-auto pt-3">
      <p className="border-t border-stone-150 pt-2.5 text-helper leading-prose text-stone-600">
        {THREAD_SCOPE}
      </p>
    </div>
  );
}

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
 *
 * Renders the body of Pattern C's `Reported thread` card; the page owns the
 * card and its band.
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
      <div className="flex flex-1 flex-col px-4 py-3">
        <p className="text-sm text-stone-600">
          Opening this thread is recorded against your account, with the case it was read under.
        </p>
        <div className="mt-3">
          <Button variant="secondary" size="sm" loading={loading} onClick={() => void read()}>
            Read the reported thread
          </Button>
        </div>
        {failure === null ? null : (
          <p role="alert" className="mt-3 text-sm text-error-500">
            {failure}
          </p>
        )}
        <ScopeLine />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-3">
      <p className="text-helper text-stone-600">
        {thread.customerName} and {thread.vendorName} · {thread.messages.total}{' '}
        {thread.messages.total === 1 ? 'message' : 'messages'}
      </p>

      {/*
        Pattern C's bubbles: the customer on the left on `stone-150`, the vendor
        on the right on `stone-200`, so who said what reads before the names do.
      */}
      <ul className="mt-2.5 flex flex-col gap-2">
        {thread.messages.items.map((message) => {
          const fromCustomer = message.senderSide === 'customer';

          return (
            <li
              key={message.id}
              className={cn(
                'max-w-[78%] rounded-panel px-3 py-2',
                fromCustomer
                  ? 'self-start rounded-bl-[4px] bg-stone-150'
                  : 'self-end rounded-br-[4px] bg-stone-200',
              )}
            >
              {/*
                What somebody typed, paragraphs intact. `break-words` because
                every character of this is user input and a single unbroken run
                would otherwise decide the width of the card an operator rules
                from.
              */}
              <p className="text-sm leading-prose break-words whitespace-pre-wrap text-stone-900">
                {message.content}
              </p>
              <p className="mt-1 text-label text-stone-600">
                {fromCustomer ? thread.customerName : thread.vendorName} ·{' '}
                {SENT.format(message.createdAt)} UTC
                {message.readAt === null ? ' · unread' : ''}
              </p>
            </li>
          );
        })}
      </ul>

      {thread.messages.total > thread.messages.items.length ? (
        <p className="mt-3 text-sm text-stone-600">
          The most recent {thread.messages.items.length} of {thread.messages.total} messages.
        </p>
      ) : null}
      <ScopeLine />
    </div>
  );
}
