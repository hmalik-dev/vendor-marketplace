import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimManifest,
  type LaneManifest,
  readManifest,
  readManifests,
  removeManifest,
  updateManifest,
  withLock,
} from './manifest.js';

let root: string;

const sample = (ticket: string): LaneManifest => ({
  ticket,
  branch: `lane/${ticket}`,
  worktreePath: `/repo/.claude/worktrees/${ticket}`,
  apiPort: 4007,
  webPort: 3007,
  database: `vendor_marketplace_lane_${ticket}`,
  prUrl: null,
  state: 'active',
  createdAt: '2026-08-28T00:00:00.000Z',
});

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'lanes-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('lane manifest', () => {
  it('round-trips every field', () => {
    claimManifest(root, sample('42'));
    expect(readManifest(root, '42')).toEqual(sample('42'));
  });

  it('refuses to claim a ticket that already has a manifest', () => {
    expect(claimManifest(root, sample('42'))).toBe(true);
    expect(claimManifest(root, { ...sample('42'), apiPort: 4099 })).toBe(false);
    expect(readManifest(root, '42')?.apiPort).toBe(4007);
  });

  it('returns null for a ticket with no manifest', () => {
    expect(readManifest(root, 'nope')).toBeNull();
  });

  it('lists every claimed lane', () => {
    claimManifest(root, sample('1'));
    claimManifest(root, sample('2'));
    expect(
      readManifests(root)
        .map((lane) => lane.ticket)
        .sort(),
    ).toEqual(['1', '2']);
  });

  it('patches a field without disturbing the rest', () => {
    claimManifest(root, sample('42'));

    const updated = updateManifest(root, '42', {
      prUrl: 'https://github.com/o/r/pull/9',
      state: 'pending-merge',
    });

    expect(updated.prUrl).toBe('https://github.com/o/r/pull/9');
    expect(updated.state).toBe('pending-merge');
    expect(updated.apiPort).toBe(4007);
  });

  it('removes a manifest and tolerates removing it twice', () => {
    claimManifest(root, sample('42'));
    removeManifest(root, '42');
    removeManifest(root, '42');
    expect(readManifest(root, '42')).toBeNull();
  });

  /*
   * #64/#316. This used to hold the lock open with a real 30ms `setTimeout`
   * and let the second holder poll `withLock`'s own real `LOCK_RETRY_MS`
   * timer — a real-clock assumption in a suite that otherwise makes none.
   * `mkdirSync` is synchronous, so which caller wins is decided the instant
   * both are invoked and never depends on either timer actually firing on
   * schedule; the ordering below is the only reachable one. But nothing said
   * so, and the CPU contention a parallel Turbo run adds was free to stretch
   * either real delay by an order of magnitude — the 17x slowdown recorded
   * against #64 (36s inside the fan-out vs 2.15s isolated) is exactly that
   * kind of stretch, not a stable failure. Fake timers make both delays
   * instantaneous, so the assertion holds however slow or fast the host is.
   */
  it('serialises concurrent lock holders', async () => {
    vi.useFakeTimers();

    try {
      const order: string[] = [];
      let releaseA = (): void => {};
      const aHeld = new Promise<void>((resolve) => {
        releaseA = resolve;
      });

      const first = withLock(root, async () => {
        order.push('a-in');
        await aHeld;
        order.push('a-out');
      });

      // `mkdirSync` inside `withLock` is synchronous, so `first` has already
      // claimed the lock by the time this line runs — `second` is provably
      // the one that has to wait, not merely likely to.
      const second = withLock(root, async () => {
        order.push('b-in');
        order.push('b-out');
      });

      releaseA();
      // Exhausts b's real `LOCK_RETRY_MS` polling without waiting on it.
      await vi.runAllTimersAsync();
      await Promise.all([first, second]);

      expect(order).toEqual(['a-in', 'a-out', 'b-in', 'b-out']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases the lock when the body throws', async () => {
    await expect(withLock(root, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(withLock(root, async () => 'ok')).resolves.toBe('ok');
  });
});
