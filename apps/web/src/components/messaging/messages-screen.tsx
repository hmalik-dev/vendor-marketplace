'use client';

import { MESSAGE_MAX_LENGTH, shortTimeAgo } from '@vendor-marketplace/shared';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/textarea';
import { reportSwallowedError } from '@/lib/report-error';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
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
export interface MessagesScreenProps {
  initialConversations: readonly WireConversation[];
  /** The signed-in user, so a bubble knows which side it belongs on. */
  viewerId: string;
  /** `?conversation=` — a thread is linkable. */
  initialConversationId: string | null;
  /**
   * Whether the list read failed, as opposed to coming back empty.
   *
   * An outage used to render "No conversations yet" over a real inbox (#402) —
   * a designed empty state speaking for a database it never reached.
   */
  listFailed: boolean;
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
  listFailed,
}: MessagesScreenProps): React.ReactElement {
  const call = useApi();
  const router = useRouter();

  const [conversations, setConversations] = useState<WireConversation[]>([...initialConversations]);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversationId ?? initialConversations[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<WireMessage[]>([]);
  /** Whether a page older than the one at the top of the thread exists. */
  const [hasOlder, setHasOlder] = useState(false);
  /** The oldest page fetched. Page 1 is the newest; paging walks backwards. */
  const [page, setPage] = useState(1);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** Distance from the bottom to put back once a prepended page has laid out. */
  const [restoreAnchor, setRestoreAnchor] = useState<number | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  /** Bumped by Try again, so the load effect runs a second time for one id. */
  const [reloadKey, setReloadKey] = useState(0);
  /*
   * One draft per conversation, not one for the screen (#402).
   *
   * A single string stayed in the composer across a thread switch and `submit`
   * posted it to whichever thread was active when Send was pressed — a vendor
   * negotiating with two customers could send one customer's price to the
   * other.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement>(null);
  /** The scrolling thread, so a prepend can keep the reader where they were. */
  const scroller = useRef<HTMLDivElement>(null);
  const now = Date.now();

  /*
   * The thread every async write has to belong to.
   *
   * A GET or a POST that resolves after the reader has moved on used to write
   * its rows into whatever thread was on screen — B's header over A's bubbles,
   * or A's just-sent message at the bottom of B (#402). Read in a callback
   * rather than closed over, so the check sees the thread that is open *now*.
   */
  const openThreadRef = useRef<string | null>(null);

  /** Guards the send synchronously; React state lands a render too late. */
  const sendingRef = useRef(false);

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

  /** A `?conversation=` that names no thread of this reader's. */
  const notFound = activeId !== null && active === null;

  /*
   * `?conversation=` is followed on every change, not only at mount (#402).
   *
   * A bell click from `/messages?conversation=A` to `?conversation=B` is a
   * client navigation, so this component is not remounted and the prop was
   * read once and never again: the URL said B, the pane still showed A, and
   * the notification that pointed at B was already struck through.
   *
   * The ref remembers which id the URL last carried, so a change made *here*
   * is not mistaken for one arriving from the router — and the reverse, so
   * Back and a notification are both honoured.
   */
  const urlConversationId = useRef(initialConversationId);

  useEffect(() => {
    if (initialConversationId !== urlConversationId.current) {
      urlConversationId.current = initialConversationId;
      setActiveId(initialConversationId);
    }
  }, [initialConversationId]);

  /*
   * A bare `/messages` opens the newest thread, so the URL is made to say so.
   *
   * Without this the same URL rendered two different screens depending on how
   * you arrived: a fresh load opened the first thread, and *Back* onto the same
   * entry showed the chooser, because nothing had recorded which thread the
   * load picked. `replace`, not `push` — this is the entry the reader is
   * already on, not a new place they went.
   */
  useEffect(() => {
    if (initialConversationId !== null || activeId === null) {
      return;
    }

    urlConversationId.current = activeId;
    router.replace(`/messages?conversation=${encodeURIComponent(activeId)}`, { scroll: false });
    // Once, for the thread the mount picked; every later change goes through
    // `select`, which writes the URL itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Opens a thread, and says so in the URL.
   *
   * Without the second half a thread was not linkable at all, contradicting
   * this screen's own contract: a reload returned to the top thread and Back
   * left `/messages` entirely rather than returning to the thread before it.
   */
  const select = useCallback(
    (conversationId: string | null) => {
      urlConversationId.current = conversationId;
      setActiveId(conversationId);
      router.push(
        conversationId === null
          ? '/messages'
          : `/messages?conversation=${encodeURIComponent(conversationId)}`,
        { scroll: false },
      );
    },
    [router],
  );

  const refreshConversations = useCallback(async () => {
    const rows = await call('/conversations', { schema: wireConversationListSchema });
    setConversations(rows);
  }, [call]);

  /*
   * Opening the thread is what marks it read; the list count follows.
   *
   * Justified swallow (#368): the count is corrected on the next load, and
   * an error toast for a read receipt would interrupt the reader over
   * something they did not ask for and cannot act on. Reported rather than
   * dropped, because a mark-read that fails *every* time is a real defect
   * that would otherwise never surface.
   */
  const markRead = useCallback(
    async (conversationId: string) => {
      await call(`/conversations/${conversationId}/read`, {
        schema: wireMessagePageSchema.nullable(),
        method: 'PUT',
      }).catch((error: unknown) => {
        reportSwallowedError('messages: marking a conversation read failed', error);
      });

      setConversations((rows) =>
        rows.map((row) => (row.id === conversationId ? { ...row, unreadCount: 0 } : row)),
      );
    },
    [call],
  );

  /*
   * The thread to read, and only ever one this reader is actually in.
   *
   * A foreign, deleted or malformed `?conversation=` used to be fetched
   * anyway: the API refused it correctly and the rejection escaped as an
   * uncaught page error, over an empty pane claiming "No conversations yet"
   * beside a populated list. An id that names no row is a render decision, not
   * a request.
   */
  const threadId = active?.id ?? null;
  openThreadRef.current = threadId;

  useEffect(() => {
    setMessages([]);
    setThreadError(null);
    setHasOlder(false);
    setPage(1);

    if (threadId === null) {
      return;
    }

    /*
     * Cancellation, not just a guard on the write. Two switches in flight
     * resolve in whatever order the network gives them, and the loser used to
     * win: A's response landing last wrote A's bubbles under B's header, and
     * Send then posted the draft to B.
     *
     * The request is aborted as well as ignored, the way `SearchShell` aborts
     * a search the reader has already moved past — the response nobody will
     * read should not be waited for either.
     */
    const aborter = new AbortController();
    let cancelled = false;
    setLoadingThread(true);

    void (async () => {
      try {
        const first = await call(`/conversations/${threadId}/messages`, {
          schema: wireMessagePageSchema,
          signal: aborter.signal,
        });

        if (cancelled) {
          return;
        }

        setMessages(first.items);
        /*
         * Read off the page itself, not `total`.
         *
         * `items.length < total` compares the client's accumulated set against
         * a count taken from a *different* snapshot: one message the client
         * never received — a dropped frame, a socket down while the reader was
         * paging — makes the inequality permanently true, so the control never
         * goes away and every further click fetches a deeper empty page. A
         * full page is the honest signal that another may exist; the cost of
         * getting it wrong is one empty fetch on a thread whose length is an
         * exact multiple of the page size, and it self-corrects.
         */
        setHasOlder(first.items.length === first.pageSize);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        reportSwallowedError('messages: loading a thread failed', error);
        setThreadError(userFacingError(error, 'We could not open this conversation.'));
        return;
      } finally {
        if (!cancelled) {
          setLoadingThread(false);
        }
      }

      await markRead(threadId);
    })();

    return () => {
      cancelled = true;
      aborter.abort();
    };
  }, [threadId, reloadKey, call, markRead]);

  /**
   * Re-reads the newest page and merges it in, for a stream that came back.
   *
   * The gap the socket missed is at the *newest* end, so page 1 closes it —
   * and merging rather than replacing is what keeps the reader where they
   * were. Reloading the thread instead would drop every earlier page they had
   * loaded and scroll them back to the present, on an event the hook's own
   * comment calls the normal case on a phone.
   */
  const refreshThread = useCallback(async () => {
    const conversationId = openThreadRef.current;

    if (conversationId === null) {
      return;
    }

    try {
      const newest = await call(`/conversations/${conversationId}/messages`, {
        schema: wireMessagePageSchema,
      });

      if (openThreadRef.current !== conversationId) {
        return;
      }

      setMessages((current) => {
        const known = new Set(current.map((row) => row.id));
        return [...current, ...newest.items.filter((row) => !known.has(row.id))];
      });
    } catch (error: unknown) {
      reportSwallowedError('messages: refetching after a reconnect failed', error);
    }
  }, [call]);

  /**
   * The page before the one at the top, prepended.
   *
   * Page 1 is the newest 50 (#402), so history is reached by walking
   * backwards. Without this the older messages the API no longer leads with
   * would be unreachable.
   */
  const loadOlder = useCallback(async () => {
    if (threadId === null) {
      return;
    }

    setLoadingOlder(true);
    const older = page + 1;

    try {
      const previous = await call(`/conversations/${threadId}/messages?page=${older}`, {
        schema: wireMessagePageSchema,
      });

      // The reader may have moved on while this was in flight.
      if (openThreadRef.current !== threadId) {
        return;
      }

      /*
       * Where the reader is, measured from the *bottom*.
       *
       * Inserting a page above shifts every existing bubble down by however
       * tall that page turns out to be, and the browser keeps `scrollTop` — so
       * the message being read slides away and the pane lands on the oldest
       * message of the page just fetched. Distance from the bottom is the one
       * quantity the prepend does not change, so restoring it puts the same
       * message back under the same pixel.
       */
      const pane = scroller.current;
      const anchor = pane ? pane.scrollHeight - pane.scrollTop : null;

      setMessages((current) => {
        const known = new Set(current.map((row) => row.id));
        return [...previous.items.filter((row) => !known.has(row.id)), ...current];
      });
      setHasOlder(previous.items.length === previous.pageSize);
      setPage(older);
      setRestoreAnchor(anchor);
    } catch (error: unknown) {
      reportSwallowedError('messages: loading earlier messages failed', error);

      if (openThreadRef.current === threadId) {
        setThreadError(userFacingError(error, 'We could not load the earlier messages.'));
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [call, page, threadId]);

  /*
   * Follows the *newest* message rather than the array, so prepending a page
   * of history does not yank the reader back down to the present.
   */
  const newestMessageId = messages.at(-1)?.id ?? null;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [newestMessageId]);

  /*
   * `useLayoutEffect`, because the correction has to land in the same frame the
   * taller list paints in — a `useEffect` shows the reader the jump and then
   * takes it back.
   */
  useLayoutEffect(() => {
    const pane = scroller.current;

    if (restoreAnchor === null || pane === null) {
      return;
    }

    pane.scrollTop = pane.scrollHeight - restoreAnchor;
    setRestoreAnchor(null);
  }, [restoreAnchor]);

  /*
   * A dropped stream is the normal case on a phone, so it is `informational`
   * — steel, never red — and the composer stays usable throughout.
   */
  const { connected } = useEventStream({
    onEvent: (event) => {
      if (event.type === 'new_message') {
        const parsed = wireMessageSchema.safeParse(event.message);

        if (parsed.success && parsed.data.conversationId === openThreadRef.current) {
          const arrived = parsed.data;

          setMessages((current) =>
            current.some((row) => row.id === arrived.id) ? current : [...current, arrived],
          );

          /*
           * The stream publishes a send to *both* parties, so this also fires
           * as the echo of the reader's own message — which `submit` has
           * already appended and already refreshed the list for. There is
           * nothing of theirs to mark read and nothing new to fetch.
           */
          if (arrived.senderId === viewerId) {
            return;
          }

          /*
           * On screen is read (#402). Without this the row went bold with an
           * unread dot and the header counted "Unread (1)" for a message the
           * reader was looking at, clearing only on a later thread switch.
           * The refresh follows the receipt so it cannot read the old count.
           */
          void markRead(arrived.conversationId)
            .then(refreshConversations)
            .catch((error: unknown) => {
              reportSwallowedError('messages: refreshing the list after an arrival failed', error);
            });
          return;
        }
      }

      void refreshConversations();
    },
    // The stream replays nothing, so the gap is closed by refetching.
    onReconnect: () => {
      void refreshConversations();
      void refreshThread();
    },
  });

  const draft = activeId === null ? '' : (drafts[activeId] ?? '');

  function setDraft(value: string): void {
    if (activeId === null) {
      return;
    }

    setDrafts((current) => ({ ...current, [activeId]: value }));
  }

  async function submit(): Promise<void> {
    const conversationId = threadId;
    const content = draft.trim();

    /*
     * `sendingRef` and not `sending`: state is a render behind, so two clicks
     * inside one frame both passed the check and the thread grew two identical
     * bubbles over two rows in the database.
     */
    if (
      sendingRef.current ||
      conversationId === null ||
      content === '' ||
      content.length > MESSAGE_MAX_LENGTH
    ) {
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setFailure(null);

    try {
      const sent = await call(`/conversations/${conversationId}/messages`, {
        schema: wireMessageSchema,
        method: 'POST',
        body: { content },
      });

      // Belongs to the thread it was written in, wherever the reader is now.
      if (openThreadRef.current === conversationId) {
        setMessages((current) =>
          current.some((row) => row.id === sent.id) ? current : [...current, sent],
        );
      }

      setDrafts((current) => ({ ...current, [conversationId]: '' }));
      void refreshConversations();
    } catch {
      // The text is never destroyed — it stays in the composer to be retried.
      setFailure('That message did not send. Your text is still here — try again.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  /**
   * The thread pane when no thread of this reader's is open.
   *
   * Three different situations used to share one sentence (#402). A
   * `?conversation=` naming a thread the reader is not in rendered "No
   * conversations yet" beside a list of their five real threads — a false
   * statement about their own inbox, with no explanation and no way back.
   */
  function vacantPane(): React.ReactElement {
    if (notFound) {
      return (
        <EmptyState
          headline="We could not find that conversation"
          description="The link may be out of date, or the thread may belong to another account. Your other conversations are all still here."
          action={
            <Button type="button" variant="secondary" onClick={() => select(null)}>
              Back to messages
            </Button>
          }
          className="flex-1"
        />
      );
    }

    /*
     * The outage, said as an outage. `40-states.md`: an empty state is a
     * statement about the data, and it must not be made on a read that never
     * landed — a browser pass saw "No conversations yet" over an inbox holding
     * two threads, because the API was down at render time. The stream refills
     * the list on its own, so the offer is a retry rather than an apology.
     */
    if (listFailed && conversations.length === 0) {
      return (
        <EmptyState
          headline="We could not load your messages"
          description="The connection did not answer. Your conversations are safe — try again in a moment."
          action={
            <Button type="button" variant="secondary" onClick={() => router.refresh()}>
              Try again
            </Button>
          }
          className="flex-1"
        />
      );
    }

    const words =
      conversations.length === 0
        ? {
            headline: 'No conversations yet',
            description:
              'A thread opens the moment you send a booking request, so the whole negotiation stays attached to the booking.',
          }
        : {
            headline: 'Choose a conversation',
            description:
              'Open a thread on the left to read it and reply. Every one carries the booking it is about.',
          };

    return <EmptyState {...words} className="flex-1" />;
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
                onClick={() => select(row.id)}
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
                      {shortTimeAgo(row.lastMessageAt, now)}
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
          vacantPane()
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
                onClick={() => select(null)}
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

            <div
              ref={scroller}
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5.5 py-4.5"
            >
              {/*
                The thread opens at its newest page, so the history is above
                rather than behind a reload that could never reach it (#402).
              */}
              {hasOlder ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-center"
                  onClick={() => void loadOlder()}
                  loading={loadingOlder}
                >
                  {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                </Button>
              ) : null}

              {/*
                A read that fails says so. It used to leave the previous
                thread's bubbles under this thread's header while the rejection
                escaped as an uncaught page error.
              */}
              {threadError ? (
                <p
                  role="alert"
                  className="m-auto max-w-90 text-center text-base leading-prose text-error-500"
                >
                  {threadError}{' '}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReloadKey((key) => key + 1)}
                  >
                    Try again
                  </Button>
                </p>
              ) : null}

              {/*
                Only once the thread is known to be empty. While the first page
                was in flight this copy sat over a conversation with a hundred
                messages in it.
              */}
              {messages.length === 0 && !loadingThread && threadError === null ? (
                <p className="m-auto max-w-90 text-center text-base leading-prose text-stone-600">
                  Start the conversation — say what you need and when, and the reply lands here.
                </p>
              ) : null}

              {messages.map((message, index) => {
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
                        {isOwn ? 'You' : active.otherPartyName} · {CLOCK.format(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>

            <div className="shrink-0 border-t border-stone-300 bg-stone-0 px-5.5 py-3.5">
              {/*
                `role="alert"` because a failed send is exactly the moment
                assistive technology has to be told something happened: the text
                stays in the composer and nothing else on the screen changes.
              */}
              {failure ? (
                <p role="alert" className="mb-2 text-helper text-error-500">
                  {failure}
                </p>
              ) : null}
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
                  disabled={sending || draft.trim() === '' || draft.length > MESSAGE_MAX_LENGTH}
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
