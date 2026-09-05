import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireConversation } from '@/lib/wire-schemas';

const call = vi.fn();
let connected = true;
const onEventRef: { current: ((event: unknown) => void) | null } = { current: null };
/** The screen writes the open thread into `?conversation=`, so a thread is linkable. */
const push = vi.fn();
/** The bare `/messages` entry records which thread it opened, without pushing. */
const replace = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh }) }));
vi.mock('@/lib/use-api', () => ({ useApi: () => call }));
vi.mock('@/lib/use-event-stream', () => ({
  useEventStream: ({ onEvent }: { onEvent: (event: unknown) => void }) => {
    onEventRef.current = onEvent;
    return { connected };
  },
}));

const { MessagesScreen } = await import('./messages-screen');

/* Real UUIDs: a streamed message is parsed by the wire schema, which
 * validates ids — a placeholder string would be silently dropped. */
const VIEWER = '11111111-1111-4111-8111-111111111111';
const THEM = '22222222-2222-4222-8222-222222222222';
const CONVERSATION = '33333333-3333-4333-8333-333333333333';

/** A second thread, for the cases that turn on which one is open. */
const OTHER_CONVERSATION = '99999999-9999-4999-8999-999999999999';

/** Both of them, as the list would carry them. */
function twoThreads(): WireConversation[] {
  return [
    conversation({ id: CONVERSATION, otherPartyName: 'Kessler & Co.' }),
    conversation({ id: OTHER_CONVERSATION, otherPartyName: 'Marlow Sound' }),
  ];
}

afterEach(() => {
  cleanup();
  call.mockReset();
  push.mockReset();
  replace.mockReset();
  refresh.mockReset();
  connected = true;
});

function conversation(overrides: Partial<WireConversation> = {}): WireConversation {
  return {
    id: CONVERSATION,
    otherPartyName: 'Kessler & Co.',
    otherPartyAvatarUrl: null,
    lastMessagePreview: 'Would you be able to stay till 10?',
    lastMessageAt: new Date('2026-04-21T14:41:00Z'),
    unreadCount: 2,
    bookingContext: 'Jun 14 wedding',
    vendorSlug: 'kessler-co',
    ...overrides,
  } as WireConversation;
}

function message(id: string, senderId: string, content: string) {
  return {
    id,
    conversationId: CONVERSATION,
    senderId,
    content,
    readAt: null,
    createdAt: new Date('2026-04-21T09:14:00Z'),
  };
}

type WireMessagePage = ReturnType<typeof page>;

/**
 * One page of a thread, in the shape `wireMessagePageSchema` describes.
 *
 * `total` defaults to what is in the page, so a caller says so explicitly only
 * when it is testing the case where more history exists above — and `size` with
 * it, because a *full* page is what tells the screen another one may exist.
 */
function page(items: ReturnType<typeof message>[], total = items.length, index = 1, size = 50) {
  return { items, total, page: index, pageSize: size };
}

/** The screen loads a thread and marks it read on mount. */
function respondWith(messages: ReturnType<typeof message>[]): void {
  call.mockImplementation(async (path: string) => {
    if (path.endsWith('/messages')) {
      return page(messages);
    }
    if (path === '/conversations') {
      return [conversation()];
    }
    return null;
  });
}

describe('MessagesScreen', () => {
  /* The line that makes a list of names navigable. */
  it('carries the booking line on every conversation row', async () => {
    respondWith([]);
    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
        listFailed={false}
      />,
    );

    expect(await screen.findByText('Re: Jun 14 wedding')).toBeDefined();
  });

  it('marks an unread row bold and a read one not', async () => {
    respondWith([]);
    render(
      <MessagesScreen
        initialConversations={[
          conversation({ id: VIEWER, otherPartyName: 'Unread Co.', unreadCount: 3 }),
          conversation({ id: THEM, otherPartyName: 'Read Co.', unreadCount: 0 }),
        ]}
        viewerId={VIEWER}
        initialConversationId={THEM}
        listFailed={false}
      />,
    );

    // Scoped to the list: the active thread also names itself in its header.
    const list = screen.getByRole('list');
    expect(within(list).getByText('Unread Co.').className).toContain('font-bold');
    expect(within(list).getByText('Read Co.').className).toContain('font-medium');
  });

  it('opens the conversation named in the URL rather than the first', async () => {
    respondWith([]);
    render(
      <MessagesScreen
        initialConversations={[
          conversation({ id: VIEWER, otherPartyName: 'First Co.' }),
          conversation({ id: THEM, otherPartyName: 'Second Co.' }),
        ]}
        viewerId={VIEWER}
        initialConversationId={THEM}
        listFailed={false}
      />,
    );

    await waitFor(() =>
      expect(call).toHaveBeenCalledWith(`/conversations/${THEM}/messages`, expect.anything()),
    );
  });

  it('invites the first message rather than showing a blank thread', async () => {
    respondWith([]);
    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
        listFailed={false}
      />,
    );

    expect(await screen.findByText(/Start the conversation/)).toBeDefined();
  });

  it('sides each bubble by who sent it', async () => {
    respondWith([
      message('44444444-4444-4444-8444-444444444444', THEM, 'From them'),
      message('55555555-5555-4555-8555-555555555555', VIEWER, 'From me'),
    ]);
    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
        listFailed={false}
      />,
    );

    const theirs = await screen.findByText('From them');
    const mine = screen.getByText('From me');

    // The tail is one squared corner on the sender's side, mirrored per side.
    expect(theirs.className).toContain('rounded-[14px_14px_14px_4px]');
    expect(mine.className).toContain('rounded-[14px_14px_4px_14px]');
    expect(mine.closest('div')?.className).toContain('self-end');
  });

  /*
   * A pasted gallery link is close to the most likely message this product
   * carries, and it escaped its bubble: `whitespace-pre-wrap` keeps the
   * newlines a message was typed with, but neither it nor the default
   * `overflow-wrap: normal` breaks inside a token. A 160-character share URL
   * measured 680px of bubble against 768px of text; 5000 unbroken characters
   * reached a scrollWidth of 53,677.
   *
   * The ticket asks for `scrollWidth <= clientWidth` on the element, and that
   * cannot be asserted here — jsdom performs no layout, so every width is 0 and
   * the assertion would pass against the broken version too. It needs the
   * Playwright harness (#14). What is assertable without layout is that the
   * element carries the rule, which is the class-level fact; the measurement
   * belongs to the browser pass and is recorded as owed rather than faked.
   */
  it.each([
    ['a long unbroken URL', `https://photos.example.com/share/${'a'.repeat(160)}`],
    ['5000 unbroken characters', 'Q'.repeat(5_000)],
  ])('lets the bubble break %s rather than overflow it', async (_name, content) => {
    respondWith([message('44444444-4444-4444-8444-444444444444', THEM, content)]);
    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
        listFailed={false}
      />,
    );

    const bubble = await screen.findByText(content);

    expect(bubble.className).toContain('break-words');
    expect(bubble.className).toContain('whitespace-pre-wrap');
  });

  /*
   * A dropped stream is the normal case on a phone, so it is steel — never red
   * — and the composer stays usable throughout.
   */
  it('says it is reconnecting without disabling the composer', async () => {
    connected = false;
    respondWith([]);
    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
        listFailed={false}
      />,
    );

    expect(await screen.findByText('Reconnecting')).toBeDefined();
    expect(screen.getByLabelText('Write a message')).toHaveProperty('disabled', false);
  });

  it('sends a message and clears the composer', async () => {
    respondWith([]);
    call.mockImplementation(async (path: string, options: { method?: string }) => {
      if (path.endsWith('/messages') && options.method === 'POST') {
        return message('66666666-6666-4666-8666-666666666666', VIEWER, 'On my way');
      }
      if (path.endsWith('/messages')) {
        return page([]);
      }
      // A send refreshes the list, so this has to answer with one.
      return path === '/conversations' ? [conversation()] : null;
    });

    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
        listFailed={false}
      />,
    );

    await userEvent.type(await screen.findByLabelText('Write a message'), 'On my way');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('On my way')).toBeDefined();
    expect(screen.getByLabelText('Write a message')).toHaveProperty('value', '');
  });

  /* Typed text is never destroyed — a failed send leaves it to be retried. */
  it('keeps the draft when a send fails', async () => {
    call.mockImplementation(async (path: string, options: { method?: string }) => {
      if (path.endsWith('/messages') && options.method === 'POST') {
        throw new Error('offline');
      }
      if (path.endsWith('/messages')) {
        return page([]);
      }
      return path === '/conversations' ? [conversation()] : null;
    });

    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
        listFailed={false}
      />,
    );

    await userEvent.type(await screen.findByLabelText('Write a message'), 'On my way');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/Your text is still here/)).toBeDefined();
    expect(screen.getByLabelText('Write a message')).toHaveProperty('value', 'On my way');
  });

  it('appends a streamed message to the open thread', async () => {
    respondWith([]);
    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
        listFailed={false}
      />,
    );

    await screen.findByLabelText('Write a message');

    await act(async () => {
      onEventRef.current?.({
        type: 'new_message',
        conversationId: CONVERSATION,
        message: {
          ...message('77777777-7777-4777-8777-777777777777', THEM, 'Just arrived'),
          createdAt: new Date('2026-04-21T15:00:00Z').toISOString(),
        },
      });
    });

    expect(await screen.findByText('Just arrived')).toBeDefined();
  });
  /*
   * #402. Every one of the cases below was a way for the thread pane to show
   * something other than the conversation its header named.
   */
  describe('the pane always shows the thread its header names', () => {
    /*
     * The read used to have no try/catch and the effect fired it with `void`,
     * so a failure was an unhandled rejection that left the previous thread's
     * bubbles rendered under the new thread's header — and Send posted the
     * draft to the new one.
     */
    it('renders an error rather than the previous thread when a read fails', async () => {
      call.mockImplementation(async (path: string) => {
        if (path === `/conversations/${CONVERSATION}/messages`) {
          return page([message('44444444-4444-4444-8444-444444444444', THEM, 'From Kessler')]);
        }
        if (path === `/conversations/${OTHER_CONVERSATION}/messages`) {
          throw new Error('offline');
        }
        return path === '/conversations' ? twoThreads() : null;
      });

      render(
        <MessagesScreen
          initialConversations={twoThreads()}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      expect(await screen.findByText('From Kessler')).toBeDefined();
      await userEvent.click(screen.getByText('Marlow Sound'));

      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        expect.stringContaining('could not open this conversation'),
      );
      expect(screen.queryByText('From Kessler')).toBeNull();
    });

    /* The loser of the race used to win: A resolving last wrote A under B. */
    it('ignores a stale read that resolves after the reader has moved on', async () => {
      const slow = Promise.withResolvers<WireMessagePage>();

      call.mockImplementation(async (path: string) => {
        if (path === `/conversations/${CONVERSATION}/messages`) {
          return slow.promise;
        }
        if (path === `/conversations/${OTHER_CONVERSATION}/messages`) {
          return page([message('55555555-5555-4555-8555-555555555555', THEM, 'From Marlow')]);
        }
        return path === '/conversations' ? twoThreads() : null;
      });

      render(
        <MessagesScreen
          initialConversations={twoThreads()}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await userEvent.click(screen.getByText('Marlow Sound'));
      expect(await screen.findByText('From Marlow')).toBeDefined();

      // Kessler's read lands *now*, after the reader is already in Marlow's.
      await act(async () => {
        slow.resolve(page([message('44444444-4444-4444-8444-444444444444', THEM, 'From Kessler')]));
      });

      expect(screen.queryByText('From Kessler')).toBeNull();
      expect(screen.getByText('From Marlow')).toBeDefined();
    });

    /* A send resolving after a switch used to append to the wrong thread. */
    it('does not append a send that resolves after a thread switch', async () => {
      const slow = Promise.withResolvers<ReturnType<typeof message>>();

      call.mockImplementation(async (path: string, options: { method?: string }) => {
        if (path.endsWith('/messages') && options.method === 'POST') {
          return slow.promise;
        }
        if (path.endsWith('/messages')) {
          return page([]);
        }
        return path === '/conversations' ? twoThreads() : null;
      });

      render(
        <MessagesScreen
          initialConversations={twoThreads()}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await userEvent.type(await screen.findByLabelText('Write a message'), 'Hold the date');
      await userEvent.click(screen.getByRole('button', { name: 'Send' }));
      await userEvent.click(screen.getByText('Marlow Sound'));

      await act(async () => {
        slow.resolve(message('66666666-6666-4666-8666-666666666666', VIEWER, 'Hold the date'));
      });

      expect(screen.queryByText('Hold the date')).toBeNull();
    });

    /*
     * One draft for the whole screen meant a vendor negotiating with two
     * customers could send one customer's price to the other.
     */
    it('keeps a draft with the conversation it was written for', async () => {
      call.mockImplementation(async (path: string) => {
        if (path.endsWith('/messages')) {
          return page([]);
        }
        return path === '/conversations' ? twoThreads() : null;
      });

      render(
        <MessagesScreen
          initialConversations={twoThreads()}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await userEvent.type(await screen.findByLabelText('Write a message'), '$4,200 all in');
      await userEvent.click(screen.getByText('Marlow Sound'));

      expect(screen.getByLabelText('Write a message')).toHaveProperty('value', '');

      await userEvent.click(screen.getByText('Kessler & Co.'));
      expect(screen.getByLabelText('Write a message')).toHaveProperty('value', '$4,200 all in');
    });

    /*
     * The empty-thread copy used to render over a thread with a hundred
     * messages in it, because `messages` starts `[]` and nothing said "loading".
     */
    it('does not invite a first message while the thread is still loading', async () => {
      const slow = Promise.withResolvers<WireMessagePage>();
      call.mockImplementation(async (path: string) => {
        if (path.endsWith('/messages')) {
          return slow.promise;
        }
        return path === '/conversations' ? [conversation()] : null;
      });

      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await screen.findByLabelText('Write a message');
      expect(screen.queryByText(/Start the conversation/)).toBeNull();

      await act(async () => {
        slow.resolve(page([message('44444444-4444-4444-8444-444444444444', THEM, 'Hello')]));
      });

      expect(screen.getByText('Hello')).toBeDefined();
    });
  });

  describe('the URL and the open thread agree', () => {
    it('writes the thread into ?conversation= when one is opened', async () => {
      respondWith([]);
      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={null}
          listFailed={false}
        />,
      );

      // Scoped to the list: the open thread also names itself in its header.
      const list = await screen.findByRole('list');
      await userEvent.click(within(list).getByText('Kessler & Co.'));

      expect(push).toHaveBeenCalledWith(`/messages?conversation=${CONVERSATION}`, {
        scroll: false,
      });
    });

    /*
     * A bell click from one thread's URL to another's is a client navigation,
     * so the screen is not remounted: the param was read once at mount, the
     * URL said B and the pane went on showing A.
     */
    it('follows ?conversation= when it changes without a remount', async () => {
      call.mockImplementation(async (path: string) => {
        if (path.endsWith('/messages')) {
          return page([]);
        }
        return path === '/conversations' ? twoThreads() : null;
      });

      const conversations = twoThreads();

      const { rerender } = render(
        <MessagesScreen
          initialConversations={conversations}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await waitFor(() =>
        expect(call).toHaveBeenCalledWith(
          `/conversations/${CONVERSATION}/messages`,
          expect.anything(),
        ),
      );

      rerender(
        <MessagesScreen
          initialConversations={conversations}
          viewerId={VIEWER}
          initialConversationId={OTHER_CONVERSATION}
          listFailed={false}
        />,
      );

      await waitFor(() =>
        expect(call).toHaveBeenCalledWith(
          `/conversations/${OTHER_CONVERSATION}/messages`,
          expect.anything(),
        ),
      );
      // The composer addresses the thread the URL now names.
      expect(await screen.findByPlaceholderText('Reply to Marlow Sound…')).toBeDefined();
    });

    /*
     * A foreign, deleted or mistyped id used to render "No conversations yet"
     * beside a populated list, hide that list below `md` with no control to
     * reach it, and fire an uncaught rejection from the read it made anyway.
     */
    it('says a thread was not found rather than claiming the inbox is empty', async () => {
      respondWith([]);
      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId="12345678-1234-4234-8234-123456789012"
          listFailed={false}
        />,
      );

      expect(await screen.findByText('We could not find that conversation')).toBeDefined();
      expect(screen.queryByText('No conversations yet')).toBeNull();
      // No read is attempted for a thread the reader is demonstrably not in.
      expect(call).not.toHaveBeenCalledWith(
        expect.stringContaining('12345678-1234-4234-8234-123456789012'),
        expect.anything(),
      );
    });

    /*
     * A browser pass caught this one: with the API down at render time the
     * screen said "No conversations yet" over an inbox holding two threads.
     */
    it('says the list failed rather than that the inbox is empty', async () => {
      respondWith([]);
      render(
        <MessagesScreen
          initialConversations={[]}
          viewerId={VIEWER}
          initialConversationId={null}
          listFailed
        />,
      );

      expect(await screen.findByText('We could not load your messages')).toBeDefined();
      expect(screen.queryByText('No conversations yet')).toBeNull();
    });

    it('still says the inbox is empty when it really is', async () => {
      respondWith([]);
      render(
        <MessagesScreen
          initialConversations={[]}
          viewerId={VIEWER}
          initialConversationId={null}
          listFailed={false}
        />,
      );

      expect(await screen.findByText('No conversations yet')).toBeDefined();
    });

    /*
     * A bare `/messages` opens the newest thread, so the URL has to say which —
     * otherwise the same entry renders a thread on a fresh load and the chooser
     * when reached by Back.
     */
    it('records the thread a bare /messages opened, without a new history entry', async () => {
      respondWith([]);
      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={null}
          listFailed={false}
        />,
      );

      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith(`/messages?conversation=${CONVERSATION}`, {
          scroll: false,
        }),
      );
      expect(push).not.toHaveBeenCalled();
    });

    it('leaves the URL alone when it already names a thread', async () => {
      respondWith([]);
      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await screen.findByLabelText('Write a message');
      expect(replace).not.toHaveBeenCalled();
    });

    it('offers a way back to the inbox from a thread that was not found', async () => {
      respondWith([]);
      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId="12345678-1234-4234-8234-123456789012"
          listFailed={false}
        />,
      );

      await userEvent.click(await screen.findByRole('button', { name: 'Back to messages' }));

      expect(push).toHaveBeenCalledWith('/messages', { scroll: false });
    });
  });

  describe('the newest messages, and the ones before them', () => {
    /* The API leads with the newest page, so history is reached upwards. */
    it('loads the page before the one on screen, above it', async () => {
      call.mockImplementation(async (path: string) => {
        if (path === `/conversations/${CONVERSATION}/messages`) {
          return page(
            [message('44444444-4444-4444-8444-444444444444', THEM, 'The newest one')],
            2,
            1,
            1,
          );
        }
        if (path === `/conversations/${CONVERSATION}/messages?page=2`) {
          return page(
            [message('55555555-5555-4555-8555-555555555555', THEM, 'An older one')],
            2,
            2,
            1,
          );
        }
        if (path === `/conversations/${CONVERSATION}/messages?page=3`) {
          return page([], 2, 3, 1);
        }
        return path === '/conversations' ? [conversation()] : null;
      });

      const { container } = render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      expect(await screen.findByText('The newest one')).toBeDefined();
      await userEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));

      const bubbles = [...container.querySelectorAll('p.whitespace-pre-wrap')].map(
        (node) => node.textContent,
      );
      expect(bubbles).toEqual(['An older one', 'The newest one']);

      /*
       * Page 2 came back full, so another may exist and the control is still
       * offered — that is deliberate. Whether more history exists is answered
       * by the page in hand, never by a `total` from a different snapshot,
       * because a count the client cannot reconcile leaves this control on
       * screen for ever. The empty page is what ends it.
       */
      await userEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));
      expect(screen.queryByRole('button', { name: 'Load earlier messages' })).toBeNull();
    });

    /*
     * The stuck-control case itself: a thread whose count the client can never
     * reach, because a message arrived that it never received.
     */
    it('stops offering earlier pages even when the count is unreachable', async () => {
      call.mockImplementation(async (path: string) => {
        if (path === `/conversations/${CONVERSATION}/messages`) {
          return page(
            [message('44444444-4444-4444-8444-444444444444', THEM, 'Only one')],
            99,
            1,
            1,
          );
        }
        if (path.includes('?page=')) {
          return page([], 99, 2, 1);
        }
        return path === '/conversations' ? [conversation()] : null;
      });

      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      expect(await screen.findByText('Only one')).toBeDefined();
      await userEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }));

      expect(screen.queryByRole('button', { name: 'Load earlier messages' })).toBeNull();
    });

    it('offers no earlier page when the whole thread is already on screen', async () => {
      respondWith([message('44444444-4444-4444-8444-444444444444', THEM, 'Only one')]);
      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      expect(await screen.findByText('Only one')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Load earlier messages' })).toBeNull();
    });
  });

  describe('what a send and an arrival do to the list', () => {
    /*
     * The row went bold with an unread dot and the header counted "Unread (1)"
     * for a message the reader was looking at.
     */
    it('marks a message that arrives in the open thread read', async () => {
      respondWith([]);
      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await screen.findByLabelText('Write a message');
      call.mockClear();

      await act(async () => {
        onEventRef.current?.({
          type: 'new_message',
          conversationId: CONVERSATION,
          message: {
            ...message('77777777-7777-4777-8777-777777777777', THEM, 'Just arrived'),
            createdAt: new Date('2026-04-21T15:00:00Z').toISOString(),
          },
        });
      });

      expect(await screen.findByText('Just arrived')).toBeDefined();
      expect(call).toHaveBeenCalledWith(
        `/conversations/${CONVERSATION}/read`,
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    /* Two clicks inside one frame both passed the state check. */
    it('sends once however fast Send is pressed twice', async () => {
      const slow = Promise.withResolvers<ReturnType<typeof message>>();
      call.mockImplementation(async (path: string, options: { method?: string }) => {
        if (path.endsWith('/messages') && options.method === 'POST') {
          return slow.promise;
        }
        if (path.endsWith('/messages')) {
          return page([]);
        }
        return path === '/conversations' ? [conversation()] : null;
      });

      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await userEvent.type(await screen.findByLabelText('Write a message'), 'On my way');
      const send = screen.getByRole('button', { name: 'Send' });

      /*
       * `fireEvent` twice inside one `act`, not `userEvent.click` twice.
       * `userEvent` awaits between clicks, by which time the button is
       * `disabled` and refuses the second — so the test would pass on the
       * disabled attribute alone and prove nothing about the synchronous
       * guard, which is the thing that covers two clicks in one frame.
       */
      await act(async () => {
        fireEvent.click(send);
        fireEvent.click(send);
      });

      const posts = call.mock.calls.filter((args) => {
        const [path, options] = args as [string, { method?: string }];
        return path.endsWith('/messages') && options.method === 'POST';
      });
      expect(posts).toHaveLength(1);

      await act(async () => {
        slow.resolve(message('66666666-6666-4666-8666-666666666666', VIEWER, 'On my way'));
      });
    });

    /*
     * The red sentence was visual only: no role and no live region, so
     * assistive technology was never told the send had failed.
     */
    it('announces a failed send rather than only colouring it', async () => {
      call.mockImplementation(async (path: string, options: { method?: string }) => {
        if (path.endsWith('/messages') && options.method === 'POST') {
          throw new Error('offline');
        }
        if (path.endsWith('/messages')) {
          return page([]);
        }
        return path === '/conversations' ? [conversation()] : null;
      });

      render(
        <MessagesScreen
          initialConversations={[conversation()]}
          viewerId={VIEWER}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await userEvent.type(await screen.findByLabelText('Write a message'), 'On my way');
      await userEvent.click(screen.getByRole('button', { name: 'Send' }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('Your text is still here');
    });
  });

  /*
   * #70: below 768 the two panes share one screen, so the pair has to behave
   * like one. `activeId` defaults to the first conversation, which meant a
   * narrow screen opened inside a thread with the list hidden and nothing to
   * press to get back to it — every other conversation unreachable.
   *
   * The composition is class-driven, so what is asserted here is the pair of
   * `max-md` rules and the state transition between them; the rendered result
   * at 768 is `parity-checker`'s.
   */
  describe('below 768, where the panes share one screen', () => {
    /** The list pane and the thread pane, in that order. */
    function panes(container: HTMLElement): [HTMLElement, HTMLElement] {
      const aside = container.querySelector('aside');
      expect(aside, 'no conversation list pane').not.toBeNull();

      const thread = (aside as HTMLElement).nextElementSibling;
      expect(thread, 'no thread pane beside the list').not.toBeNull();

      return [aside as HTMLElement, thread as HTMLElement];
    }

    it('shows the thread and hides the list while a conversation is open', async () => {
      respondWith([message('44444444-4444-4444-8444-444444444444', THEM, 'Hello')]);
      const { container } = render(
        <MessagesScreen
          viewerId={VIEWER}
          initialConversations={[conversation()]}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await screen.findByLabelText('Write a message');

      const [list, thread] = panes(container);
      expect(list.className).toContain('max-md:hidden');
      expect(thread.className).not.toContain('max-md:hidden');
    });

    it('goes back to the list, which then takes the whole screen', async () => {
      respondWith([message('44444444-4444-4444-8444-444444444444', THEM, 'Hello')]);
      const { container } = render(
        <MessagesScreen
          viewerId={VIEWER}
          initialConversations={[conversation()]}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await screen.findByLabelText('Write a message');
      await userEvent.click(screen.getByRole('button', { name: 'Back to messages' }));

      const [list, thread] = panes(container);
      expect(list.className).toContain('max-md:w-full');
      expect(list.className).not.toContain('max-md:hidden');
      expect(thread.className).toContain('max-md:hidden');

      /* And back in again, so it is navigation rather than a one-way exit. */
      await userEvent.click(screen.getByText('Kessler & Co.'));
      expect(panes(container)[0].className).toContain('max-md:hidden');
    });

    /*
     * The one case where an empty list must not win the screen: with no
     * conversations at all, hiding the thread pane would hide the empty state
     * too and leave a narrow screen genuinely blank.
     */
    it('keeps the empty state on screen when there is nothing to list', async () => {
      respondWith([]);
      const { container } = render(
        <MessagesScreen
          viewerId={VIEWER}
          initialConversations={[]}
          initialConversationId={null}
          listFailed={false}
        />,
      );

      const [list, thread] = panes(container);
      expect(list.className).toContain('max-md:hidden');
      expect(thread.className).not.toContain('max-md:hidden');
    });

    /* Above `md` both panes are drawn, so the back control has no job there. */
    it('hides the back control from the width where the list is already beside it', async () => {
      respondWith([message('44444444-4444-4444-8444-444444444444', THEM, 'Hello')]);
      render(
        <MessagesScreen
          viewerId={VIEWER}
          initialConversations={[conversation()]}
          initialConversationId={CONVERSATION}
          listFailed={false}
        />,
      );

      await screen.findByLabelText('Write a message');
      expect(screen.getByRole('button', { name: 'Back to messages' }).className).toContain(
        'md:hidden',
      );
    });
  });
});
