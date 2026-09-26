import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRereadRoute } from './use-reread-route';

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

describe('useRereadRoute', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('replaces to the current path and query without scrolling, and never refreshes', () => {
    window.history.replaceState(null, '', '/bookings?tab=history&sort=soonest');
    const { result } = renderHook(() => useRereadRoute());

    result.current();

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith('/bookings?tab=history&sort=soonest', {
      scroll: false,
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('leaves the hash off, so the replace is not a hash-only navigation that skips the fetch', () => {
    window.history.replaceState(null, '', '/bookings/req_1#main');
    const { result } = renderHook(() => useRereadRoute());

    result.current();

    expect(replaceMock).toHaveBeenCalledWith('/bookings/req_1', { scroll: false });
  });
});
