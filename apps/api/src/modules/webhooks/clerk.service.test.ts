import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { bookingContextFor } from '../payments/payments.service.js';
import type { ClerkApiUser, ClerkUserSource } from './clerk-user-source.js';
import { applyClerkUserEvent } from './clerk.service.js';

/*
 * VEN-386. A `user.updated` whose address a live row still holds means that
 * row is the stale one — Clerk allows one identity per address — so the
 * handler asks Clerk about the holder before settling for `diverged`.
 */

const CLAIMANT = 'user_bea';
const HOLDER = 'user_ada';
const CONTESTED = 'x@example.com';
const NOW = new Date('2026-09-15T12:00:00Z');

function clerkUser(id: string, email: string): ClerkApiUser {
  return {
    id,
    emailAddresses: [{ id: 'idn_primary', emailAddress: email }],
    primaryEmailAddressId: 'idn_primary',
  };
}

/** Clerk knowing exactly these identities; any other id reads as deleted. */
function clerkHolding(...people: ClerkApiUser[]) {
  return {
    getUserList: vi.fn<ClerkUserSource['getUserList']>(async ({ userId }) => ({
      data: people.filter((person) => userId.includes(person.id)),
    })),
  };
}

function claimAddress() {
  return {
    type: 'user.updated' as const,
    data: {
      id: CLAIMANT,
      email_addresses: [{ id: 'idn_primary', email_address: CONTESTED }],
      primary_email_address_id: 'idn_primary',
    },
  };
}

describe('applyClerkUserEvent, when user.updated meets a stale holder', () => {
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
      { clerkUserId: HOLDER, email: CONTESTED, role: 'customer', firstName: 'Ada', lastName: 'R' },
      {
        clerkUserId: CLAIMANT,
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

  async function rowFor(clerkUserId: string) {
    const [row] = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId));

    return row;
  }

  it('retires a holder Clerk no longer has, and lands the address', async () => {
    const clerk = clerkHolding(clerkUser(CLAIMANT, CONTESTED));

    const outcome = await applyClerkUserEvent(context(), claimAddress(), NOW, clerk);

    expect(outcome).toBe('updated');
    expect((await rowFor(HOLDER))?.deletedAt).toBeInstanceOf(Date);

    const claimant = await rowFor(CLAIMANT);

    expect(claimant?.email).toBe(CONTESTED);
    expect(claimant?.pendingEmail).toBeNull();
    expect(claimant?.emailSyncFailedAt).toBeNull();
  });

  it('mirrors a holder Clerk has moved, and lands the address', async () => {
    const clerk = clerkHolding(clerkUser(HOLDER, 'w@example.com'));

    const outcome = await applyClerkUserEvent(context(), claimAddress(), NOW, clerk);

    expect(outcome).toBe('updated');
    expect((await rowFor(HOLDER))?.email).toBe('w@example.com');
    expect((await rowFor(HOLDER))?.deletedAt).toBeNull();
    expect((await rowFor(CLAIMANT))?.email).toBe(CONTESTED);
    expect((await rowFor(CLAIMANT))?.pendingEmail).toBeNull();
  });

  it('stays diverged, answering normally, when Clerk cannot be reached', async () => {
    const failure = new Error('Clerk API unavailable');
    const clerk = {
      getUserList: vi.fn<ClerkUserSource['getUserList']>().mockRejectedValue(failure),
    };

    const outcome = await applyClerkUserEvent(context(), claimAddress(), NOW, clerk);

    expect(outcome).toBe('diverged');
    expect((await rowFor(CLAIMANT))?.email).toBe('z@example.com');
    expect((await rowFor(CLAIMANT))?.pendingEmail).toBe(CONTESTED);
    expect((await rowFor(HOLDER))?.email).toBe(CONTESTED);
    expect(errors.some(([fields]) => (fields as { err?: unknown }).err === failure)).toBe(true);
  });

  it('follows one hop only when the holder’s corrected address is itself held', async () => {
    await harness.database.db.insert(users).values({
      clerkUserId: 'user_cy',
      email: 'w@example.com',
      role: 'customer',
      firstName: 'Cy',
      lastName: 'T',
    });
    const clerk = clerkHolding(clerkUser(HOLDER, 'w@example.com'));

    const outcome = await applyClerkUserEvent(context(), claimAddress(), NOW, clerk);

    expect(outcome).toBe('diverged');
    expect(clerk.getUserList.mock.calls.length).toBeLessThanOrEqual(2);
    expect((await rowFor(HOLDER))?.email).toBe(CONTESTED);
    expect((await rowFor(HOLDER))?.pendingEmail).toBe('w@example.com');
    expect((await rowFor(CLAIMANT))?.pendingEmail).toBe(CONTESTED);
    expect((await rowFor('user_cy'))?.email).toBe('w@example.com');
  });

  it('stays diverged when Clerk says the holder still owns the address', async () => {
    const clerk = clerkHolding(clerkUser(HOLDER, CONTESTED));

    const outcome = await applyClerkUserEvent(context(), claimAddress(), NOW, clerk);

    expect(outcome).toBe('diverged');
    expect((await rowFor(HOLDER))?.deletedAt).toBeNull();
    expect((await rowFor(CLAIMANT))?.pendingEmail).toBe(CONTESTED);
  });

  it('never asks Clerk about, or retires, a seeded holder Clerk never issued', async () => {
    await harness.database.db
      .update(users)
      .set({ clerkUserId: 'seed_mkt_ada' })
      .where(eq(users.clerkUserId, HOLDER));
    const clerk = clerkHolding();

    const outcome = await applyClerkUserEvent(context(), claimAddress(), NOW, clerk);

    expect(outcome).toBe('diverged');
    expect(clerk.getUserList).not.toHaveBeenCalled();
    expect((await rowFor('seed_mkt_ada'))?.deletedAt).toBeNull();
  });
});
