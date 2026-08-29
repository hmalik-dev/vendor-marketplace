import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

  it('serialises concurrent lock holders', async () => {
    const order: string[] = [];

    await Promise.all([
      withLock(root, async () => {
        order.push('a-in');
        await new Promise((resolve) => setTimeout(resolve, 30));
        order.push('a-out');
      }),
      withLock(root, async () => {
        order.push('b-in');
        order.push('b-out');
      }),
    ]);

    expect(order.join(',')).toMatch(/^(a-in,a-out,b-in,b-out|b-in,b-out,a-in,a-out)$/);
  });

  it('releases the lock when the body throws', async () => {
    await expect(withLock(root, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(withLock(root, async () => 'ok')).resolves.toBe('ok');
  });
});
