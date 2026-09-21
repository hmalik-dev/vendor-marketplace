import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { bookingContextFor } from '../payments/payments.service.js';
import type { NeonAuthIdentity } from '@vendor-marketplace/db';
import type { AuthIdentitySource, MirroredIdentity } from './identity.js';
import { applyAuthSyncEvent } from './auth-sync.service.js';

/*
 * VEN-386. An update whose address a live row still holds means that row is the
 * stale one — Neon Auth allows one identity per address — so the handler asks
 * it about the holder before settling for `diverged`.
 */

const CLAIMANT = 'user_bea';
const HOLDER = 'user_ada';
const CONTESTED = 'x@example.com';
const NOW = new Date('2026-09-15T12:00:00Z');

function neonIdentity(id: string, email: string): NeonAuthIdentity {
  return { id, email, name: '', image: null };
}

/** Neon Auth knowing exactly these identities; any other id reads as deleted. */
function directoryHolding(...people: NeonAuthIdentity[]) {
  return {
    lookup: vi.fn<AuthIdentitySource['lookup']>(async (ids) =>
      people.filter((person) => ids.includes(person.id)),
    ),
  };
}

function claimAddress() {
  return {
    type: 'updated' as const,
    identity: {
      authUserId: CLAIMANT,
      email: CONTESTED,
      firstName: null,
      lastName: null,
      avatarUrl: null,
    } satisfies MirroredIdentity,
  };
}

describe('applyAuthSyncEvent, when an update meets a stale holder', () => {
  let harness: TestHarness;
  const errors: unknown[][] = [];

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    errors.length = 0;
    await harness.database.db.delete(users);
    await harness.database.db.insert(users).values([
      { authUserId: HOLDER, email: CONTESTED, role: 'customer', firstName: 'Ada', lastName: 'R' },
      {
        authUserId: CLAIMANT,
        email: 'z@example.com',
        role: 'customer',
        firstName: 'Bea',
        lastName: 'S',
      },
    ]);
  });

  function context() {
    const base = bookingContextFor(harness.app, harness.app.log, 'http://localhost:3000');
    const log = Object.create(base.log) as typeof base.log;
    log.error = ((...args: unknown[]) => {
      errors.push(args);
    }) as typeof log.error;

    return { ...base, log };
  }

  async function rowFor(authUserId: string) {
    const [row] = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUserId));

    return row;
  }

  it('retires a holder Neon Auth no longer has, and lands the address', async () => {
    const directory = directoryHolding(neonIdentity(CLAIMANT, CONTESTED));

    const outcome = await applyAuthSyncEvent(context(), claimAddress(), NOW, directory);

    expect(outcome).toBe('updated');
    expect((await rowFor(HOLDER))?.deletedAt).toBeInstanceOf(Date);

    const claimant = await rowFor(CLAIMANT);

    expect(claimant?.email).toBe(CONTESTED);
    expect(claimant?.pendingEmail).toBeNull();
    expect(claimant?.emailSyncFailedAt).toBeNull();
  });

  it.each([
    ['javascript:x', null],
    [`https://cdn.example.com/${'a'.repeat(2000)}`, null],
    ['https://cdn.example.com/bea.png', 'https://cdn.example.com/bea.png'],
  ])('mirrors the provider avatar %j as %j (VEN-538)', async (avatarUrl, stored) => {
    const event = claimAddress();
    const outcome = await applyAuthSyncEvent(
      context(),
      { ...event, identity: { ...event.identity, email: 'bea@example.com', avatarUrl } },
      NOW,
      directoryHolding(),
    );

    expect(outcome).toBe('updated');
    expect((await rowFor(CLAIMANT))?.avatarUrl).toBe(stored);
  });

  it('mirrors a holder Neon Auth has moved, and lands the address', async () => {
    const directory = directoryHolding(
      neonIdentity(CLAIMANT, CONTESTED),
      neonIdentity(HOLDER, 'w@example.com'),
    );

    const outcome = await applyAuthSyncEvent(context(), claimAddress(), NOW, directory);

    expect(outcome).toBe('updated');
    expect((await rowFor(HOLDER))?.email).toBe('w@example.com');
    expect((await rowFor(HOLDER))?.deletedAt).toBeNull();
    expect((await rowFor(CLAIMANT))?.email).toBe(CONTESTED);
    expect((await rowFor(CLAIMANT))?.pendingEmail).toBeNull();
  });

  it('stays diverged, answering normally, when Neon Auth cannot be reached', async () => {
    const failure = new Error('Neon Auth unavailable');
    const directory = {
      lookup: vi.fn<AuthIdentitySource['lookup']>().mockRejectedValue(failure),
    };

    const outcome = await applyAuthSyncEvent(context(), claimAddress(), NOW, directory);

    expect(outcome).toBe('diverged');
    expect((await rowFor(CLAIMANT))?.email).toBe('z@example.com');
    expect((await rowFor(CLAIMANT))?.pendingEmail).toBe(CONTESTED);
    expect((await rowFor(HOLDER))?.email).toBe(CONTESTED);
    expect(errors.some(([fields]) => (fields as { err?: unknown }).err === failure)).toBe(true);
  });

  it('follows one hop only when the holder’s corrected address is itself held', async () => {
    await harness.database.db.insert(users).values({
      authUserId: 'user_cy',
      email: 'w@example.com',
      role: 'customer',
      firstName: 'Cy',
      lastName: 'T',
    });
    const directory = directoryHolding(
      neonIdentity(CLAIMANT, CONTESTED),
      neonIdentity(HOLDER, 'w@example.com'),
    );

    const outcome = await applyAuthSyncEvent(context(), claimAddress(), NOW, directory);

    expect(outcome).toBe('diverged');
    expect(directory.lookup.mock.calls.length).toBeLessThanOrEqual(2);
    expect((await rowFor(HOLDER))?.email).toBe(CONTESTED);
    expect((await rowFor(HOLDER))?.pendingEmail).toBe('w@example.com');
    expect((await rowFor(CLAIMANT))?.pendingEmail).toBe(CONTESTED);
    expect((await rowFor('user_cy'))?.email).toBe('w@example.com');
  });

  /*
   * Neon Auth not knowing the claimant being synced means the source is another
   * branch's; every holder would read as deleted.
   */
  it('retires nobody when Neon Auth does not know the claimant either', async () => {
    const directory = directoryHolding();

    const outcome = await applyAuthSyncEvent(context(), claimAddress(), NOW, directory);

    expect(outcome).toBe('diverged');
    expect((await rowFor(HOLDER))?.deletedAt).toBeNull();
    expect((await rowFor(CLAIMANT))?.pendingEmail).toBe(CONTESTED);
    expect(errors).toHaveLength(2);
  });

  it('stays diverged when Neon Auth says the holder still owns the address', async () => {
    const directory = directoryHolding(
      neonIdentity(CLAIMANT, CONTESTED),
      neonIdentity(HOLDER, CONTESTED),
    );

    const outcome = await applyAuthSyncEvent(context(), claimAddress(), NOW, directory);

    expect(outcome).toBe('diverged');
    expect((await rowFor(HOLDER))?.deletedAt).toBeNull();
    expect((await rowFor(CLAIMANT))?.pendingEmail).toBe(CONTESTED);
  });

  /* The recorded provider decides, not the id: a Neon-issued id shaped like an auth one is released. */
  it('still retires a Neon-issued holder whose id looks like an auth one', async () => {
    const lookalike = 'user_2abcdefghijklmnopqrstuvwxyz';
    await harness.database.db
      .update(users)
      .set({ authUserId: lookalike })
      .where(eq(users.authUserId, HOLDER));
    const directory = directoryHolding(neonIdentity(CLAIMANT, CONTESTED));

    const outcome = await applyAuthSyncEvent(context(), claimAddress(), NOW, directory);

    expect(outcome).toBe('updated');
    expect((await rowFor(lookalike))?.deletedAt).toBeInstanceOf(Date);
  });

  it('never asks Neon Auth about, or retires, a seeded holder it never issued', async () => {
    await harness.database.db
      .update(users)
      .set({ authUserId: 'seed_mkt_ada', authProvider: 'seed' })
      .where(eq(users.authUserId, HOLDER));
    const directory = directoryHolding();

    const outcome = await applyAuthSyncEvent(context(), claimAddress(), NOW, directory);

    expect(outcome).toBe('diverged');
    expect(directory.lookup).not.toHaveBeenCalled();
    expect((await rowFor('seed_mkt_ada'))?.deletedAt).toBeNull();
  });
});
