import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_COPY } from '@/app/auth-copy';

const push = vi.fn();
// One router object, as Next hands out: a fresh one per render would re-run the load effect.
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const { SessionsList } = await import('./sessions-list');

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1';
const TWO_DEVICES = {
  sessions: [
    { id: 'here', userAgent: CHROME, lastActiveAt: '2026-09-24T09:00:00.000Z', current: true },
    { id: 'phone', userAgent: IPHONE, lastActiveAt: '2026-09-23T10:00:00.000Z', current: false },
  ],
};
const ONE_DEVICE = { sessions: [TWO_DEVICES.sessions[0]] };

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

/** Answers the list from `lists` in turn (the last one repeats) and every revoke with `revoke`. */
function serve(lists: unknown[], revoke: Response = Response.json({ success: true })): void {
  let read = 0;
  fetchMock.mockImplementation(async (url) =>
    url.endsWith('list-sessions')
      ? Response.json(lists[Math.min(read++, lists.length - 1)])
      : revoke.clone(),
  );
}

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SessionsList (VEN-681)', () => {
  it('lists each device by a short label, marks this one and offers no sign-out for it', async () => {
    serve([TWO_DEVICES]);
    render(<SessionsList />);

    expect(await screen.findByText('Chrome on macOS')).toBeDefined();
    expect(screen.getByText('Safari on iOS')).toBeDefined();
    expect(screen.getAllByText(AUTH_COPY.thisDevice)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Sign out: / })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Sign out: Safari on iOS' })).toBeDefined();
  });

  it('says so when this is the only device, and offers no bulk sign-out', async () => {
    serve([ONE_DEVICE]);
    render(<SessionsList />);

    expect(await screen.findByText(AUTH_COPY.sessionsNoOthers)).toBeDefined();
    expect(screen.queryByRole('button', { name: AUTH_COPY.signOutOthers })).toBeNull();
  });

  it('signs one device out by its id, then reads the list again', async () => {
    serve([TWO_DEVICES, ONE_DEVICE]);
    const user = userEvent.setup();
    render(<SessionsList />);

    await user.click(await screen.findByRole('button', { name: 'Sign out: Safari on iOS' }));

    const revoke = fetchMock.mock.calls.find(([url]) => url.endsWith('/revoke-session'));
    expect(revoke?.[1]?.method).toBe('POST');
    expect(revoke?.[1]?.body).toBe(JSON.stringify({ id: 'phone' }));
    expect((await screen.findByRole('status')).textContent).toContain(AUTH_COPY.sessionEnded);
    await waitFor(() => expect(screen.queryByText('Safari on iOS')).toBeNull());
  });

  it('signs every other device out at once', async () => {
    serve([TWO_DEVICES, ONE_DEVICE]);
    const user = userEvent.setup();
    render(<SessionsList />);

    await user.click(await screen.findByRole('button', { name: AUTH_COPY.signOutOthers }));

    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/revoke-other-sessions'))).toBe(true);
    expect((await screen.findByRole('status')).textContent).toContain(AUTH_COPY.sessionsEnded);
    await waitFor(() => expect(screen.queryByText('Safari on iOS')).toBeNull());
  });

  it('keeps the list and says so when a sign-out fails, never printing the upstream message', async () => {
    serve([TWO_DEVICES], Response.json({ message: 'raw upstream text' }, { status: 502 }));
    const user = userEvent.setup();
    render(<SessionsList />);

    await user.click(await screen.findByRole('button', { name: AUTH_COPY.signOutOthers }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(AUTH_COPY.unreachable);
    expect(screen.queryByText(/raw upstream text/)).toBeNull();
    expect(screen.getByText('Safari on iOS')).toBeDefined();
  });

  it('sends a person whose session ended elsewhere to sign in and back', async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 401 }));
    render(<SessionsList />);

    await waitFor(() =>
      expect(push).toHaveBeenCalledExactlyOnceWith(
        '/sign-in?returnTo=%2Faccount%2Fsettings%2Fsessions',
      ),
    );
  });

  it('says the devices could not be loaded, without an empty list', async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 502 }));
    render(<SessionsList />);

    expect((await screen.findByRole('alert')).textContent).toBe(AUTH_COPY.unreachable);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
