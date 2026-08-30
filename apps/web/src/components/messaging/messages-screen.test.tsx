import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireConversation } from '@/lib/wire-schemas';

const call = vi.fn();
let connected = true;
const onEventRef: { current: ((event: unknown) => void) | null } = { current: null };

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

afterEach(() => {
  cleanup();
  call.mockReset();
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

/** The screen loads a thread and marks it read on mount. */
function respondWith(messages: ReturnType<typeof message>[]): void {
  call.mockImplementation(async (path: string) => {
    if (path.endsWith('/messages')) {
      return { items: messages, total: messages.length, page: 1, pageSize: 50 };
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
        return { items: [], total: 0, page: 1, pageSize: 50 };
      }
      // A send refreshes the list, so this has to answer with one.
      return path === '/conversations' ? [conversation()] : null;
    });

    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
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
        return { items: [], total: 0, page: 1, pageSize: 50 };
      }
      return path === '/conversations' ? [conversation()] : null;
    });

    render(
      <MessagesScreen
        initialConversations={[conversation()]}
        viewerId={VIEWER}
        initialConversationId={null}
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
        <MessagesScreen viewerId={VIEWER} initialConversations={[]} initialConversationId={null} />,
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
        />,
      );

      await screen.findByLabelText('Write a message');
      expect(screen.getByRole('button', { name: 'Back to messages' }).className).toContain(
        'md:hidden',
      );
    });
  });
});
