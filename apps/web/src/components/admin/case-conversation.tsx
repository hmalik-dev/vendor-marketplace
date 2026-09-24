'use client';

import { useState } from 'react';
import { AdminCard, KeyValue, KeyValueList, ScopeChip } from '@/components/admin/admin-detail';
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
 * The month of Pattern C's `12 Sep`. `en-US`, not `en-GB`: British English
 * abbreviates September to `Sept`. UTC, like the window itself.
 */
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

type ThreadWindow = WireAdminConversationMessages['window'];

/** The chip before the read: the server has not said which dates yet, so it names none. */
export const THREAD_CHIP = 'Case-scoped read';

/**
 * The scope before the read, and on a case that names no thread. The dates
 * come from the response (VEN-412), so until there is one the line says what
 * is always true of the window without inventing which days it covers.
 */
export const THREAD_SCOPE =
  "Read-only, and scoped to the dates the case is about. Admins see those messages, not the relationship's whole history.";

/** Pattern C's footer, for the window the server actually applied. */
export const WINDOW_SCOPE: Record<ThreadWindow['basis'], string> = {
  event_date:
    "Read-only, and scoped to the event date. Admins see the messages the case is about, not the relationship's whole history.",
  report_filed:
    "Read-only, and scoped to the week the report was filed. Admins see the messages the case is about, not the relationship's whole history.",
};

/** `12 Sep only` for one day; `6–12 Sep`, or `29 May – 4 Jun` across a month. */
export function windowLabel(window: ThreadWindow): string {
  const [fromDay, fromMonth] = dayAndMonth(window.from);
  const [toDay, toMonth] = dayAndMonth(window.to);

  if (window.from === window.to) {
    return `${toDay} ${toMonth} only`;
  }

  return fromMonth === toMonth
    ? `${fromDay}–${toDay} ${toMonth}`
    : `${fromDay} ${fromMonth} – ${toDay} ${toMonth}`;
}

function dayAndMonth(isoDay: string): [number, string] {
  const day = new Date(`${isoDay}T00:00:00Z`);

  return [day.getUTCDate(), MONTH.format(day)];
}

function ScopeLine({ children }: { children: string }): React.ReactElement {
  return (
    <div className="mt-auto pt-3">
      <p className="border-t border-stone-150 pt-2.5 text-helper leading-prose text-stone-600">
        {children}
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
 * **There is no reply box, and there is not meant to be.** The admin reads,
 * then acts through moderation or through support. Nothing here posts into the
 * thread: a participant is a party to the conversation and an admin is not.
 *
 * Renders Pattern C's whole `Reported thread` card, band included, because the
 * chip in the band states the window the response enforced (VEN-412) and only
 * this component holds the response.
 */
export function CaseConversation({
  caseId,
  conversationId,
}: {
  /** The case on screen: its report, not the thread's oldest, dates the read. */
  caseId: string;
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
        await request(`/admin/conversations/${conversationId}/messages?caseId=${caseId}`, {
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

  /*
   * Pattern C §2. **Not `readOnly`, deliberately**: the thread is read-only,
   * but opening it writes an audit row, so the card carries one control — the
   * deliberate press that is the read.
   */
  const card = (chip: string, body: React.ReactElement): React.ReactElement => (
    <AdminCard
      title="Reported thread"
      note={<ScopeChip>{chip}</ScopeChip>}
      className="flex flex-col"
    >
      {/*
        The id stays on the page without the audited read: an admin quoting
        it into a ticket or `/admin/activity` should not have to open the thread
        to copy it.
      */}
      <KeyValueList className="border-b border-stone-150">
        <KeyValue label="Conversation" kind="mono">
          {conversationId}
        </KeyValue>
      </KeyValueList>
      {body}
    </AdminCard>
  );

  if (!thread) {
    return card(
      THREAD_CHIP,
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
        <ScopeLine>{THREAD_SCOPE}</ScopeLine>
      </div>,
    );
  }

  return card(
    `${THREAD_CHIP} · ${windowLabel(thread.window)}`,
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
                would otherwise decide the width of the card an admin rules
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
      <ScopeLine>{WINDOW_SCOPE[thread.window.basis]}</ScopeLine>
    </div>,
  );
}
