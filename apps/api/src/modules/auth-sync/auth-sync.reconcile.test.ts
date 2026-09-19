import { eq } from 'drizzle-orm';
import type { NeonAuthIdentity } from '@vendor-marketplace/db';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { bookingContextFor } from '../payments/payments.service.js';
import type { AuthIdentitySource } from './identity.js';
import { IdentitySourceUntrustworthyError, reconcileAuthUsers } from './auth-sync.reconcile.js';

/**
 * A stand-in for the identity store holding whichever identities Neon Auth is
 * meant to know about, so a row missing from it is a deleted identity.
 */
function sourceHolding(...people: NeonAuthIdentity[]) {
  return {
    lookup: vi.fn<AuthIdentitySource['lookup']>(async (ids) =>
      people.filter((person) => ids.includes(person.id)),
    ),
  };
}

function identity(id: string, overrides: Partial<NeonAuthIdentity> = {}): NeonAuthIdentity {
  return {
    id,
    email: 'katherine@example.com',
    name: 'Katherine Johnson',
    image: 'https://img.example.test/katherine.png',
    ...overrides,
  };
}

describe('reconcileAuthUsers', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await harness.database.db.delete(users);
  });

  /*
   * The real context off the harness instance, not a hand-built stand-in
   * (#433): retiring a user refunds its bookings, and the pass has to be given
   * exactly what the live path is given.
   */
  const context = () => bookingContextFor(harness.app, harness.app.log, 'http://localhost:3000');

  async function seed(authUserId: string, overrides: Record<string, unknown> = {}) {
    await harness.database.db.insert(users).values({
      authUserId,
      // Derived, because `users.email` is unique and several tests seed more
      // than one row; the ones that care about the address override it.
      email: `${authUserId}@example.com`,
      firstName: 'Katherine',
      lastName: 'Johnson',
      role: 'customer',
      avatarUrl: 'https://img.example.test/katherine.png',
      ...overrides,
    });
  }

  function read(authUserId: string) {
    return harness.database.db.select().from(users).where(eq(users.authUserId, authUserId));
  }

  it('corrects a name that changed at Neon Auth', async () => {
    await seed('user_a', {
      email: 'katherine@example.com',
      firstName: 'Kathryn',
      lastName: 'Goble',
    });

    const summary = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    expect(summary).toMatchObject({ examined: 1, updated: 1, deleted: 0, unchanged: 0 });

    const [row] = await read('user_a');
    expect(row?.firstName).toBe('Katherine');
    expect(row?.lastName).toBe('Johnson');
  });

  it('corrects a stale email', async () => {
    await seed('user_a', { email: 'old@example.com' });

    await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    const [row] = await read('user_a');
    expect(row?.email).toBe('katherine@example.com');
  });

  it('corrects a changed provider avatar', async () => {
    await seed('user_a', {
      email: 'katherine@example.com',
      avatarUrl: 'https://img.example.test/old.png',
    });

    await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    const [row] = await read('user_a');
    expect(row?.avatarUrl).toBe('https://img.example.test/katherine.png');
  });

  /*
   * VEN-427. An identity with no image says nothing, and a stored object key is
   * the holder's own upload: neither may be overwritten or blanked by a sync.
   */
  it('does not blank an uploaded avatar when the identity has no image', async () => {
    await seed('user_a', { email: 'katherine@example.com', avatarUrl: 'avatars/uploaded.webp' });

    const summary = await reconcileAuthUsers(
      context(),
      sourceHolding(identity('user_a', { image: null })),
    );

    expect(summary).toMatchObject({ updated: 0, unchanged: 1 });
    expect((await read('user_a'))[0]?.avatarUrl).toBe('avatars/uploaded.webp');
  });

  it('does not overwrite an uploaded avatar with the identity’s own picture', async () => {
    await seed('user_a', { email: 'katherine@example.com', avatarUrl: 'avatars/uploaded.webp' });

    const summary = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    expect(summary).toMatchObject({ updated: 0, unchanged: 1 });
    expect((await read('user_a'))[0]?.avatarUrl).toBe('avatars/uploaded.webp');
  });

  it('does not blank a provider avatar when the identity has no image either', async () => {
    await seed('user_a', { email: 'katherine@example.com' });

    await reconcileAuthUsers(context(), sourceHolding(identity('user_a', { image: null })));

    expect((await read('user_a'))[0]?.avatarUrl).toBe('https://img.example.test/katherine.png');
  });

  /*
   * A deleted identity is handled by the very path a closure's retirement takes
   * — a soft delete that keeps the row for the bookings and reviews
   * referencing it.
   */
  it('retires a row whose identity no longer exists', async () => {
    await seed('user_gone');
    await seed('user_a', { email: 'katherine@example.com' });

    const summary = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    expect(summary).toMatchObject({ examined: 2, deleted: 1, updated: 0, unchanged: 1 });

    const [row] = await read('user_gone');
    expect(row).toBeDefined();
    expect(row?.deletedAt).not.toBeNull();
    expect((await read('user_a'))[0]?.deletedAt).toBeNull();
  });

  /*
   * Rows are created by the Terms acceptance gate, so an identity with no local
   * row is not drift and must not be invented here.
   */
  it('does not create a row for an identity the marketplace has never seen', async () => {
    await seed('user_a');

    await reconcileAuthUsers(
      context(),
      sourceHolding(identity('user_a'), identity('user_stranger')),
    );

    expect(await read('user_stranger')).toEqual([]);
  });

  it('is idempotent — a second run corrects nothing', async () => {
    await seed('user_a', { email: 'katherine@example.com', firstName: 'Kathryn' });
    await seed('user_gone');

    const first = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));
    expect(first).toMatchObject({ examined: 2, updated: 1, deleted: 1, unchanged: 0 });

    const [before] = await read('user_a');

    const second = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    // The deleted row is gone from the live set, so only the corrected one remains.
    expect(second).toMatchObject({ examined: 1, updated: 0, deleted: 0, unchanged: 1 });

    const [after] = await read('user_a');
    // Not merely "no visible drift": the second run must not have written at all.
    expect(after?.updatedAt).toEqual(before?.updatedAt);
  });

  /*
   * A field an identity leaves empty is omitted from the patch, so treating it
   * as drift would report a correction that never lands — and report it again
   * on every subsequent run.
   */
  it('treats a name Neon Auth does not have as no opinion, not as drift', async () => {
    await seed('user_a', {
      email: 'katherine@example.com',
      firstName: 'Katherine',
      lastName: 'Johnson',
    });

    const summary = await reconcileAuthUsers(
      context(),
      sourceHolding(identity('user_a', { name: '' })),
    );

    expect(summary).toMatchObject({ updated: 0, unchanged: 1 });
    expect((await read('user_a'))[0]?.firstName).toBe('Katherine');
  });

  /*
   * #398. The write strips bidi controls, so the drift check must compare the
   * stripped name — or a name carrying one is "corrected" on every run, for ever.
   */
  it('strips a bidi control from a name, and is idempotent about it', async () => {
    await seed('user_a', { email: 'katherine@example.com', firstName: 'Kat', lastName: 'Johnson' });
    const source = () => sourceHolding(identity('user_a', { name: 'Kat\u202Eherine Johnson' }));

    const first = await reconcileAuthUsers(context(), source());
    expect(first).toMatchObject({ updated: 1 });
    expect((await read('user_a'))[0]?.firstName).toBe('Katherine');

    const second = await reconcileAuthUsers(context(), source());
    expect(second).toMatchObject({ updated: 0, unchanged: 1 });
  });

  it('retires the lone account when it is the only one and its identity is gone', async () => {
    await seed('user_only');

    const summary = await reconcileAuthUsers(context(), sourceHolding());

    expect(summary).toMatchObject({ examined: 1, deleted: 1 });
    expect((await read('user_only'))[0]?.deletedAt).not.toBeNull();
  });

  it('splits Better Auth’s single name into first and last', async () => {
    await seed('user_a', { email: 'katherine@example.com', firstName: 'K', lastName: 'J' });

    await reconcileAuthUsers(
      context(),
      sourceHolding(identity('user_a', { name: 'Mary Jackson Smith' })),
    );

    const [row] = await read('user_a');
    expect(row?.firstName).toBe('Mary');
    expect(row?.lastName).toBe('Jackson Smith');
  });

  /* VEN-431: a divergence record must not outlive the disagreement it describes. */
  it('clears a stale pending_email once the identity’s address settles', async () => {
    await seed('user_a', {
      email: 'katherine@example.com',
      pendingEmail: 'contested@example.com',
      emailSyncFailedAt: new Date('2026-09-01T00:00:00Z'),
    });

    const summary = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    expect(summary).toMatchObject({ updated: 1, unchanged: 0 });

    const [row] = await read('user_a');
    expect(row?.email).toBe('katherine@example.com');
    expect(row?.pendingEmail).toBeNull();
    expect(row?.emailSyncFailedAt).toBeNull();

    const again = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));
    expect(again).toMatchObject({ updated: 0, unchanged: 1 });
  });

  it('never rewrites the local role', async () => {
    await seed('user_a', { email: 'katherine@example.com', role: 'vendor', firstName: 'Kathryn' });

    await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    expect((await read('user_a'))[0]?.role).toBe('vendor');
  });

  it('ignores a row already retired, rather than deleting it twice', async () => {
    await seed('user_gone', { deletedAt: new Date() });

    const summary = await reconcileAuthUsers(context(), sourceHolding());

    expect(summary).toMatchObject({ examined: 0, deleted: 0 });
  });

  /*
   * Caught by the first production dry run of the pass this replaces: 50 of 54
   * rows would have been retired, because the seeded marketplace uses
   * `seed_mkt_…` ids no provider has issued. Reading that as "deleted" would
   * take the entire public marketplace down on the first real run.
   */
  it('leaves seeded accounts no identity was issued for alone', async () => {
    await seed('seed_mkt_vendor_june-harlow', { authProvider: 'seed' });
    await seed('seed_mkt_customer_0', { authProvider: 'seed' });

    const source = sourceHolding();
    const summary = await reconcileAuthUsers(context(), source);

    expect(summary).toMatchObject({ examined: 0, deleted: 0, skipped: 2 });
    expect(source.lookup).not.toHaveBeenCalled();
    expect((await read('seed_mkt_vendor_june-harlow'))[0]?.deletedAt).toBeNull();
  });

  /*
   * A Clerk-era row has no Neon Auth identity by construction. Reading that as a
   * deletion would retire the account and refund its bookings.
   */
  it('leaves rows the previous provider issued alone', async () => {
    await seed('user_2abcdefghijklmnopqrstuvwxyz', { authProvider: 'legacy_clerk' });
    await seed('user_a', { email: 'katherine@example.com' });

    const summary = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    expect(summary).toMatchObject({ examined: 1, deleted: 0, skipped: 1 });
    expect((await read('user_2abcdefghijklmnopqrstuvwxyz'))[0]?.deletedAt).toBeNull();
  });

  /*
   * VEN-450: the provider is recorded, not read off the id. A Neon Auth id that
   * happens to look like a Clerk one is a live Neon account, and its deletion at
   * Neon Auth must still retire it.
   */
  it('retires a Neon-issued row whose id merely looks like a Clerk one', async () => {
    const lookalike = 'user_2abcdefghijklmnopqrstuvwxyz';
    await seed(lookalike);
    await seed('user_a', { email: 'katherine@example.com' });

    const summary = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    expect(summary).toMatchObject({ examined: 2, deleted: 1, skipped: 0 });
    expect((await read(lookalike))[0]?.deletedAt).not.toBeNull();
  });

  it('still reconciles real rows alongside seeded ones', async () => {
    await seed('seed_mkt_customer_0', { authProvider: 'seed' });
    await seed('user_a', { email: 'katherine@example.com', firstName: 'Kathryn' });

    const summary = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')));

    expect(summary).toMatchObject({ examined: 1, updated: 1, skipped: 1 });
  });

  it('asks in batches rather than once per row', async () => {
    for (let index = 0; index < 5; index += 1) {
      await seed(`user_${index}`);
    }
    const source = sourceHolding(identity('user_0'));

    await reconcileAuthUsers(context(), source);

    expect(source.lookup).toHaveBeenCalledTimes(1);
    expect(source.lookup.mock.calls[0]?.[0]).toHaveLength(5);
  });

  it('reports what would change without writing, under --dry-run', async () => {
    await seed('user_a', { email: 'katherine@example.com', firstName: 'Kathryn' });
    await seed('user_gone');

    const summary = await reconcileAuthUsers(context(), sourceHolding(identity('user_a')), {
      dryRun: true,
    });

    expect(summary).toMatchObject({ examined: 2, updated: 1, deleted: 1 });
    expect((await read('user_a'))[0]?.firstName).toBe('Kathryn');
    expect((await read('user_gone'))[0]?.deletedAt).toBeNull();
  });

  it('does nothing, and asks nothing, when there are no local rows', async () => {
    const source = sourceHolding();

    const summary = await reconcileAuthUsers(context(), source);

    expect(summary).toEqual({
      examined: 0,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      diverged: 0,
      skipped: 0,
    });
    expect(source.lookup).not.toHaveBeenCalled();
  });

  /*
   * VEN-431. "The source answered nothing" is not "every user was deleted": a
   * source pointed at the wrong branch, or one that has lost its rows, answers
   * exactly this way, and retiring on it refunds real bookings.
   */
  describe('when the identity source cannot be trusted', () => {
    async function seedPeople() {
      await seed('user_a', { email: 'a@example.com', firstName: 'Kathryn' });
      await seed('user_b', { email: 'b@example.com' });
    }

    async function untouched() {
      const rows = await harness.database.db.select().from(users);

      expect(rows.map((row) => row.deletedAt)).toEqual([null, null]);
      expect(rows.map((row) => row.firstName).sort()).toEqual(['Katherine', 'Kathryn']);
      expect(rows.map((row) => row.avatarUrl)).toEqual([
        'https://img.example.test/katherine.png',
        'https://img.example.test/katherine.png',
      ]);
    }

    it('aborts without retiring anyone when it answers empty', async () => {
      await seedPeople();

      await expect(reconcileAuthUsers(context(), sourceHolding())).rejects.toBeInstanceOf(
        IdentitySourceUntrustworthyError,
      );

      await untouched();
      expect(harness.stripe.refunds).toHaveLength(0);
    });

    it('aborts without writing anything when it errors', async () => {
      await seedPeople();
      const failure = new Error('connection terminated');

      await expect(
        reconcileAuthUsers(context(), { lookup: vi.fn().mockRejectedValue(failure) }),
      ).rejects.toBe(failure);

      await untouched();
    });

    it('aborts before the first write when a later batch errors', async () => {
      for (let index = 0; index < 101; index += 1) {
        await seed(`user_${String(index).padStart(3, '0')}`, { firstName: 'Kathryn' });
      }
      const failure = new Error('connection terminated');
      const lookup = vi
        .fn<AuthIdentitySource['lookup']>()
        .mockImplementationOnce(async (ids) =>
          ids.map((id) => identity(id, { email: `${id}@example.com` })),
        )
        .mockRejectedValueOnce(failure);

      await expect(reconcileAuthUsers(context(), { lookup })).rejects.toBe(failure);

      const rows = await harness.database.db.select().from(users);
      expect(rows.filter((row) => row.firstName === 'Kathryn')).toHaveLength(101);
    });
  });
});
