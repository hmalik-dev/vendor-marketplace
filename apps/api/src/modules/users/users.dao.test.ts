import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { insertUserIfAbsent } from './users.dao.js';

/**
 * What `insertUserIfAbsent` does when the insert is declined — the branch #442
 * widened, pinned deterministically.
 *
 * **The race that motivated the change cannot be the only test of it.**
 * `legal-acceptance-race.contention.test.ts` reproduces the defect by firing
 * eight simultaneous first sign-ins, and it caught this at roughly one run in
 * four — which means restoring `{ target: users.clerkUserId }` leaves that
 * suite green about three runs in four, and the one red run reads as flake.
 * A probabilistic guard is not a guard.
 *
 * The webhook case in `clerk.routes.test.ts` does not close the gap either: a
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
describe('insertUserIfAbsent, when the insert is declined', () => {
  const HELD_EMAIL = 'ada@example.com';

  let harness: TestHarness;

  function newUser(clerkUserId: string, email: string) {
    return {
      clerkUserId,
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
   * The race, arriving one statement at a time: the row is already there under
   * this identity's own Clerk id, so the conflict is the identity meeting
   * itself and the winning row is the answer.
   */
  it('answers with the row this identity already holds', async () => {
    const [existing] = await harness.database.db
      .insert(users)
      .values(newUser('clerk_ada', HELD_EMAIL))
      .returning();

    const resolved = await insertUserIfAbsent(
      harness.database.db,
      newUser('clerk_ada', HELD_EMAIL),
    );

    expect(resolved?.id).toBe(existing!.id);
    expect(await harness.database.db.select().from(users)).toHaveLength(1);
  });

  /**
   * A Clerk-deleted identity signing in again. It must read as "no account"
   * rather than as a collision — the branch D38 names, and the reason the
   * fallback read includes retired rows instead of hiding them.
   */
  it('answers null for an identity that has been retired', async () => {
    await harness.database.db
      .insert(users)
      .values({ ...newUser('clerk_ada', HELD_EMAIL), deletedAt: new Date() });

    expect(
      await insertUserIfAbsent(harness.database.db, newUser('clerk_ada', HELD_EMAIL)),
    ).toBeNull();
    expect(await harness.database.db.select().from(users)).toHaveLength(1);
  });

  /**
   * **The discriminating case.** A different Clerk identity arriving with an
   * address somebody else holds is not this identity meeting itself, so `null`
   * would report an operator-actionable collision as the ordinary "no account
   * yet". It throws, and the message names the Clerk id, because the 23505 it
   * replaced put `constraint: users_email_key` into the record and a sentence
   * alone would be quieter than what it replaced.
   */
  it('throws, naming the identity, when another account holds the address', async () => {
    await harness.database.db.insert(users).values(newUser('clerk_ada', HELD_EMAIL));

    await expect(
      insertUserIfAbsent(harness.database.db, newUser('clerk_twin', HELD_EMAIL)),
    ).rejects.toThrow(
      /users: the insert for clerk_twin was declined — its address is held by clerk_ada \(live\)/,
    );

    const rows = await harness.database.db.select().from(users);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.clerkUserId).toBe('clerk_ada');
  });

  /**
   * The **retired** account's address, which is the case a reader will assume
   * this file settles and which it deliberately does not.
   *
   * `retireUserWhere` writes only `deleted_at`, and `users_email_key` has no
   * `WHERE deleted_at IS NULL`, so a closed account keeps its address in the
   * index while Clerk frees it — and the same person signing up again arrives
   * with a *new* Clerk id and collides. That collision is old: the targeted
   * `DO NOTHING` raised a 23505 at the same statement long before #442, so
   * re-registration after closure has never worked.
   *
   * **What happens next is decided by the index, not by this function**, so the
   * assertion belongs with whoever owns the index shape. #451 makes it partial,
   * at which point no conflict arises, the row inserts and the person is back —
   * and this same call stops throwing. Pinning "throws" here would pin the
   * defect and go red the moment it is fixed, which is why the case below stops
   * at the fact that is true either way: whatever the outcome, nothing is
   * merged onto the retired row and it keeps its own Clerk id.
   */
  it('never resolves a reused address onto the retired account that held it', async () => {
    await harness.database.db
      .insert(users)
      .values({ ...newUser('clerk_ada', HELD_EMAIL), deletedAt: new Date() });

    const resolved = await insertUserIfAbsent(
      harness.database.db,
      newUser('clerk_returning', HELD_EMAIL),
    ).catch(() => null);

    expect(resolved?.clerkUserId).not.toBe('clerk_ada');

    const [retired] = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, 'clerk_ada'));

    expect(retired?.deletedAt).not.toBeNull();
    expect(retired?.email).toBe(HELD_EMAIL);
  });

  /** The ordinary path, so the cases above are read as the exceptions they are. */
  it('writes and returns the row when nothing conflicts', async () => {
    const created = await insertUserIfAbsent(harness.database.db, newUser('clerk_ada', HELD_EMAIL));

    expect(created?.clerkUserId).toBe('clerk_ada');

    const [stored] = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, 'clerk_ada'));

    expect(stored?.id).toBe(created?.id);
  });
});
