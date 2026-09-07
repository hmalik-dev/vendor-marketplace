import { legalAcceptances, users } from '@vendor-marketplace/db/schema';
import { CURRENT_TERMS_VERSION, legalDocumentSha256 } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { findSessionSubject } from './users.dao.js';

/**
 * The acceptance gate's one query, on the **driver production uses**.
 *
 * `findSessionSubject` folds "does this account hold the current Terms" into
 * the `users` lookup as a correlated `EXISTS`, written as `sql<boolean>` — and
 * `sql<boolean>` is a claim about what comes back, not a guarantee. Drizzle
 * applies no parser to a raw fragment; whether the value arrives as `true` or
 * as the string `'t'` is decided by the driver's own type handling.
 *
 * **If it arrived as a string, every value would be truthy and the gate would
 * be open for everybody** — including accounts that have accepted nothing. And
 * the whole PGlite suite would stay green, because the in-process driver is not
 * the one that would be wrong. That is precisely the shape a single-engine test
 * cannot see, so this asserts the type against the pooled `postgres-js` client
 * the API actually boots with.
 *
 * It runs under `pnpm test:contention` rather than `pnpm test` for the reason
 * every suite in that set does: it needs a real server, not PGlite.
 */
describe('the acceptance gate’s folded read, on the real driver', () => {
  const ACCEPTED = '11111111-1111-4111-8111-111111111111';
  const GATED = '22222222-2222-4222-8222-222222222222';

  let database: PostgresTestDatabase;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();

    await database.db.insert(users).values([
      {
        id: ACCEPTED,
        clerkUserId: 'clerk_accepted',
        email: 'accepted@example.com',
        role: 'customer',
        firstName: 'Ada',
        lastName: 'Reyes',
      },
      {
        id: GATED,
        clerkUserId: 'clerk_gated',
        email: 'gated@example.com',
        role: 'customer',
        firstName: 'Bo',
        lastName: 'Nkemelu',
      },
    ]);

    await database.db.insert(legalAcceptances).values({
      vendorId: null,
      document: 'terms_of_service',
      version: CURRENT_TERMS_VERSION,
      documentSha256: legalDocumentSha256('terms_of_service'),
      acceptanceMethod: 'seed_fixture',
      acceptedByUserId: ACCEPTED,
      acceptedByName: 'Ada Reyes',
      businessName: null,
      ip: null,
      userAgent: null,
    });
  });

  afterAll(async () => {
    await database.close();
  });

  /**
   * `toBe(true)` and `toBe(false)`, never `toBeTruthy` — the entire point is the
   * **type**, and `'f'` is truthy.
   */
  it('answers a real boolean, not a string, for an account that holds the Terms', async () => {
    const subject = await findSessionSubject(
      database.db,
      'clerk_accepted',
      'terms_of_service',
      CURRENT_TERMS_VERSION,
    );

    expect(subject?.user.id).toBe(ACCEPTED);
    expect(subject?.holdsDocument).toBe(true);
  });

  it('answers false — and a boolean — for an account that holds nothing', async () => {
    const subject = await findSessionSubject(
      database.db,
      'clerk_gated',
      'terms_of_service',
      CURRENT_TERMS_VERSION,
    );

    expect(subject?.user.id).toBe(GATED);
    expect(subject?.holdsDocument).toBe(false);
  });

  /**
   * The correlation itself: one person's acceptance must not answer for
   * another's. A subquery that lost its link to the outer row would report
   * `true` for everybody the moment any acceptance existed, which is the same
   * open gate by a different route.
   */
  it('correlates to the account it was asked about', async () => {
    const gated = await findSessionSubject(
      database.db,
      'clerk_gated',
      'terms_of_service',
      CURRENT_TERMS_VERSION,
    );

    expect(gated?.holdsDocument).toBe(false);
  });

  /** A version nobody holds is the re-acceptance case, and must read false. */
  it('answers false for a version this account has never accepted', async () => {
    const subject = await findSessionSubject(
      database.db,
      'clerk_accepted',
      'terms_of_service',
      'v9.9',
    );

    expect(subject?.holdsDocument).toBe(false);
  });
});
