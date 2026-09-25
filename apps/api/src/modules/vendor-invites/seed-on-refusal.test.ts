import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDatabase } from '../../lib/database.js';
import { seedApplicationOnRefusal, vendorNotInvited } from './vendor-invites.service.js';

const dao = vi.hoisted(() => ({
  hasLiveAccount: vi.fn(),
  seedApplication: vi.fn(),
}));

vi.mock('./vendor-invites.dao.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...dao,
}));

const EMAIL = 'refused.vendor@example.com';
const db = {} as AppDatabase;

describe('seedApplicationOnRefusal', () => {
  beforeEach(() => {
    dao.hasLiveAccount.mockReset().mockResolvedValue(false);
    dao.seedApplication.mockReset();
  });

  it('logs once, without the address, when the waitlist write fails, and still rethrows the refusal', async () => {
    const failure = new Error('connection terminated');
    dao.seedApplication.mockRejectedValue(failure);
    const log = { error: vi.fn() };
    const refusal = vendorNotInvited();

    await expect(seedApplicationOnRefusal(db, refusal, EMAIL, log)).rejects.toBe(refusal);

    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith({ err: failure }, 'waitlist seed failed');
    const [payload] = log.error.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(payload)).toEqual(['err']);
    expect(Object.values(payload)).not.toContain(EMAIL);
  });

  it('does not log when the write succeeds', async () => {
    dao.seedApplication.mockResolvedValue(undefined);
    const log = { error: vi.fn() };

    await expect(seedApplicationOnRefusal(db, vendorNotInvited(), EMAIL, log)).rejects.toThrow();

    expect(dao.seedApplication).toHaveBeenCalledTimes(1);
    expect(log.error).not.toHaveBeenCalled();
  });
});
