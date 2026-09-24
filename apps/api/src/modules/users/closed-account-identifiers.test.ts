import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import {
  emailDeliveries,
  supportCases,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { findSupportCases } from '../cases/cases.dao.js';
import { insertEmailDelivery } from '../notifications/email-delivery.dao.js';
import { retireUserByAuthId } from './users.dao.js';

/**
 * VEN-672: closure replaces the address in every table that holds it, not only
 * `users`, and keeps every row.
 */
const EMAIL = 'ada.reyes@example.com';
const ADDRESS = '12 Harbour Street';

const BACKFILL = readFileSync(
  new URL(
    '../../../../../packages/db/drizzle/0093_scrub_closed_account_identifiers.sql',
    import.meta.url,
  ),
  'utf8',
);

let harness: TestHarness;

beforeAll(async () => {
  harness = await createTestHarness();
});

afterEach(async () => {
  await harness.database.db.delete(emailDeliveries);
  await harness.database.db.delete(supportCases);
  await harness.database.db.delete(vendorProfiles);
  await harness.database.db.delete(users);
});

afterAll(async () => {
  await harness.close();
});

async function seedVendorWithTraces(): Promise<string> {
  const { db } = harness.database;
  const [user] = await db
    .insert(users)
    .values({
      authUserId: 'auth_ada',
      email: EMAIL,
      role: 'vendor',
      firstName: 'Ada',
      lastName: 'Reyes',
    })
    .returning({ id: users.id });
  const id = user!.id;

  await db.insert(emailDeliveries).values({
    notificationId: crypto.randomUUID(),
    userId: id,
    recipientEmail: EMAIL,
    notificationType: 'stripe_onboarding_complete',
    outcome: 'sent',
  });
  await db.insert(supportCases).values({
    reference: 'CASE-672',
    origin: 'support_message',
    senderUserId: id,
    senderEmail: EMAIL,
    message: 'Please help',
  });
  await db.insert(vendorProfiles).values({
    userId: id,
    businessName: 'Ada Events',
    slug: 'ada-events',
    address: ADDRESS,
    latitude: '51.50735000',
    longitude: '-0.12776000',
  });

  return id;
}

async function traces() {
  const { db } = harness.database;

  return {
    delivery: await db.select({ v: emailDeliveries.recipientEmail }).from(emailDeliveries),
    support: await db.select({ v: supportCases.senderEmail }).from(supportCases),
    profile: await db
      .select({
        v: vendorProfiles.address,
        latitude: vendorProfiles.latitude,
        longitude: vendorProfiles.longitude,
      })
      .from(vendorProfiles),
  };
}

async function runBackfill(): Promise<void> {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    await harness.database.db.execute(sql.raw(statement));
  }
}

async function searchCases(q: string): Promise<string[]> {
  const rows = await findSupportCases(harness.database.db, { q } as never, 10, 0);

  return rows.map((row) => row.reference);
}

describe('closing an account (VEN-672)', () => {
  it('replaces the email and address in every table and keeps the rows', async () => {
    const id = await seedVendorWithTraces();

    await retireUserByAuthId(harness.database.db, 'auth_ada');

    expect(await traces()).toEqual({
      delivery: [{ v: `closed+${id}@invalid` }],
      support: [{ v: `closed+${id}@invalid` }],
      profile: [{ v: null, latitude: null, longitude: null }],
    });
  });

  it('leaves a case raised by someone else alone', async () => {
    await seedVendorWithTraces();
    await harness.database.db.insert(supportCases).values({
      reference: 'CASE-OTHER',
      origin: 'support_message',
      senderEmail: 'other@example.com',
      message: 'Hi',
    });

    await retireUserByAuthId(harness.database.db, 'auth_ada');

    const [other] = await harness.database.db
      .select({ v: supportCases.senderEmail })
      .from(supportCases)
      .where(eq(supportCases.reference, 'CASE-OTHER'));

    expect(other?.v).toBe('other@example.com');
  });

  it('finds no case when the console searches the old email, but the reference still finds it', async () => {
    await seedVendorWithTraces();
    await harness.database.db.insert(supportCases).values({
      reference: 'CASE-SIGNED-OUT',
      origin: 'support_message',
      senderEmail: EMAIL.toUpperCase(),
      message: 'I cannot sign in',
    });

    expect(await searchCases(EMAIL)).toEqual(['CASE-672', 'CASE-SIGNED-OUT']);

    await retireUserByAuthId(harness.database.db, 'auth_ada');

    expect(await searchCases(EMAIL)).toEqual([]);
    expect(await searchCases('CASE-672')).toEqual(['CASE-672']);
    expect(await searchCases('CASE-SIGNED-OUT')).toEqual(['CASE-SIGNED-OUT']);
  });

  it('gives a chargeback case, which has no sender address, none', async () => {
    const id = await seedVendorWithTraces();
    await harness.database.db.insert(supportCases).values({
      reference: 'CASE-CHARGEBACK',
      origin: 'chargeback',
      senderUserId: id,
      message: 'Dispute opened',
    });

    await retireUserByAuthId(harness.database.db, 'auth_ada');

    const [chargeback] = await harness.database.db
      .select({ v: supportCases.senderEmail })
      .from(supportCases)
      .where(eq(supportCases.reference, 'CASE-CHARGEBACK'));

    expect(chargeback?.v).toBeNull();
  });
});

describe('a send that was in flight when the account closed (VEN-672)', () => {
  it('records the delivery under the tombstone, not the address it was sent to', async () => {
    const id = await seedVendorWithTraces();
    await retireUserByAuthId(harness.database.db, 'auth_ada');

    await insertEmailDelivery(harness.database.db, {
      notificationId: crypto.randomUUID(),
      userId: id,
      recipientEmail: EMAIL,
      notificationType: 'stripe_onboarding_complete',
      outcome: 'sent',
    });

    const rows = await harness.database.db
      .select({ v: emailDeliveries.recipientEmail })
      .from(emailDeliveries);

    expect(rows).toEqual([{ v: `closed+${id}@invalid` }, { v: `closed+${id}@invalid` }]);
  });

  it('records a live account under the address it was sent to', async () => {
    const id = await seedVendorWithTraces();

    await insertEmailDelivery(harness.database.db, {
      notificationId: crypto.randomUUID(),
      userId: id,
      recipientEmail: 'sent.to@example.com',
      notificationType: 'stripe_onboarding_complete',
      outcome: 'sent',
    });

    const rows = await harness.database.db
      .select({ v: emailDeliveries.recipientEmail })
      .from(emailDeliveries);

    expect(rows.map((row) => row.v).sort()).toEqual([EMAIL, 'sent.to@example.com']);
  });
});

describe('the backfill for accounts closed before VEN-672', () => {
  it('cleans them, and a second run changes nothing', async () => {
    const id = await seedVendorWithTraces();
    await harness.database.db
      .update(users)
      .set({ deletedAt: sql`now()` })
      .where(eq(users.id, id));

    await runBackfill();

    const expected = {
      delivery: [{ v: `closed+${id}@invalid` }],
      support: [{ v: `closed+${id}@invalid` }],
      profile: [{ v: null, latitude: null, longitude: null }],
    };
    expect(await traces()).toEqual(expected);

    await runBackfill();

    expect(await traces()).toEqual(expected);
  });

  it('leaves a live account alone', async () => {
    await seedVendorWithTraces();

    await runBackfill();

    expect(await traces()).toEqual({
      delivery: [{ v: EMAIL }],
      support: [{ v: EMAIL }],
      profile: [{ v: ADDRESS, latitude: '51.50735000', longitude: '-0.12776000' }],
    });
  });
});
