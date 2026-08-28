import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { reconcileClerkUsers, type ClerkApiUser } from './clerk.reconcile.js';

/**
 * A stand-in for the Clerk SDK holding whichever users Clerk is meant to know
 * about, so a row missing from it is a Clerk-deleted identity.
 */
function clerkHolding(...people: ClerkApiUser[]) {
  return {
    getUserList: vi.fn(async ({ userId }: { userId: string[]; limit: number }) => ({
      data: people.filter((person) => userId.includes(person.id)),
    })),
  };
}

function clerkUser(id: string, overrides: Partial<ClerkApiUser> = {}): ClerkApiUser {
  return {
    id,
    emailAddresses: [{ id: 'idn_primary', emailAddress: 'katherine@example.com' }],
    primaryEmailAddressId: 'idn_primary',
    firstName: 'Katherine',
    lastName: 'Johnson',
    imageUrl: 'https://img.clerk.com/katherine.png',
    ...overrides,
  };
}

describe('reconcileClerkUsers', () => {
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

  async function seed(clerkUserId: string, overrides: Record<string, unknown> = {}) {
    await harness.database.db.insert(users).values({
      clerkUserId,
      // Derived, because `users.email` is unique and several tests seed more
      // than one row; the ones that care about the address override it.
      email: `${clerkUserId}@example.com`,
      firstName: 'Katherine',
      lastName: 'Johnson',
      role: 'customer',
      avatarUrl: 'https://img.clerk.com/katherine.png',
      ...overrides,
    });
  }

  function read(clerkUserId: string) {
    return harness.database.db.select().from(users).where(eq(users.clerkUserId, clerkUserId));
  }

  /* The drift the misrouted webhook left: a name changed in Clerk, never here. */
  it('corrects a name that changed in Clerk while the webhook was misrouted', async () => {
    await seed('user_a', {
      email: 'katherine@example.com',
      firstName: 'Kathryn',
      lastName: 'Goble',
    });

    const summary = await reconcileClerkUsers(
      harness.database.db,
      clerkHolding(clerkUser('user_a')),
    );

    expect(summary).toMatchObject({ examined: 1, updated: 1, deleted: 0, unchanged: 0 });

    const [row] = await read('user_a');
    expect(row?.firstName).toBe('Katherine');
    expect(row?.lastName).toBe('Johnson');
  });

  it('corrects a stale email, preferring the address Clerk marks primary', async () => {
    await seed('user_a', { email: 'old@example.com' });

    await reconcileClerkUsers(
      harness.database.db,
      clerkHolding(
        clerkUser('user_a', {
          emailAddresses: [
            { id: 'idn_other', emailAddress: 'other@example.com' },
            { id: 'idn_primary', emailAddress: 'katherine@example.com' },
          ],
          primaryEmailAddressId: 'idn_primary',
        }),
      ),
    );

    const [row] = await read('user_a');
    expect(row?.email).toBe('katherine@example.com');
  });

  it('corrects a changed avatar', async () => {
    await seed('user_a', {
      email: 'katherine@example.com',
      avatarUrl: 'https://img.clerk.com/old.png',
    });

    await reconcileClerkUsers(harness.database.db, clerkHolding(clerkUser('user_a')));

    const [row] = await read('user_a');
    expect(row?.avatarUrl).toBe('https://img.clerk.com/katherine.png');
  });

  /*
   * Acceptance: a user deleted in Clerk is handled identically to a live
   * `user.deleted`, because it goes through that exact handler — a soft delete
   * that keeps the row for the bookings and reviews referencing it.
   */
  it('retires a row whose Clerk identity no longer exists', async () => {
    await seed('user_gone');

    const summary = await reconcileClerkUsers(harness.database.db, clerkHolding());

    expect(summary).toMatchObject({ examined: 1, deleted: 1, updated: 0 });

    const [row] = await read('user_gone');
    expect(row).toBeDefined();
    expect(row?.deletedAt).not.toBeNull();
  });

  /*
   * Rows are created lazily on the first authenticated request by design, so
   * a Clerk user with no local row is not drift and must not be invented here.
   */
  it('does not create a row for a Clerk user the marketplace has never seen', async () => {
    await seed('user_a');

    await reconcileClerkUsers(
      harness.database.db,
      clerkHolding(clerkUser('user_a'), clerkUser('user_stranger')),
    );

    const [stranger] = await read('user_stranger');
    expect(stranger).toBeUndefined();
  });

  /* Acceptance: running it twice changes nothing the second time. */
  it('is idempotent — a second run corrects nothing', async () => {
    await seed('user_a', { email: 'katherine@example.com', firstName: 'Kathryn' });
    await seed('user_gone');

    const first = await reconcileClerkUsers(harness.database.db, clerkHolding(clerkUser('user_a')));
    expect(first).toMatchObject({ examined: 2, updated: 1, deleted: 1, unchanged: 0 });

    const [before] = await read('user_a');

    const second = await reconcileClerkUsers(
      harness.database.db,
      clerkHolding(clerkUser('user_a')),
    );

    // The deleted row is gone from the live set, so only the corrected one remains.
    expect(second).toMatchObject({ examined: 1, updated: 0, deleted: 0, unchanged: 1 });

    const [after] = await read('user_a');
    // Not merely "no visible drift": the second run must not have written at all.
    expect(after?.updatedAt).toEqual(before?.updatedAt);
  });

  /*
   * `user.updated` deliberately omits a null name from its patch, so treating
   * null as drift would report a correction that never lands — and report it
   * again on every subsequent run.
   */
  it('treats a name Clerk does not have as no opinion, not as drift', async () => {
    await seed('user_a', {
      email: 'katherine@example.com',
      firstName: 'Katherine',
      lastName: 'Johnson',
    });

    const summary = await reconcileClerkUsers(
      harness.database.db,
      clerkHolding(clerkUser('user_a', { firstName: null, lastName: null })),
    );

    expect(summary).toMatchObject({ updated: 0, unchanged: 1 });

    const [row] = await read('user_a');
    expect(row?.firstName).toBe('Katherine');
  });

  /* Role is chosen once at sign-up and narrowed locally; Clerk cannot move it. */
  it('never rewrites the local role', async () => {
    await seed('user_a', { email: 'katherine@example.com', role: 'vendor', firstName: 'Kathryn' });

    await reconcileClerkUsers(harness.database.db, clerkHolding(clerkUser('user_a')));

    const [row] = await read('user_a');
    expect(row?.role).toBe('vendor');
  });

  it('ignores a row already retired, rather than deleting it twice', async () => {
    await seed('user_gone', { deletedAt: new Date() });

    const summary = await reconcileClerkUsers(harness.database.db, clerkHolding());

    expect(summary).toMatchObject({ examined: 0, deleted: 0 });
  });

  /*
   * Caught by the first production dry run: 50 of 54 rows would have been
   * retired, because the seeded marketplace uses `seed_mkt_…` ids Clerk has
   * never issued. Reading that as "deleted in Clerk" would have taken the
   * entire public marketplace down on the first real run.
   */
  it('leaves seeded accounts Clerk never issued alone', async () => {
    await seed('seed_mkt_vendor_june-harlow');
    await seed('seed_mkt_customer_0');

    const clerk = clerkHolding();
    const summary = await reconcileClerkUsers(harness.database.db, clerk);

    expect(summary).toMatchObject({ examined: 0, deleted: 0, skipped: 2 });
    expect(clerk.getUserList).not.toHaveBeenCalled();

    const [vendor] = await read('seed_mkt_vendor_june-harlow');
    expect(vendor?.deletedAt).toBeNull();
  });

  it('still reconciles real Clerk rows alongside seeded ones', async () => {
    await seed('seed_mkt_customer_0');
    await seed('user_a', { email: 'katherine@example.com', firstName: 'Kathryn' });

    const summary = await reconcileClerkUsers(
      harness.database.db,
      clerkHolding(clerkUser('user_a')),
    );

    expect(summary).toMatchObject({ examined: 1, updated: 1, skipped: 1 });
  });

  /* A bulk pass is where Clerk's rate limit bites, so ids go up in batches. */
  it('asks Clerk in batches rather than once per row', async () => {
    for (let index = 0; index < 5; index += 1) {
      await seed(`user_${index}`);
    }
    const clerk = clerkHolding();

    await reconcileClerkUsers(harness.database.db, clerk);

    expect(clerk.getUserList).toHaveBeenCalledTimes(1);
    expect(clerk.getUserList.mock.calls[0]?.[0].userId).toHaveLength(5);
  });

  /*
   * The first real run is against production rows nobody has looked at in
   * weeks, so the count has to be answerable before it is irreversible.
   */
  it('reports what would change without writing, under --dry-run', async () => {
    await seed('user_a', { email: 'katherine@example.com', firstName: 'Kathryn' });
    await seed('user_gone');

    const summary = await reconcileClerkUsers(
      harness.database.db,
      clerkHolding(clerkUser('user_a')),
      { dryRun: true },
    );

    expect(summary).toMatchObject({ examined: 2, updated: 1, deleted: 1 });

    const [untouched] = await read('user_a');
    expect(untouched?.firstName).toBe('Kathryn');
    const [alive] = await read('user_gone');
    expect(alive?.deletedAt).toBeNull();
  });

  it('does nothing, and asks Clerk nothing, when there are no local rows', async () => {
    const clerk = clerkHolding();

    const summary = await reconcileClerkUsers(harness.database.db, clerk);

    expect(summary).toEqual({ examined: 0, updated: 0, deleted: 0, unchanged: 0, skipped: 0 });
    expect(clerk.getUserList).not.toHaveBeenCalled();
  });

  /* The SDK returns a paged object; a bare array is accepted just as well. */
  it('accepts either shape the Clerk client returns', async () => {
    await seed('user_a', { email: 'katherine@example.com', firstName: 'Kathryn' });

    const summary = await reconcileClerkUsers(harness.database.db, {
      getUserList: async () => [clerkUser('user_a')],
    });

    expect(summary).toMatchObject({ updated: 1 });
  });
});
