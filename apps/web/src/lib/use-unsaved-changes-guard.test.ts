import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';

/**
 * The guard #227 asked for: a prompt when the form is dirty, and none when it
 * is clean.
 */

let anchor: HTMLAnchorElement;

beforeEach(() => {
  anchor = document.createElement('a');
  anchor.href = '/vendor/packages';
  anchor.textContent = 'Packages';
  document.body.append(anchor);
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** A left click that a router would act on. */
function clickAnchor(target: HTMLAnchorElement = anchor): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  target.dispatchEvent(event);
  return event;
}

function unload(): BeforeUnloadEvent {
  const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

describe('useUnsavedChangesGuard when the form is dirty', () => {
  it('holds an in-app navigation and reports where it was going', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true, { navigate }));

    expect(result.current.pendingHref).toBeNull();

    act(() => {
      const event = clickAnchor();
      expect(event.defaultPrevented).toBe(true);
    });

    expect(result.current.pendingHref).toBe('/vendor/packages');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('follows the held link once the vendor confirms', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true, { navigate }));

    act(() => {
      clickAnchor();
    });
    act(() => {
      result.current.confirmLeave();
    });

    expect(navigate).toHaveBeenCalledWith('/vendor/packages');
    expect(result.current.pendingHref).toBeNull();
  });

  it('stays put when the vendor cancels, and navigates nowhere', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true, { navigate }));

    act(() => {
      clickAnchor();
    });
    act(() => {
      result.current.cancelLeave();
    });

    expect(result.current.pendingHref).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('asks the browser to confirm leaving the site', () => {
    renderHook(() => useUnsavedChangesGuard(true));

    expect(unload().defaultPrevented).toBe(true);
  });
});

describe('useUnsavedChangesGuard when the form is clean', () => {
  it('lets the navigation through', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(false, { navigate }));

    act(() => {
      expect(clickAnchor().defaultPrevented).toBe(false);
    });

    expect(result.current.pendingHref).toBeNull();
  });

  it('does not interrupt leaving the site', () => {
    renderHook(() => useUnsavedChangesGuard(false));

    expect(unload().defaultPrevented).toBe(false);
  });
});

describe('clicks the guard deliberately ignores', () => {
  /*
   * Each of these leaves the page standing, so holding it would interrupt the
   * vendor for nothing — the failure mode a guard like this usually ships with.
   */
  it('ignores a modified click, which opens a new tab', () => {
    renderHook(() => useUnsavedChangesGuard(true));

    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores a link that opens elsewhere', () => {
    renderHook(() => useUnsavedChangesGuard(true));

    anchor.target = '_blank';

    expect(clickAnchor().defaultPrevented).toBe(false);
  });

  it('ignores a download', () => {
    renderHook(() => useUnsavedChangesGuard(true));

    anchor.setAttribute('download', '');

    expect(clickAnchor().defaultPrevented).toBe(false);
  });

  it('ignores another origin', () => {
    renderHook(() => useUnsavedChangesGuard(true));

    anchor.href = 'https://stripe.com/connect';

    expect(clickAnchor().defaultPrevented).toBe(false);
  });

  it('ignores an in-page anchor, which changes nothing about the form', () => {
    renderHook(() => useUnsavedChangesGuard(true));

    anchor.href = `${window.location.pathname}#payouts`;

    expect(clickAnchor().defaultPrevented).toBe(false);
  });

  it('ignores a click that is not on a link at all', () => {
    renderHook(() => useUnsavedChangesGuard(true));

    const button = document.createElement('button');
    document.body.append(button);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});

describe('teardown', () => {
  it('stops guarding once the form is no longer dirty', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty), {
      initialProps: { dirty: true },
    });

    rerender({ dirty: false });

    expect(clickAnchor().defaultPrevented).toBe(false);
    expect(unload().defaultPrevented).toBe(false);
  });

  it('removes its listeners when it unmounts', () => {
    const { unmount } = renderHook(() => useUnsavedChangesGuard(true));

    unmount();

    expect(clickAnchor().defaultPrevented).toBe(false);
    expect(unload().defaultPrevented).toBe(false);
  });
});
