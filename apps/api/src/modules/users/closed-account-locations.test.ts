import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import {
  bookingRequests,
  bookings,
  supportCases,
  users,
  vendorApplications,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { CLOSED_ACCOUNT_PLACEHOLDER } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { retireUserByAuthId } from './users.dao.js';

/**
 * VEN-687: closure also clears the coordinates, event addresses and free text
 * that identify the person, and keeps every row.
 */
const VENDOR_EMAIL = 'ada.reyes@example.com';
const CUSTOMER_EMAIL = 'priya.nair@example.com';
const HOME = '12 Harbour Street, Austin';
const DETAILS = 'Gate code 4417, ring twice';
const EVENT_DATE = '2020-06-06';

const BACKFILL = readFileSync(
  new URL(
    '../../../../../packages/db/drizzle/0097_scrub_closed_account_locations_and_free_text.sql',
    import.meta.url,
  ),
  'utf8',
);

let harness: TestHarness;

beforeAll(async () => {
  harness = await createTestHarness();
});

afterEach(async () => {
  const { db } = harness.database;
  await db.delete(supportCases);
  await db.delete(bookings);
  await db.delete(bookingRequests);
  await db.delete(vendorApplications);
  await db.delete(vendorProfiles);
  await db.delete(users);
});

afterAll(async () => {
  await harness.close();
});

async function seed() {
  const { db } = harness.database;
  const [vendorUser] = await db
    .insert(users)
    .values({
      authUserId: 'auth_ada',
      email: VENDOR_EMAIL,
      role: 'vendor',
      firstName: 'Ada',
      lastName: 'Reyes',
    })
    .returning({ id: users.id });
  const [customer] = await db
    .insert(users)
    .values({
      authUserId: 'auth_priya',
      email: CUSTOMER_EMAIL,
      role: 'customer',
      firstName: 'Priya',
      lastName: 'Nair',
    })
    .returning({ id: users.id });
  const [profile] = await db
    .insert(vendorProfiles)
    .values({
      userId: vendorUser!.id,
      businessName: 'Ada Events',
      slug: 'ada-events',
      address: HOME,
      latitude: '30.26715000',
      longitude: '-97.74306000',
      bio: 'I run events out of my home studio.',
      tagline: 'Home-grown florals',
    })
    .returning({ id: vendorProfiles.id });
  const [request] = await db
    .insert(bookingRequests)
    .values({
      customerId: customer!.id,
      vendorId: profile!.id,
      eventDate: EVENT_DATE,
      eventLocation: HOME,
      customDetails: DETAILS,
      status: 'accepted',
    })
    .returning({ id: bookingRequests.id });
  await db.insert(bookings).values({
    requestId: request!.id,
    customerId: customer!.id,
    vendorId: profile!.id,
    eventDate: EVENT_DATE,
    eventLocation: HOME,
    totalAmountCents: 100_000,
    platformFeeCents: 12_000,
    vendorPayoutCents: 88_000,
    status: 'completed',
  });
  await db.insert(vendorApplications).values({
    email: VENDOR_EMAIL,
    businessName: 'Ada Events',
    city: 'Austin',
    message: 'I work from home at 12 Harbour Street.',
  });
  await db.insert(supportCases).values({
    reference: 'CASE-687',
    origin: 'support_message',
    senderUserId: vendorUser!.id,
    senderEmail: VENDOR_EMAIL,
    message: 'My address is 12 Harbour Street.',
  });

  return { vendorUserId: vendorUser!.id, customerId: customer!.id };
}

async function state() {
  const { db } = harness.database;

  return {
    profile: await db
      .select({
        latitude: vendorProfiles.latitude,
        longitude: vendorProfiles.longitude,
        bio: vendorProfiles.bio,
        tagline: vendorProfiles.tagline,
      })
      .from(vendorProfiles),
    requests: await db
      .select({
        eventLocation: bookingRequests.eventLocation,
        customDetails: bookingRequests.customDetails,
      })
      .from(bookingRequests),
    bookings: await db.select({ eventLocation: bookings.eventLocation }).from(bookings),
    applications: await db
      .select({
        businessName: vendorApplications.businessName,
        city: vendorApplications.city,
        message: vendorApplications.message,
      })
      .from(vendorApplications),
    cases: await db.select({ message: supportCases.message }).from(supportCases),
  };
}

const SCRUBBED_PARTY = {
  requests: [
    { eventLocation: CLOSED_ACCOUNT_PLACEHOLDER, customDetails: CLOSED_ACCOUNT_PLACEHOLDER },
  ],
  bookings: [{ eventLocation: CLOSED_ACCOUNT_PLACEHOLDER }],
};

async function runBackfill(): Promise<void> {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    await harness.database.db.execute(sql.raw(statement));
  }
}

describe('closing an account (VEN-687)', () => {
  it('clears a vendor’s coordinates, bio, tagline, application, case and the event addresses, keeping every row', async () => {
    await seed();

    await retireUserByAuthId(harness.database.db, 'auth_ada');

    expect(await state()).toEqual({
      profile: [{ latitude: null, longitude: null, bio: null, tagline: null }],
      ...SCRUBBED_PARTY,
      applications: [{ businessName: null, city: null, message: null }],
      cases: [{ message: CLOSED_ACCOUNT_PLACEHOLDER }],
    });
  });

  it('clears a customer’s event addresses and leaves the vendor’s profile alone', async () => {
    await seed();

    await retireUserByAuthId(harness.database.db, 'auth_priya');

    const after = await state();

    expect(after.requests).toEqual(SCRUBBED_PARTY.requests);
    expect(after.bookings).toEqual(SCRUBBED_PARTY.bookings);
    expect(after.profile).toEqual([
      {
        latitude: '30.26715000',
        longitude: '-97.74306000',
        bio: 'I run events out of my home studio.',
        tagline: 'Home-grown florals',
      },
    ]);
    expect(after.cases).toEqual([{ message: 'My address is 12 Harbour Street.' }]);
  });

  it('leaves a stranger’s application and requests alone', async () => {
    await seed();
    const { db } = harness.database;
    await db.insert(vendorApplications).values({
      email: 'other@example.com',
      businessName: 'Other Co',
      city: 'Dallas',
      message: 'Hello',
    });

    await retireUserByAuthId(db, 'auth_ada');

    const rows = await db
      .select({ businessName: vendorApplications.businessName })
      .from(vendorApplications)
      .where(eq(vendorApplications.email, 'other@example.com'));

    expect(rows).toEqual([{ businessName: 'Other Co' }]);
  });
});

describe('the backfill for accounts closed before VEN-687', () => {
  it('cleans them, and a second run changes nothing', async () => {
    const { vendorUserId } = await seed();
    await harness.database.db
      .update(users)
      .set({ deletedAt: sql`now()`, email: `closed+${vendorUserId}@invalid` })
      .where(eq(users.id, vendorUserId));
    await harness.database.db
      .update(supportCases)
      .set({ senderEmail: `closed+${vendorUserId}@invalid` });

    await runBackfill();

    const expected = {
      profile: [{ latitude: '30.26715000', longitude: '-97.74306000', bio: null, tagline: null }],
      ...SCRUBBED_PARTY,
      applications: [
        {
          businessName: 'Ada Events',
          city: 'Austin',
          message: 'I work from home at 12 Harbour Street.',
        },
      ],
      cases: [{ message: CLOSED_ACCOUNT_PLACEHOLDER }],
    };
    expect(await state()).toEqual(expected);

    const [before] = await harness.database.db
      .select({ updatedAt: bookingRequests.updatedAt })
      .from(bookingRequests);
    await runBackfill();

    expect(await state()).toEqual(expected);
    expect(
      await harness.database.db
        .select({ updatedAt: bookingRequests.updatedAt })
        .from(bookingRequests),
    ).toEqual([before]);
  });

  it('leaves live accounts alone', async () => {
    await seed();

    await runBackfill();

    const after = await state();

    expect(after.requests).toEqual([{ eventLocation: HOME, customDetails: DETAILS }]);
    expect(after.bookings).toEqual([{ eventLocation: HOME }]);
    expect(after.profile[0]?.bio).toBe('I run events out of my home studio.');
  });

  it('writes the same placeholder the closure does', () => {
    expect(BACKFILL).toContain(`'${CLOSED_ACCOUNT_PLACEHOLDER}'`);
    expect(BACKFILL.replaceAll(`'${CLOSED_ACCOUNT_PLACEHOLDER}'`, '')).not.toMatch(/Removed when/);
  });
});
