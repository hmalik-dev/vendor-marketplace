import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let resolveToken: (value: string | null) => void = () => {};
const getToken = vi.fn(
  () =>
    new Promise<string | null>((settle) => {
      resolveToken = settle;
    }),
);

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken }) }));

const { useImageUpload, UploadTransportError } = await import('./use-api');

/** Records whether anything was actually put on the wire. */
class RecordingXhr {
  static sent: string[] = [];

  status = 200;
  responseText = JSON.stringify({
    imageKey: 'k.webp',
    thumbnailKey: 't.webp',
    imageUrl: 'https://cdn.test/k.webp',
    thumbnailUrl: 'https://cdn.test/t.webp',
  });
  upload = { addEventListener: vi.fn() };

  private listeners = new Map<string, () => void>();

  open(_method: string, url: string): void {
    this.url = url;
  }
  setRequestHeader(): void {}
  addEventListener(name: string, handler: () => void): void {
    this.listeners.set(name, handler);
  }
  removeEventListener(name: string): void {
    this.listeners.delete(name);
  }
  abort(): void {
    this.status = 0;
    this.listeners.get('loadend')?.();
  }
  /** Stays in flight until the test settles it, so abort has something to hit. */
  send(): void {
    RecordingXhr.sent.push(this.url);
    RecordingXhr.inFlight = this;
  }

  complete(): void {
    this.listeners.get('loadend')?.();
  }

  static inFlight: RecordingXhr | null = null;

  private url = '';
}

/**
 * The real cancellation mechanism, tested without mocking it away.
 *
 * `useUploadQueue`'s suites mock this module, and their fake honours the signal
 * when it finishes — which models abort as unconditionally effective. That is
 * exactly the assumption that was false: `AbortSignal` dispatches `abort` once,
 * at `abort()` time, so the listener this hook attaches **after**
 * `await getToken()` never fires for a cancel that landed during the token
 * fetch. The request went out anyway and the cancelled photo reached the
 * gallery. Only a test against the hook itself can see that.
 */
describe('useImageUpload cancellation', () => {
  const OriginalXhr = globalThis.XMLHttpRequest;

  beforeEach(() => {
    RecordingXhr.sent = [];
    RecordingXhr.inFlight = null;
    getToken.mockClear();
    // @ts-expect-error — a stand-in for the browser's XHR, not a full one.
    globalThis.XMLHttpRequest = RecordingXhr;
  });

  afterEach(() => {
    globalThis.XMLHttpRequest = OriginalXhr;
  });

  function file(): File {
    return new File([new Uint8Array(8)], 'a.jpg', { type: 'image/jpeg' });
  }

  it('sends nothing when the signal is already aborted', async () => {
    const { result } = renderHook(() => useImageUpload());
    const controller = new AbortController();
    controller.abort();

    await expect(
      result.current(file(), 'portfolio', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadTransportError);

    expect(RecordingXhr.sent).toHaveLength(0);
    expect(getToken).not.toHaveBeenCalled();
  });

  /*
   * The window the listener cannot cover. `getToken` is a network round trip
   * whenever Clerk refreshes, and an abort during it dispatches before any
   * listener exists — so without the second check the upload proceeds and the
   * vendor's cancelled photo is stored.
   */
  it('sends nothing when the cancel lands while the token is being fetched', async () => {
    const { result } = renderHook(() => useImageUpload());
    const controller = new AbortController();

    const pending = result.current(file(), 'portfolio', { signal: controller.signal });

    // Cancel arrives before the token resolves, so no listener is attached yet.
    controller.abort();
    resolveToken('token-abc');

    await expect(pending).rejects.toBeInstanceOf(UploadTransportError);
    expect(RecordingXhr.sent).toHaveLength(0);
  });

  it('still uploads when no cancel arrives', async () => {
    const { result } = renderHook(() => useImageUpload());

    const pending = result.current(file(), 'portfolio', {});
    resolveToken('token-abc');
    await Promise.resolve();
    RecordingXhr.inFlight?.complete();

    await expect(pending).resolves.toMatchObject({ imageKey: 'k.webp' });
    expect(RecordingXhr.sent).toHaveLength(1);
  });

  /** The window the listener *does* cover: a cancel once the request is away. */
  it('aborts a request that is already in flight', async () => {
    const { result } = renderHook(() => useImageUpload());
    const controller = new AbortController();

    const pending = result.current(file(), 'portfolio', { signal: controller.signal });
    resolveToken('token-abc');
    await Promise.resolve();

    expect(RecordingXhr.sent).toHaveLength(1);
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(UploadTransportError);
  });
});
