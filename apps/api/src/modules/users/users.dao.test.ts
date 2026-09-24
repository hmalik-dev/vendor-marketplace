import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import {
  insertUserIfAbsent,
  invalidateSessionsFor,
  retireUserByAuthId,
  updateUserByAuthId,
} from './users.dao.js';

/**
 * One harness for the whole file. Two `createTestHarness()` instances in one
 * suite is real wall-clock on every run, and two copies of `newUser` that must
 * not drift.
 */
let harness: TestHarness;

function newUser(authUserId: string, email: string) {
  return {
    authUserId,
    email,
    role: 'customer' as const,
    firstName: 'Ada',
    lastName: 'Reyes',
  };
}

beforeAll(async () => {
  harness = await createTestHarness();
});

afterEach(async () => {
  await harness.database.db.delete(users);
});

afterAll(async () => {
  await harness.close();
});

/**
 * What `insertUserIfAbsent` does when the insert is declined — the branch #442
 * widened, pinned deterministically.
 *
 * **The race that motivated the change cannot be the only test of it.**
 * `legal-acceptance-race.contention.test.ts` reproduces the defect by firing
 * eight simultaneous first sign-ins, and it caught this at roughly one run in
 * four — which means restoring `{ target: users.authUserId }` leaves that
 * suite green about three runs in four, and the one red run reads as flake.
 * A probabilistic guard is not a guard.
 *
 * The webhook case in `auth-sync.service.test.ts` does not close the gap either: a
 * *different* identity arriving with a taken address answers 500 under both
 * shapes — the old one because the speculative insert raised 23505 during index
 * insertion, the new one because this function throws. It pins the outcome, not
 * the change.
 *
 * So the discriminating assertion is on the **message**, here, against the unit
 * itself. Under a targeted `DO NOTHING` the failure is a `DrizzleQueryError`
 * reading `Failed query: insert into "users" …`; under the untargeted one it is
 * the sentence below. One of those two matches and the other does not, on every
 * run, with no concurrency involved.
 */
describe('invalidateSessionsFor (VEN-628)', () => {
  it('sets the invalidation timestamp on the named user, and no other row', async () => {
    const db = harness.database.db;
    await db.insert(users).values(newUser('auth-invalidate-1', 'a1@example.com'));
    await db.insert(users).values(newUser('auth-invalidate-2', 'a2@example.com'));

    await invalidateSessionsFor(db, 'auth-invalidate-1');

    const [named] = await db.select().from(users).where(eq(users.authUserId, 'auth-invalidate-1'));
    const [other] = await db.select().from(users).where(eq(users.authUserId, 'auth-invalidate-2'));

    expect(named?.sessionsInvalidatedAt).not.toBeNull();
    expect(other?.sessionsInvalidatedAt).toBeNull();
  });

  it('is a no-op for an auth subject with no row, and names no account', async () => {
    await expect(invalidateSessionsFor(harness.database.db, 'no-such-subject')).resolves.toBeNull();
  });
});

describe('insertUserIfAbsent, when the insert is declined', () => {
  const HELD_EMAIL = 'ada@example.com';

  /**
   * The race, arriving one statement at a time: the row is already there under
   * this identity's own auth id, so the conflict is the identity meeting
   * itself and the winning row is the answer.
   */
  it('answers with the row this identity already holds', async () => {
    const [existing] = await harness.database.db
      .insert(users)
      .values(newUser('auth_ada', HELD_EMAIL))
      .returning();

    const resolved = await insertUserIfAbsent(harness.database.db, newUser('auth_ada', HELD_EMAIL));

    expect(resolved?.id).toBe(existing!.id);
    expect(await harness.database.db.select().from(users)).toHaveLength(1);
  });

  /**
   * An auth-deleted identity signing in again. It must read as "no account"
   * rather than as a collision — the branch D38 names, and the reason the
   * fallback read includes retired rows instead of hiding them.
   */
  it('answers null for an identity that has been retired', async () => {
    await harness.database.db
      .insert(users)
      .values({ ...newUser('auth_ada', HELD_EMAIL), deletedAt: new Date() });

    expect(
      await insertUserIfAbsent(harness.database.db, newUser('auth_ada', HELD_EMAIL)),
    ).toBeNull();
    expect(await harness.database.db.select().from(users)).toHaveLength(1);
  });

  /**
   * **The discriminating case.** A different auth identity arriving with an
   * address somebody else holds is not this identity meeting itself, so `null`
   * would report an admin-actionable collision as the ordinary "no account
   * yet". It throws, and the message names the auth id, because the 23505 it
   * replaced put `constraint: users_email_key` into the record and a sentence
   * alone would be quieter than what it replaced.
   */
  it('throws, naming the identity, when another account holds the address', async () => {
    await harness.database.db.insert(users).values(newUser('auth_ada', HELD_EMAIL));

    await expect(
      insertUserIfAbsent(harness.database.db, newUser('auth_twin', HELD_EMAIL)),
    ).rejects.toThrow(
      /users: the insert for auth_twin was declined — its address is held by auth_ada \(live\)/,
    );

    const rows = await harness.database.db.select().from(users);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.authUserId).toBe('auth_ada');
  });

  /**
   * The **retired** account's address, which is the case a reader will assume
   * this file settles and which it deliberately does not.
   *
   * `retireUserWhere` writes only `deleted_at`, and `users_email_key` has no
   * `WHERE deleted_at IS NULL`, so a closed account keeps its address in the
   * index while the auth provider frees it — and the same person signing up again arrives
   * with a *new* Auth id and collides. That collision is old: the targeted
   * `DO NOTHING` raised a 23505 at the same statement long before #442, so
   * re-registration after closure has never worked.
   *
   * **What happens next is decided by the index, not by this function**, so the
   * assertion belongs with whoever owns the index shape. #451 makes it partial,
   * at which point no conflict arises, the row inserts and the person is back —
   * and this same call stops throwing. Pinning "throws" here would pin the
   * defect and go red the moment it is fixed, which is why the case below stops
   * at the fact that is true either way: whatever the outcome, nothing is
   * merged onto the retired row and it keeps its own auth id.
   */
  it('never resolves a reused address onto the retired account that held it', async () => {
    await harness.database.db
      .insert(users)
      .values({ ...newUser('auth_ada', HELD_EMAIL), deletedAt: new Date() });

    const resolved = await insertUserIfAbsent(
      harness.database.db,
      newUser('auth_returning', HELD_EMAIL),
    ).catch(() => null);

    expect(resolved?.authUserId).not.toBe('auth_ada');

    const [retired] = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.authUserId, 'auth_ada'));

    expect(retired?.deletedAt).not.toBeNull();
    expect(retired?.email).toBe(HELD_EMAIL);
  });

  /** The ordinary path, so the cases above are read as the exceptions they are. */
  it('writes and returns the row when nothing conflicts', async () => {
    const created = await insertUserIfAbsent(harness.database.db, newUser('auth_ada', HELD_EMAIL));

    expect(created?.authUserId).toBe('auth_ada');

    const [stored] = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.authUserId, 'auth_ada'));

    expect(stored?.id).toBe(created?.id);
  });
});

/**
 * `updateUserByAuthId` when `users_email_key` refuses the address (#462).
 *
 * **Driven against the real index, with a second row genuinely holding the
 * address.** A mocked rejection would prove the catch runs and not that
 * anything can reach it — and reachability is the entire question here, because
 * the defect was that a live statement raised 23505 where nobody was catching.
 * Every case below puts a real second row in the table and lets Postgres
 * decide.
 */
describe('updateUserByAuthId, when another account already holds the address', () => {
  const ADA = 'auth_ada';
  const BEA = 'auth_bea';
  const ADA_EMAIL = 'ada@example.com';
  const BEA_EMAIL = 'bea@example.com';

  async function rowFor(authUserId: string) {
    const [row] = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUserId));

    return row;
  }

  beforeEach(async () => {
    await harness.database.db
      .insert(users)
      .values([newUser(ADA, ADA_EMAIL), newUser(BEA, BEA_EMAIL)]);
  });

  /**
   * **Acceptance 1 and 3 together, which is the point.**
   *
   * Reading only the row passes against a version that silently discards the
   * update — `email` is unchanged either way — so the divergence record is
   * asserted in the same breath. And the rest of the patch still lands: a name
   * that arrived in the same event is not in dispute, and freezing it would let
   * one contested address stop every other mirrored field on the account.
   */
  it('keeps the old address, records the one it could not write, and mirrors the rest', async () => {
    const result = await updateUserByAuthId(harness.database.db, ADA, {
      email: BEA_EMAIL,
      firstName: 'Grace',
    });

    expect(result).not.toBeNull();
    expect(result?.emailDiverged).toBe(true);

    const ada = await rowFor(ADA);

    expect(ada?.email).toBe(ADA_EMAIL);
    expect(ada?.pendingEmail).toBe(BEA_EMAIL);
    expect(ada?.emailSyncFailedAt).toBeInstanceOf(Date);
    expect(ada?.firstName).toBe('Grace');

    // The row that holds the address is not touched by somebody else's event.
    expect((await rowFor(BEA))?.email).toBe(BEA_EMAIL);
  });

  /**
   * The narrowness of the catch, and it is not decoration.
   *
   * A 23505 from `users_auth_user_id_key` means two rows claiming one
   * identity — a broken invariant rather than a stale column — and swallowing
   * it would turn the loudest failure in this file into a silent no-op. Only
   * `users_email_key` is caught, so this still throws.
   */
  it('does not swallow a collision on any other unique index', async () => {
    await expect(
      updateUserByAuthId(harness.database.db, ADA, { authUserId: BEA }),
    ).rejects.toThrow();

    expect((await rowFor(ADA))?.pendingEmail).toBeNull();
  });

  /**
   * The repair, which is what makes `pending_email` mean *currently* diverged
   * rather than *once* diverged. Without this an account that fixed itself
   * would sit on the admin's list for ever.
   */
  it('clears the record once the address can be written', async () => {
    await updateUserByAuthId(harness.database.db, ADA, { email: BEA_EMAIL });
    expect((await rowFor(ADA))?.pendingEmail).toBe(BEA_EMAIL);

    await updateUserByAuthId(harness.database.db, ADA, { email: 'ada.new@example.com' });

    const ada = await rowFor(ADA);

    expect(ada?.email).toBe('ada.new@example.com');
    expect(ada?.pendingEmail).toBeNull();
    expect(ada?.emailSyncFailedAt).toBeNull();
  });

  /**
   * `email_sync_failed_at` answers "since when has this been wrong", so a
   * redelivery — or a second event colliding again — must not push it forward.
   * `coalesce` is what holds it, and a plain `now()` would pass every other
   * assertion in this file.
   */
  it('holds the timestamp at the first failure across repeated collisions', async () => {
    await updateUserByAuthId(harness.database.db, ADA, { email: BEA_EMAIL });
    const first = (await rowFor(ADA))?.emailSyncFailedAt;

    await updateUserByAuthId(harness.database.db, ADA, {
      email: BEA_EMAIL,
      lastName: 'Lovelace',
    });

    const ada = await rowFor(ADA);

    expect(ada?.emailSyncFailedAt?.getTime()).toBe(first?.getTime());
    expect(ada?.lastName).toBe('Lovelace');
  });

  /**
   * The ordering race (VEN-386): Ada's move to Bea's address was delivered
   * before Bea's move off it. Bea's event releasing the address is the only
   * event that will ever arrive, so it has to hand the address to Ada in the
   * same call — nothing else would re-apply it.
   */
  it('hands a released address to the row waiting on it', async () => {
    await updateUserByAuthId(harness.database.db, ADA, { email: BEA_EMAIL });
    expect((await rowFor(ADA))?.pendingEmail).toBe(BEA_EMAIL);

    const bea = await updateUserByAuthId(harness.database.db, BEA, {
      email: 'bea.new@example.com',
    });

    expect(bea?.emailDiverged).toBe(false);
    expect((await rowFor(BEA))?.email).toBe('bea.new@example.com');

    const ada = await rowFor(ADA);

    expect(ada?.email).toBe(BEA_EMAIL);
    expect(ada?.pendingEmail).toBeNull();
    expect(ada?.emailSyncFailedAt).toBeNull();
  });

  /**
   * Two rows waiting on one address: auth gives it to one of them and the
   * database cannot tell which, so neither is handed it.
   */
  it('hands a released address to nobody when more than one row waits on it', async () => {
    await harness.database.db.insert(users).values(newUser('auth_cy', 'cy@example.com'));
    await updateUserByAuthId(harness.database.db, ADA, { email: BEA_EMAIL });
    await updateUserByAuthId(harness.database.db, 'auth_cy', { email: BEA_EMAIL });

    await updateUserByAuthId(harness.database.db, BEA, { email: 'bea.new@example.com' });

    expect((await rowFor(ADA))?.email).toBe(ADA_EMAIL);
    expect((await rowFor(ADA))?.pendingEmail).toBe(BEA_EMAIL);
    expect((await rowFor('auth_cy'))?.email).toBe('cy@example.com');
    expect((await rowFor('auth_cy'))?.pendingEmail).toBe(BEA_EMAIL);
  });

  /**
   * The same race with a deletion: the account that took the address over was
   * delivered before the holder's `user.deleted`.
   */
  it('hands the address of a retired account to the row waiting on it', async () => {
    await updateUserByAuthId(harness.database.db, ADA, { email: BEA_EMAIL });

    await retireUserByAuthId(harness.database.db, BEA);

    const ada = await rowFor(ADA);

    expect(ada?.email).toBe(BEA_EMAIL);
    expect(ada?.pendingEmail).toBeNull();
    expect(ada?.emailSyncFailedAt).toBeNull();
  });

  /**
   * An event that does not move the holder off the address releases nothing,
   * so the waiter stays diverged rather than colliding a second time.
   */
  it('leaves the waiter diverged when the holder keeps the address', async () => {
    await updateUserByAuthId(harness.database.db, ADA, { email: BEA_EMAIL });

    await updateUserByAuthId(harness.database.db, BEA, {
      email: BEA_EMAIL,
      firstName: 'Beatrice',
    });

    const ada = await rowFor(ADA);

    expect(ada?.email).toBe(ADA_EMAIL);
    expect(ada?.pendingEmail).toBe(BEA_EMAIL);
    expect((await rowFor(BEA))?.firstName).toBe('Beatrice');
  });
});
