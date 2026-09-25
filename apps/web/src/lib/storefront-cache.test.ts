import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readShared, resetStorefrontCache, STOREFRONT_CACHE_TTL_MS } from './storefront-cache';

describe('readShared', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStorefrontCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs one load for concurrent callers of a key', async () => {
    const load = vi.fn(async () => 'answer');

    const results = await Promise.all([readShared('k', load), readShared('k', load)]);

    expect(results).toEqual(['answer', 'answer']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps keys apart', async () => {
    await readShared('a', async () => 1);

    await expect(readShared('b', async () => 2)).resolves.toBe(2);
  });

  it('serves a hit until the window ends, then loads again with no stale copy', async () => {
    const load = vi.fn<() => Promise<string>>().mockResolvedValueOnce('old');
    await readShared('k', load);

    vi.advanceTimersByTime(STOREFRONT_CACHE_TTL_MS - 1);
    await expect(readShared('k', load)).resolves.toBe('old');

    load.mockResolvedValueOnce('new');
    vi.advanceTimersByTime(2);
    await expect(readShared('k', load)).resolves.toBe('new');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('caches a null answer, since a missing storefront is an answer', async () => {
    const load = vi.fn(async () => null);

    await readShared('k', load);
    await readShared('k', load);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('forgets a rejected load, so an outage is never cached', async () => {
    const failure = new Error('down');
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(failure);

    await expect(readShared('k', load)).rejects.toBe(failure);

    load.mockResolvedValueOnce('back');
    await expect(readShared('k', load)).resolves.toBe('back');
  });

  it('holds at most 500 entries, dropping the oldest', async () => {
    const loads = Array.from({ length: 501 }, () => vi.fn(async () => 'v'));
    await Promise.all(loads.map((load, index) => readShared(`k${index}`, load)));

    await readShared('k0', loads[0]!);
    await readShared('k500', loads[500]!);

    expect(loads[0]).toHaveBeenCalledTimes(2);
    expect(loads[500]).toHaveBeenCalledTimes(1);
  });
});
