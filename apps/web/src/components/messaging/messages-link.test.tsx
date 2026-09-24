import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let pathname = '/messages';
const call = vi.fn();

vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/lib/use-api', () => ({ useApi: () => call }));
vi.mock('@/lib/report-error', () => ({ reportSwallowedError: vi.fn() }));

const { MessagesLink, CONVERSATIONS_CHANGED_EVENT } = await import('./messages-link');

const page = (hasUnread: boolean): unknown => ({ items: [], nextBefore: null, hasUnread });

beforeEach(() => {
  pathname = '/messages';
  call.mockReset().mockResolvedValue(page(false));
});

afterEach(() => {
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
    window.dispatchEvent(new Event(CONVERSATIONS_CHANGED_EVENT));

    await waitFor(() => expect(screen.queryByTestId('messages-unread-dot')).toBeNull());
    expect(screen.getByRole('link', { name: 'Messages' })).toBeDefined();
  });

  it('lights the dot when told the conversations changed', async () => {
    render(<MessagesLink />);
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));

    call.mockResolvedValue(page(true));
    window.dispatchEvent(new Event(CONVERSATIONS_CHANGED_EVENT));

    await screen.findByRole('link', { name: 'Messages, unread' });
  });

  it('lets the newest read win when an older one resolves after it', async () => {
    let resolveStale: (value: unknown) => void = () => {};
    call.mockReset();
    call.mockImplementationOnce(() => Promise.resolve(page(false)));
    render(<MessagesLink />);
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));

    call.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    window.dispatchEvent(new Event(CONVERSATIONS_CHANGED_EVENT));
    call.mockImplementationOnce(() => Promise.resolve(page(false)));
    window.dispatchEvent(new Event(CONVERSATIONS_CHANGED_EVENT));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(3));

    await act(async () => resolveStale(page(true)));

    expect(screen.getByRole('link', { name: 'Messages' })).toBeDefined();
    expect(screen.queryByTestId('messages-unread-dot')).toBeNull();
  });

  it('keeps the last known state when the read fails', async () => {
    call.mockResolvedValue(page(true));
    render(<MessagesLink />);
    await screen.findByRole('link', { name: 'Messages, unread' });

    call.mockRejectedValue(new Error('offline'));
    window.dispatchEvent(new Event(CONVERSATIONS_CHANGED_EVENT));

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
