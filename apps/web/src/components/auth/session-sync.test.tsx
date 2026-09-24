import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION_BURST_MS, resetSessionEndedForTests } from '@/lib/auth/session-ended';
import { FakeBroadcastChannel } from '@/testing/fake-broadcast-channel';
import { SESSION_PROBE_INTERVAL_MS, SessionSync } from './session-sync';

const getSessionToken = vi.fn();
const clearSessionToken = vi.fn();

vi.mock('@/lib/auth/client', () => ({
  SESSION_TOKEN_PATH: '/api/session/token',
  getSessionToken: () => getSessionToken(),
  clearSessionToken: () => clearSessionToken(),
}));

const assign = vi.fn();
const fetchMock = vi.fn();
const originalLocation = window.location;

function stubLocation(pathname: string, search = ''): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, search, assign },
  });
}

/** What the tab that signed out does: its own channel object, same name. */
function signOutInAnotherTab(): void {
  new FakeBroadcastChannel('vendor-marketplace:session').postMessage('session-ended');
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

function refocus(): void {
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('focus'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 8, 24, 12, 0, 0));
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  vi.stubGlobal('fetch', fetchMock);
  assign.mockReset();
  fetchMock.mockReset();
  getSessionToken.mockReset();
  clearSessionToken.mockReset();
  setVisibility('visible');
  resetSessionEndedForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  FakeBroadcastChannel.instances = [];
});

describe('SessionSync and a sign-out announced by another tab', () => {
  it.each([
    ['a gated route', '/bookings', '?tab=upcoming', '/bookings?tab=upcoming'],
    ['a public route', '/', '', '/'],
  ])('reloads %s once, however many announcements arrive', (_name, pathname, search, expected) => {
    stubLocation(pathname, search);
    render(<SessionSync />);

    act(() => {
      signOutInAnotherTab();
      signOutInAnotherTab();
    });

    expect(assign).toHaveBeenCalledExactlyOnceWith(expected);
    expect(clearSessionToken).toHaveBeenCalled();
  });

  // A declined `beforeunload` prompt cancels the navigation; the next signal must still leave.
  it('navigates again once the burst has passed, after a navigation that did not happen', () => {
    stubLocation('/vendor/profile/edit');
    render(<SessionSync />);

    act(() => signOutInAnotherTab());
    vi.advanceTimersByTime(NAVIGATION_BURST_MS);
    act(() => signOutInAnotherTab());

    expect(assign).toHaveBeenCalledTimes(2);
  });

  it('ignores a message that is not the sign-out announcement', () => {
    stubLocation('/bookings');
    render(<SessionSync />);

    act(() => {
      new FakeBroadcastChannel('vendor-marketplace:session').postMessage('something-else');
    });

    expect(assign).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    stubLocation('/bookings');
    const { unmount } = render(<SessionSync />);
    unmount();

    act(() => signOutInAnotherTab());

    expect(assign).not.toHaveBeenCalled();
  });
});

describe('SessionSync and the focus probe', () => {
  beforeEach(() => stubLocation('/vendor/dashboard'));

  it('reads the token route fresh, without going through the cached token', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    render(<SessionSync />);

    await act(async () => refocus());

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/session/token', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    expect(getSessionToken).not.toHaveBeenCalled();
  });

  it('reloads on "no session"', async () => {
    fetchMock.mockResolvedValue(new Response('{"token":null}', { status: 401 }));
    render(<SessionSync />);

    await act(async () => refocus());

    expect(assign).toHaveBeenCalledExactlyOnceWith('/vendor/dashboard');
  });

  it('does nothing on a live session or an unreachable server', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    render(<SessionSync />);
    await act(async () => refocus());

    vi.advanceTimersByTime(SESSION_PROBE_INTERVAL_MS);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await act(async () => refocus());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(assign).not.toHaveBeenCalled();
  });

  it('probes at most once per 30 seconds, and again after that', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    render(<SessionSync />);

    await act(async () => refocus());
    vi.advanceTimersByTime(SESSION_PROBE_INTERVAL_MS - 1);
    await act(async () => refocus());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await act(async () => refocus());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not probe a hidden tab', async () => {
    setVisibility('hidden');
    render(<SessionSync />);

    await act(async () => refocus());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not probe at all when it is not mounted, as for a signed-out visitor', async () => {
    await act(async () => refocus());

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
