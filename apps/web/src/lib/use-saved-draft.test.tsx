import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSavedDraft } from './use-saved-draft';

interface Draft {
  text: string;
}

const isEmpty = (draft: Draft): boolean => draft.text.trim() === '';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/**
 * A long form that loses everything on a reload is the failure this exists to
 * stop — and the one thing worse would be a form that breaks because it could
 * not save a draft.
 */
describe('useSavedDraft', () => {
  it('restores what was written', async () => {
    const first = renderHook(() => useSavedDraft<Draft>('k', isEmpty));
    act(() => first.result.current.save({ text: 'a venue in Marfa' }));

    const second = renderHook(() => useSavedDraft<Draft>('k', isEmpty));

    await waitFor(() =>
      expect(second.result.current.restored).toEqual({ text: 'a venue in Marfa' }),
    );
    expect(second.result.current.wasRestored).toBe(true);
  });

  /* Two requests in progress must not overwrite each other. */
  it('keeps one draft per key', async () => {
    const a = renderHook(() => useSavedDraft<Draft>('vendor-a', isEmpty));
    const b = renderHook(() => useSavedDraft<Draft>('vendor-b', isEmpty));

    act(() => a.result.current.save({ text: 'for A' }));
    act(() => b.result.current.save({ text: 'for B' }));

    const reopened = renderHook(() => useSavedDraft<Draft>('vendor-a', isEmpty));
    await waitFor(() => expect(reopened.result.current.restored).toEqual({ text: 'for A' }));
  });

  it('starts empty when nothing was saved', () => {
    const { result } = renderHook(() => useSavedDraft<Draft>('k', isEmpty));

    expect(result.current.restored).toBeNull();
    expect(result.current.wasRestored).toBe(false);
  });

  /* A form nobody typed into is not a draft, and announcing one would be a lie. */
  it('does not keep an untouched form', async () => {
    const { result } = renderHook(() => useSavedDraft<Draft>('k', isEmpty));
    act(() => result.current.save({ text: '   ' }));

    const reopened = renderHook(() => useSavedDraft<Draft>('k', isEmpty));
    await waitFor(() => expect(reopened.result.current.restored).toBeNull());
  });

  it('forgets a draft once it has been sent', async () => {
    const { result } = renderHook(() => useSavedDraft<Draft>('k', isEmpty));
    act(() => result.current.save({ text: 'written' }));
    act(() => result.current.clear());

    const reopened = renderHook(() => useSavedDraft<Draft>('k', isEmpty));
    await waitFor(() => expect(reopened.result.current.restored).toBeNull());
  });

  /*
   * A private window, blocked site data, or a full quota. The form must keep
   * working: a small loss traded for a total one is a bad trade.
   */
  it('degrades silently when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useSavedDraft<Draft>('k', isEmpty));

    expect(() => act(() => result.current.save({ text: 'written' }))).not.toThrow();
  });

  it('degrades silently when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const { result } = renderHook(() => useSavedDraft<Draft>('k', isEmpty));

    expect(result.current.restored).toBeNull();
  });

  it('ignores a draft that is not valid JSON', () => {
    window.localStorage.setItem('k', 'not json');

    const { result } = renderHook(() => useSavedDraft<Draft>('k', isEmpty));

    expect(result.current.restored).toBeNull();
  });

  /* An older shape would otherwise be read into fields that no longer exist. */
  it('ignores a draft written by an older version', () => {
    window.localStorage.setItem(
      'k',
      JSON.stringify({ version: 0, savedAt: Date.now(), value: { text: 'old' } }),
    );

    const { result } = renderHook(() => useSavedDraft<Draft>('k', isEmpty));

    expect(result.current.restored).toBeNull();
  });

  /* An event is a date, and a months-old draft names one that has passed. */
  it('ignores a draft that has gone stale', () => {
    const longAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(
      'k',
      JSON.stringify({ version: 1, savedAt: longAgo, value: { text: 'stale' } }),
    );

    const { result } = renderHook(() => useSavedDraft<Draft>('k', isEmpty));

    expect(result.current.restored).toBeNull();
  });
});
