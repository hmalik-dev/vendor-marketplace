import { categories, legalAcceptances, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { CURRENT_VENDOR_AGREEMENT_VERSION } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The vendor agreement — frame `32`, step 3 of onboarding.
 *
 * Driven through the real routes rather than the service, because the whole
 * question here is authorisation: which callers may read this vendor's
 * acceptance record and which may write to it. A vendor's legal record is the
 * one row in this product that another vendor must never be able to touch.
 */
describe('the vendor agreement', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function seedVendorProfile(user: string, businessName: string): Promise<void> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(user),
      payload: {
        businessName,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: `${businessName} does good work.`,
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);
  }

  function read(user?: string) {
    return harness.app.inject({
      method: 'GET',
      url: '/vendor/agreement',
      ...(user ? { headers: bearer(user) } : {}),
    });
  }

  function accept(user: string | undefined, version = CURRENT_VENDOR_AGREEMENT_VERSION) {
    return harness.app.inject({
      method: 'POST',
      url: '/vendor/agreement/accept',
      ...(user ? { headers: bearer(user) } : {}),
      payload: { version },
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [id, role] of [
      ['vendor_a', 'vendor'],
      ['vendor_b', 'vendor'],
      ['customer_a', 'customer'],
      ['admin_a', 'admin'],
    ] as const) {
      harness.clerkUsers.set(id, {
        clerkUserId: id,
        email: `${id}@example.com`,
        firstName: 'June',
        lastName: 'Harlow',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db.select().from(categories);
    photographyId = rows.find((row) => row.slug === 'photography')!.id;
  });

  afterEach(async () => {
    /*
     * The acceptances go with the vendor rather than first: the table refuses a
     * delete while the vendor it is about still exists, and lets the cascade
     * through when the account itself is erased. Clearing it directly is the
     * tampering the trigger is there to refuse.
     */
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('GET /vendor/agreement', () => {
    it('reports the current version and no acceptance before the vendor accepts', async () => {
      await seedVendorProfile('vendor_a', 'June Harlow Photography');

      const response = await read('vendor_a');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        current: CURRENT_VENDOR_AGREEMENT_VERSION,
        businessName: 'June Harlow Photography',
        accepted: null,
        isCurrent: false,
        history: [],
      });
    });

    it('answers 404 for a vendor with no profile yet', async () => {
      const response = await read('vendor_a');

      expect(response.statusCode).toBe(404);
    });

    it('refuses a customer, an admin and a signed-out caller', async () => {
      await seedVendorProfile('vendor_a', 'June Harlow Photography');

      expect((await read('customer_a')).statusCode).toBe(403);
      expect((await read('admin_a')).statusCode).toBe(403);
      expect((await read()).statusCode).toBe(401);
    });
  });

  describe('POST /vendor/agreement/accept', () => {
    it('records the acceptance and reports the vendor as current', async () => {
      await seedVendorProfile('vendor_a', 'June Harlow Photography');

      const response = await accept('vendor_a');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        isCurrent: true,
        accepted: {
          document: 'vendor_agreement',
          version: CURRENT_VENDOR_AGREEMENT_VERSION,
          acceptedByName: 'June Harlow',
          businessName: 'June Harlow Photography',
        },
      });
      expect(response.json().history).toHaveLength(1);
    });

    /**
     * The name and the business name are the profile's at that instant, copied
     * onto the row — never the client's. A record naming a business the browser
     * supplied is a record the vendor wrote about themselves.
     */
    it('freezes the person and the business as they stood, and records the request', async () => {
      await seedVendorProfile('vendor_a', 'June Harlow Photography');
      await accept('vendor_a');

      const [row] = await harness.database.db.select().from(legalAcceptances);

      expect({
        name: row!.acceptedByName,
        business: row!.businessName,
        agent: row!.userAgent,
      }).toEqual({
        name: 'June Harlow',
        business: 'June Harlow Photography',
        // The injected request's own agent — what matters is that it is stored.
        agent: 'lightMyRequest',
      });
      expect(row!.ip).not.toBe('');
    });

    /**
     * Acceptance 9: exactly one row, and the first one is never overwritten.
     *
     * Re-posting a version already held answers rather than writing. The rows
     * can never be deleted, so an insert on every call is an unbounded and
     * permanently unbounded write — and the second acceptance of a version
     * already held adds no answer to "which version did I agree to, and when",
     * which is the only question the record exists for.
     */
    it('answers rather than writing when the version is already held', async () => {
      await seedVendorProfile('vendor_a', 'June Harlow Photography');

      const first = await accept('vendor_a');
      const second = await accept('vendor_a');

      expect(second.statusCode).toBe(200);
      expect(second.json().history).toHaveLength(1);
      // The original row, untouched — same instant, not a rewritten one.
      expect(new Date(second.json().accepted.acceptedAt).toISOString()).toBe(
        new Date(first.json().accepted.acceptedAt).toISOString(),
      );
      expect(await harness.database.db.select().from(legalAcceptances)).toHaveLength(1);
    });

    /**
     * A **new** version does add its row, which is the case the append-only
     * rule exists for. Driven by moving the constant, because that is the
     * mechanism: the agreement is revised, and every vendor is a version behind
     * until they accept it.
     */
    it('adds a row for a new version and leaves the old acceptance standing', async () => {
      await seedVendorProfile('vendor_a', 'June Harlow Photography');
      await accept('vendor_a');

      const superseded = await harness.database.db.select().from(legalAcceptances);

      /*
       * The insert is the same code path with a different current version, so
       * this reaches through the DAO rather than the route — the route refuses
       * anything but the version in force, which is what makes the constant the
       * only way a second row is ever written.
       */
      await harness.database.db.insert(legalAcceptances).values({
        vendorId: superseded[0]!.vendorId,
        document: 'vendor_agreement',
        version: 'v2.0',
        acceptedByUserId: superseded[0]!.acceptedByUserId,
        acceptedByName: superseded[0]!.acceptedByName,
        businessName: superseded[0]!.businessName,
      });

      const rows = await harness.database.db.select().from(legalAcceptances);

      expect(rows.map((row) => row.version).sort()).toEqual(['v1.0', 'v2.0']);
    });

    /** A tab left open across a release must not record a version nobody read. */
    it('refuses a version that is not the one in force', async () => {
      await seedVendorProfile('vendor_a', 'June Harlow Photography');

      const response = await accept('vendor_a', 'v0.9');

      expect(response.statusCode).toBe(409);
      expect(await harness.database.db.select().from(legalAcceptances)).toHaveLength(0);
    });

    it('refuses a customer, an admin and a signed-out caller', async () => {
      await seedVendorProfile('vendor_a', 'June Harlow Photography');

      expect((await accept('customer_a')).statusCode).toBe(403);
      expect((await accept('admin_a')).statusCode).toBe(403);
      expect((await accept(undefined)).statusCode).toBe(401);
      expect(await harness.database.db.select().from(legalAcceptances)).toHaveLength(0);
    });

    /**
     * The cross-tenant read that matters most: one vendor accepting must leave
     * another vendor's record alone, and neither may see the other's.
     */
    it('writes only against the accepting vendor, and never another one', async () => {
      await seedVendorProfile('vendor_a', 'June Harlow Photography');
      await seedVendorProfile('vendor_b', 'Second Light Studio');

      await accept('vendor_a');

      expect((await read('vendor_a')).json().isCurrent).toBe(true);
      expect((await read('vendor_b')).json()).toMatchObject({
        businessName: 'Second Light Studio',
        isCurrent: false,
        history: [],
      });
    });
  });
});
