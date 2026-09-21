import { eq } from 'drizzle-orm';
import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { CURRENT_VENDOR_AGREEMENT_VERSION, legalDocumentSha256 } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  acceptVendorAgreementAs,
  bearer,
  createTestHarness,
  type TestHarness,
} from '../../testing/test-server.js';
import { insertAcceptance } from '../legal/legal-acceptance.dao.js';
import * as agreement from './legal-agreement.service.js';

/*
 * Passed through by default; the race case below scripts two answers. Rows in
 * `legal_acceptances` are append-only and the database refuses to remove one,
 * so "loses the row between the pre-check and the lock" cannot be staged by a
 * delete — the two reads have to disagree, which is exactly what it would look
 * like from the request's side.
 */
vi.mock('./legal-agreement.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./legal-agreement.service.js')>();

  return { ...actual, holdsCurrentAgreement: vi.fn(actual.holdsCurrentAgreement) };
});

const VENDOR = 'user_publish_agreement_vendor';
const STALE_VERSION = 'v0.9';

/** VEN-509: publishing is impossible without an accepted vendor agreement. */
describe('publishing and the vendor agreement', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function completeProfile(): Promise<string> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography.',
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);

    const pkg = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Full day',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
        priceType: 'fixed',
        inclusions: ['6 hours'],
      },
    });
    expect(pkg.statusCode).toBe(201);

    return created.json().id;
  }

  function publish() {
    return harness.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: { isPublished: true },
    });
  }

  async function isPublished(vendorId: string): Promise<boolean | undefined> {
    const [row] = await harness.database.db
      .select({ isPublished: vendorProfiles.isPublished })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId));

    return row?.isPublished;
  }

  /** An acceptance at an older version, written the way a past release would have. */
  async function acceptStaleVersion(vendorId: string): Promise<void> {
    const [user] = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.authUserId, VENDOR));

    await insertAcceptance(harness.database.db, {
      vendorId,
      document: 'vendor_agreement',
      version: STALE_VERSION,
      documentSha256: legalDocumentSha256('vendor_agreement'),
      acceptanceMethod: 'seed_fixture',
      acceptedByUserId: user!.id,
      acceptedByName: 'Test User',
      businessName: 'Sunlit Studio',
      ip: null,
      userAgent: null,
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness();
    harness.authUsers.set(VENDOR, {
      authUserId: VENDOR,
      email: 'agreement-vendor@example.com',
      firstName: 'Test',
      lastName: 'User',
      roleHint: 'vendor',
      avatarUrl: null,
    });

    const [row] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'));
    photographyId = row!.id;
  });

  afterEach(async () => {
    vi.mocked(agreement.holdsCurrentAgreement).mockClear();
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('refuses a vendor with no acceptance, and leaves the profile unpublished', async () => {
    const vendorId = await completeProfile();

    const response = await publish();

    expect(response.statusCode).toBe(400);
    expect(response.json().details.blockers).toEqual(['agreement']);
    expect(await isPublished(vendorId)).toBe(false);
  });

  it('publishes the same vendor once they accept the current version', async () => {
    const vendorId = await completeProfile();
    await acceptVendorAgreementAs(harness, VENDOR);

    const response = await publish();

    expect(response.statusCode).toBe(200);
    expect(response.json().publishBlockers).toEqual([]);
    expect(await isPublished(vendorId)).toBe(true);
  });

  it('refuses a vendor whose newest acceptance is an older version', async () => {
    const vendorId = await completeProfile();
    await acceptStaleVersion(vendorId);
    expect(STALE_VERSION).not.toBe(CURRENT_VENDOR_AGREEMENT_VERSION);

    const response = await publish();

    expect(response.statusCode).toBe(400);
    expect(response.json().details.blockers).toEqual(['agreement']);
    expect(await isPublished(vendorId)).toBe(false);
  });

  it('names agreement on the profile read, before the vendor tries to publish', async () => {
    await completeProfile();

    const read = await harness.app.inject({
      method: 'GET',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
    });

    expect(read.json().publishBlockers).toEqual(['agreement']);
  });

  it('refuses under the lock when the acceptance is gone by then, and answers 400 not 500', async () => {
    const vendorId = await completeProfile();
    await acceptVendorAgreementAs(harness, VENDOR);
    // The pre-check sees the acceptance; the locked re-check does not.
    vi.mocked(agreement.holdsCurrentAgreement)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const response = await publish();

    expect(response.statusCode).toBe(400);
    expect(response.json().details.blockers).toEqual(['agreement']);
    expect(await isPublished(vendorId)).toBe(false);
  });
});
