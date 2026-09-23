import type { NeonAuthDirectory } from '@vendor-marketplace/db';
import { describe, expect, it, vi } from 'vitest';
import { mirroredAuthName, syncAuthDisplayName } from './users.service.js';

describe('mirroredAuthName (VEN-544)', () => {
  it('drops what free text refuses, so the mirror never writes what a response reader rejects', () => {
    expect(mirroredAuthName('  Jo​hn\u0000 ﻿Smith ')).toBe('John Smith');
  });

  it('normalises to NFC and leaves a joiner inside a name alone', () => {
    expect(mirroredAuthName('Renée')).toBe('Renée'.normalize('NFC'));
    expect(mirroredAuthName('Zar‌in')).toBe('Zar‌in');
  });
});

/*
 * VEN-642: without this, the scheduled reconcile reads the sign-up form's
 * unchanged synthetic email-prefix placeholder back off the Neon Auth
 * identity and mirrors it onto `users`, silently reverting a name the
 * customer-details step or the vendor profile editor just wrote.
 */
describe('syncAuthDisplayName (VEN-642)', () => {
  function fakeDirectory(): NeonAuthDirectory & { updateName: ReturnType<typeof vi.fn> } {
    return {
      lookup: vi.fn(async () => []),
      deleteIdentity: vi.fn(async () => false),
      updateName: vi.fn(async () => true),
      close: async () => {},
    };
  }

  it('writes the joined name onto the identity', async () => {
    const directory = fakeDirectory();

    await syncAuthDisplayName(directory, 'auth-1', 'Ada', 'Lovelace');

    expect(directory.updateName).toHaveBeenCalledWith('auth-1', 'Ada Lovelace');
  });

  it('does nothing when this deployment has no Neon Auth database connection', async () => {
    await expect(syncAuthDisplayName(null, 'auth-1', 'Ada', 'Lovelace')).resolves.toBeUndefined();
  });

  it('logs and swallows a failed write rather than undoing the users row it followed', async () => {
    const directory = fakeDirectory();
    directory.updateName.mockRejectedValue(new Error('connection reset'));
    const warn = vi.fn();

    await expect(
      syncAuthDisplayName(directory, 'auth-1', 'Ada', 'Lovelace', { warn }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ authUserId: 'auth-1' }),
      expect.stringContaining('Neon Auth identity'),
    );
  });
});
