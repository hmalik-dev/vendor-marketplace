import { describe, expect, it } from 'vitest';
import {
  isLockTimeout,
  MIGRATION_SESSION_SETTINGS,
  retryOnLockTimeout,
} from './migration-session.js';

const lockTimeout = (): Error =>
  new Error('Failed query: alter table "bookings" ...', {
    cause: Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' }),
  });

describe('the migration session', () => {
  it('waits five seconds for a lock and sixty for a statement', () => {
    expect(MIGRATION_SESSION_SETTINGS).toEqual({ lock_timeout: '5s', statement_timeout: '60s' });
  });

  it('recognises a lock timeout under the error Drizzle wraps it in, and nothing else', () => {
    expect(isLockTimeout(lockTimeout())).toBe(true);
    expect(isLockTimeout(Object.assign(new Error('timeout'), { code: '57014' }))).toBe(false);
    expect(isLockTimeout(new Error('syntax error'))).toBe(false);
    expect(isLockTimeout('55P03')).toBe(false);
  });
});

describe('retryOnLockTimeout', () => {
  it('tries again after a lock timeout, backing off, and returns the run that got through', async () => {
    const waits: number[] = [];
    let calls = 0;

    const result = await retryOnLockTimeout(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw lockTimeout();
        }
        return 'applied';
      },
      { baseDelayMs: 100, wait: async (ms) => void waits.push(ms) },
    );

    expect(result).toBe('applied');
    expect(calls).toBe(3);
    expect(waits).toEqual([100, 200]);
  });

  it('gives up after the bounded number of tries with the lock timeout itself', async () => {
    let calls = 0;
    const failing = retryOnLockTimeout(
      async () => {
        calls += 1;
        throw lockTimeout();
      },
      { attempts: 4, wait: async () => undefined },
    );

    await expect(failing).rejects.toThrow('Failed query: alter table "bookings"');
    expect(calls).toBe(4);
  });

  it('throws any other failure at once', async () => {
    let calls = 0;
    const failing = retryOnLockTimeout(
      async () => {
        calls += 1;
        throw new Error('column "x" does not exist');
      },
      { wait: async () => undefined },
    );

    await expect(failing).rejects.toThrow('column "x" does not exist');
    expect(calls).toBe(1);
  });
});
