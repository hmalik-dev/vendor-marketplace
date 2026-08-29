import { describe, expect, it } from 'vitest';
import {
  allocateOffset,
  API_BASE,
  firstOffset,
  MAX_OFFSET,
  stableHash,
  WEB_BASE,
} from './ports.js';

const allFree = async (): Promise<boolean> => true;

describe('stableHash', () => {
  it('is deterministic across calls', () => {
    expect(stableHash('42')).toBe(stableHash('42'));
  });

  it('separates different tickets', () => {
    expect(stableHash('42')).not.toBe(stableHash('43'));
  });
});

describe('firstOffset', () => {
  it('always lands inside the usable range', () => {
    for (const ticket of ['1', '42', 'ORL-1234', 'a-very-long-ticket-identifier']) {
      const offset = firstOffset(ticket);
      expect(offset).toBeGreaterThanOrEqual(1);
      expect(offset).toBeLessThanOrEqual(MAX_OFFSET);
    }
  });
});

describe('allocateOffset', () => {
  it('returns the deterministic first guess when both ports are free', async () => {
    expect(await allocateOffset('42', new Set(), allFree)).toBe(firstOffset('42'));
  });

  it('skips an offset already claimed by another lane', async () => {
    const first = firstOffset('42');
    expect(await allocateOffset('42', new Set([first]), allFree)).not.toBe(first);
  });

  it('skips an offset whose web port has a live listener', async () => {
    const first = firstOffset('42');
    const probe = async (port: number): Promise<boolean> => port !== WEB_BASE + first;
    expect(await allocateOffset('42', new Set(), probe)).not.toBe(first);
  });

  it('skips an offset whose api port has a live listener', async () => {
    const first = firstOffset('42');
    const probe = async (port: number): Promise<boolean> => port !== API_BASE + first;
    expect(await allocateOffset('42', new Set(), probe)).not.toBe(first);
  });

  it('throws rather than silently reusing a port when the range is exhausted', async () => {
    const claimed = new Set(Array.from({ length: MAX_OFFSET }, (_, index) => index + 1));
    await expect(allocateOffset('42', claimed, allFree)).rejects.toThrow(/exhausted/i);
  });

  it('gives two different tickets two different offsets under contention', async () => {
    const first = await allocateOffset('42', new Set(), allFree);
    const second = await allocateOffset('43', new Set([first]), allFree);
    expect(first).not.toBe(second);
  });
});
