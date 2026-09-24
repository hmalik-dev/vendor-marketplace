import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let pathname = '/messages';
const call = vi.fn();
let onEvent: ((event: { type: string; conversationId?: string }) => void) | undefined;

vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/lib/use-api', () => ({ useApi: () => call }));
vi.mock('@/lib/report-error', () => ({ reportSwallowedError: vi.fn() }));
vi.mock('@/lib/use-event-stream', () => ({
  useEventStream: (options: { onEvent: typeof onEvent }) => {
    onEvent = options.onEvent;
    return { connected: true };
  },
}));

const { MessagesLink, CONVERSATION_READ_EVENT } = await import('./messages-link');

const page = (hasUnread: boolean): unknown => ({ items: [], nextBefore: null, hasUnread });

beforeEach(() => {
  pathname = '/messages';
  call.mockReset().mockResolvedValue(page(false));
});

afterEach(() => {
  onEvent = undefined;
  cleanup();
});

describe('MessagesLink', () => {
  it('reads the unread state once on mount', async () => {
    render(<MessagesLink />);

    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    expect(call).toHaveBeenCalledWith('/conversations', expect.anything());
  });

  it('draws the dot when a thread is unread and clears it once the thread is read', async () => {
    call.mockResolvedValue(page(true));
    render(<MessagesLink />);

    await screen.findByRole('link', { name: 'Messages, unread' });

    call.mockResolvedValue(page(false));
    window.dispatchEvent(new Event(CONVERSATION_READ_EVENT));

    await waitFor(() => expect(screen.queryByTestId('messages-unread-dot')).toBeNull());
    expect(screen.getByRole('link', { name: 'Messages' })).toBeDefined();
  });

  it('lights the dot when a message arrives over the stream', async () => {
    render(<MessagesLink />);
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));

    call.mockResolvedValue(page(true));
    onEvent?.({ type: 'new_message', conversationId: 'c1' });

    await screen.findByRole('link', { name: 'Messages, unread' });
  });

  it('keeps the last known state when the read fails', async () => {
    call.mockResolvedValue(page(true));
    render(<MessagesLink />);
    await screen.findByRole('link', { name: 'Messages, unread' });

    call.mockRejectedValue(new Error('offline'));
    window.dispatchEvent(new Event(CONVERSATION_READ_EVENT));

    await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('link', { name: 'Messages, unread' })).toBeDefined();
  });

  it.each(['/accept-terms', '/vendors/apply'])('asks nothing on %s', (path) => {
    pathname = path;
    render(<MessagesLink />);

    expect(screen.getByRole('link', { name: 'Messages' })).toBeDefined();
    expect(call).not.toHaveBeenCalled();
  });
});
