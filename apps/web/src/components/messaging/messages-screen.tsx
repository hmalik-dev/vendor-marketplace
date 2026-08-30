'use client';

import { MESSAGE_MAX_LENGTH } from '@vendor-marketplace/shared';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/lib/use-api';
import { useEventStream } from '@/lib/use-event-stream';
import {
  wireConversationListSchema,
  wireMessagePageSchema,
  wireMessageSchema,
  type WireConversation,
  type WireMessage,
} from '@/lib/wire-schemas';
import { cn } from '@/lib/utils';

const DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

const CLOCK = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * How close to the ceiling the counter starts speaking.
 *
 * A character count on every message is noise; one that appears only when
 * the limit is within reach is information. 5000 characters is roughly a
 * page of prose, so nobody writing an ordinary message ever sees it.
 */
const MESSAGE_COUNTER_THRESHOLD = 200;
/** "2h", "5h", "3d" — the age of the last message, at a glance. */
function ago(date: Date | null, now: number): string {
  if (!date) {
    return '';
  }

  const minutes = Math.floor((now - date.getTime()) / 60_000);

  if (minutes < 60) {
    return `${Math.max(minutes, 1)}m`;
  }
  if (minutes < 1_440) {
    return `${Math.floor(minutes / 60)}h`;
  }

  return `${Math.floor(minutes / 1_440)}d`;
}

export interface MessagesScreenProps {
  initialConversations: readonly WireConversation[];
  /** The signed-in user, so a bubble knows which side it belongs on. */
  viewerId: string;
  /** `?conversation=` — a thread is linkable. */
  initialConversationId: string | null;
}

/**
 * Frame `10`. Three panes: the conversation list, the thread, and — once the
 * booking rail lands — the context beside it.
 *
 * **The negotiation stays attached to the booking.** Every row carries the
 * booking line it is about, because a vendor with thirty threads is looking
 * for "the June 14 wedding" rather than for a person.
 */
export function MessagesScreen({
  initialConversations,
  viewerId,
  initialConversationId,
}: MessagesScreenProps): React.ReactElement {
  const call = useApi();

  const [conversations, setConversations] = useState<WireConversation[]>([...initialConversations]);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversationId ?? initialConversations[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement>(null);
  const now = Date.now();

  /*
   * Below `md` the two panes become one screen, so exactly one of them shows.
   *
   * `14 Messaging tablet` draws both panes at 768 and there is no frame below
   * it, so this is the usability floor #70 asks for rather than a drawn
   * composition: `activeId` defaults to the first conversation, which meant a
   * narrow screen opened straight into a thread with the list hidden and no
   * control anywhere to get back to it. Every other conversation was
   * unreachable without reloading.
   *
   * Derived once rather than tested twice, so the panes cannot both hide.
   */
  const listOwnsSmallScreen = activeId === null && conversations.length > 0;

  const active = useMemo(
    () => conversations.find((row) => row.id === activeId) ?? null,
    [conversations, activeId],
  );

  const refreshConversations = useCallback(async () => {
    const rows = await call('/conversations', { schema: wireConversationListSchema });
    setConversations(rows);
  }, [call]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      const page = await call(`/conversations/${conversationId}/messages`, {
        schema: wireMessagePageSchema,
      });
      setMessages(page.items);

      // Opening the thread is what marks it read; the list count follows.
      await call(`/conversations/${conversationId}/read`, {
        schema: wireMessagePageSchema.nullable(),
        method: 'PUT',
      }).catch(() => undefined);

      setConversations((rows) =>
        rows.map((row) => (row.id === conversationId ? { ...row, unreadCount: 0 } : row)),
      );
    },
    [call],
  );

  useEffect(() => {
    if (activeId) {
      void loadThread(activeId);
    }
  }, [activeId, loadThread]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  /*
   * A dropped stream is the normal case on a phone, so it is `informational`
   * — steel, never red — and the composer stays usable throughout.
   */
  const { connected } = useEventStream({
    onEvent: (event) => {
      if (event.type === 'new_message') {
        const parsed = wireMessageSchema.safeParse(event.message);

        if (parsed.success && parsed.data.conversationId === activeId) {
          setMessages((current) =>
            current.some((row) => row.id === parsed.data.id) ? current : [...current, parsed.data],
          );
        }
      }

      void refreshConversations();
    },
    // The stream replays nothing, so the gap is closed by refetching.
    onReconnect: () => {
      void refreshConversations();
      if (activeId) {
        void loadThread(activeId);
      }
    },
  });

  async function submit(): Promise<void> {
    const content = draft.trim();

    if (!activeId || content === '' || content.length > MESSAGE_MAX_LENGTH) {
      return;
    }

    setSending(true);
    setFailure(null);

    try {
      const sent = await call(`/conversations/${activeId}/messages`, {
        schema: wireMessageSchema,
        method: 'POST',
        body: { content },
      });

      setMessages((current) =>
        current.some((row) => row.id === sent.id) ? current : [...current, sent],
      );
      setDraft('');
      void refreshConversations();
    } catch {
      // The text is never destroyed — it stays in the composer to be retried.
      setFailure('That message did not send. Your text is still here — try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden">
      <aside
        className={cn(
          'flex w-[300px] shrink-0 flex-col border-r border-stone-300 bg-stone-0',
          listOwnsSmallScreen ? 'max-md:w-full' : 'max-md:hidden',
        )}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4.5 py-3.5">
          <h1 className="text-md font-semibold text-stone-900">Messages</h1>
          {conversations.some((row) => row.unreadCount > 0) ? (
            <span className="text-sm font-semibold text-clay-500">
              Unread ({conversations.filter((row) => row.unreadCount > 0).length})
            </span>
          ) : null}
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {conversations.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setActiveId(row.id)}
                aria-current={row.id === activeId ? 'true' : undefined}
                className={cn(
                  'flex w-full gap-2.75 border-b border-stone-200 px-4.5 py-3.25 text-left',
                  row.id === activeId
                    ? 'bg-clay-100 shadow-[inset_3px_0_0_var(--color-clay-400)]'
                    : 'hover:bg-stone-100',
                )}
              >
                <Avatar name={row.otherPartyName} src={row.otherPartyAvatarUrl} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-base text-stone-900',
                        row.unreadCount > 0 ? 'font-bold' : 'font-medium',
                      )}
                    >
                      {row.otherPartyName}
                    </span>
                    <span className="shrink-0 text-xs text-stone-600">
                      {ago(row.lastMessageAt, now)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-stone-700">
                    {row.lastMessagePreview ?? 'No messages yet'}
                  </span>
                  {row.bookingContext ? (
                    <span
                      className={cn(
                        'mt-1.25 block text-label font-semibold tracking-label uppercase',
                        row.id === activeId ? 'text-clay-600' : 'text-stone-600',
                      )}
                    >
                      Re: {row.bookingContext}
                    </span>
                  ) : null}
                </span>
                {row.unreadCount > 0 ? (
                  <span aria-hidden="true" className="mt-1.5 size-1.75 rounded-full bg-clay-400" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col overflow-hidden bg-stone-50',
          listOwnsSmallScreen && 'max-md:hidden',
        )}
      >
        {active === null ? (
          <EmptyState
            headline="No conversations yet"
            description="A thread opens the moment you send a booking request, so the whole negotiation stays attached to the booking."
            className="flex-1"
          />
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-stone-300 bg-stone-0 px-5.5 py-3">
              {/*
                The way out, and only where there is no list beside the thread
                to go back to. 44px, because `04-laws.md` sizes an icon-only
                control by the finger that presses it — and below `md` this is
                the only navigation on the screen.
              */}
              <button
                type="button"
                onClick={() => setActiveId(null)}
                aria-label="Back to messages"
                className="-ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 md:hidden"
              >
                <ArrowLeft aria-hidden="true" className="size-4.5" />
              </button>
              <Avatar name={active.otherPartyName} src={active.otherPartyAvatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-md font-semibold text-stone-900">
                  {active.otherPartyName}
                </p>
                {active.bookingContext ? (
                  <p className="truncate text-xs text-stone-600">
                    Booking request · {active.bookingContext}
                  </p>
                ) : null}
              </div>
            </div>

            {/*
              Steel, not red: a dropped stream resolves itself, and `40-states.md`
              is explicit that connection loss is information rather than failure.
            */}
            {connected ? null : (
              <div className="shrink-0 px-5.5 pt-3">
                <Banner status="informational" title="Reconnecting">
                  New messages may take a moment to appear. You can still write and send.
                </Banner>
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5.5 py-4.5">
              {messages.length === 0 ? (
                <p className="m-auto max-w-90 text-center text-base leading-prose text-stone-600">
                  Start the conversation — say what you need and when, and the reply lands here.
                </p>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.senderId === viewerId;
                  const previous = messages[index - 1];
                  const newDay =
                    !previous ||
                    previous.createdAt.toDateString() !== message.createdAt.toDateString();

                  return (
                    <div key={message.id} className="contents">
                      {newDay ? (
                        <p className="text-center text-sm text-stone-600">
                          {DAY.format(message.createdAt)}
                        </p>
                      ) : null}
                      <div className={cn('max-w-[62%]', isOwn ? 'self-end' : 'self-start')}>
                        {/*
                          Marketplace, not iMessage: the tail is one squared
                          corner on the sender's side, never a pointer.
                        */}
                        <p
                          className={cn(
                            /*
                              `break-words` is load-bearing, not defensive.
                              `whitespace-pre-wrap` preserves the newlines a
                              message was typed with, but neither it nor the
                              default `overflow-wrap: normal` will break inside
                              a token — so a 160-character share link measured
                              680px of bubble against 768px of text and ran
                              visibly past the rounded edge, and 5000 unbroken
                              characters reached a scrollWidth of 53,677.

                              Pasting a gallery link to a photographer is close
                              to the most likely message this product carries.
                            */
                            'px-3.75 py-3 text-base leading-prose break-words whitespace-pre-wrap text-stone-900',
                            isOwn
                              ? 'rounded-[14px_14px_4px_14px] bg-clay-100'
                              : 'rounded-[14px_14px_14px_4px] bg-stone-0',
                          )}
                        >
                          {message.content}
                        </p>
                        <p
                          className={cn(
                            'mt-1 text-xs text-stone-600',
                            isOwn ? 'pr-1 text-right' : 'pl-1',
                          )}
                        >
                          {isOwn ? 'You' : active.otherPartyName} ·{' '}
                          {CLOCK.format(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottom} />
            </div>

            <div className="shrink-0 border-t border-stone-300 bg-stone-0 px-5.5 py-3.5">
              {failure ? <p className="mb-2 text-xs text-error-500">{failure}</p> : null}
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Reply to ${active.otherPartyName}…`}
                aria-label="Write a message"
                /*
                  `maxLength` as well as the length guard below. The guard
                  refuses to send an over-length draft, which is correct but
                  late: without this the field accepted 5000+ characters and
                  grew to 907px — taller than a 900px viewport — so the Send
                  button that would have explained the problem was off screen.
                  The cap stops the growth at the point it becomes unusable.
                */
                maxLength={MESSAGE_MAX_LENGTH}
                className="max-h-56 min-h-11 overflow-y-auto rounded-xl border-stone-300 bg-stone-150 px-3.5 py-3 text-base"
              />
              <div className="mt-2.5 flex items-center justify-between gap-3">
                {/*
                  Counts down rather than reporting an overage that `maxLength`
                  now prevents, and stays quiet until the limit is close enough
                  to matter — a counter on every message is noise.
                */}
                <span className="text-xs text-stone-600">
                  {draft.length >= MESSAGE_MAX_LENGTH - MESSAGE_COUNTER_THRESHOLD
                    ? `${MESSAGE_MAX_LENGTH - draft.length} characters left`
                    : ''}
                </span>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void submit()}
                  loading={sending}
                  // Empty or over-length is unavailable, which is a different
                  // state from working and keeps the disabled fade.
                  disabled={draft.trim() === '' || draft.length > MESSAGE_MAX_LENGTH}
                >
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
