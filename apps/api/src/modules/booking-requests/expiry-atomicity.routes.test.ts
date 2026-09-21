import {
  availability,
  bookingRequests,
  categories,
  conversations,
  notifications,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import type * as BookingRequestsDao from './booking-requests.dao.js';
import { expireLapsedRequests } from './booking-requests.service.js';

/**
 * **A lapsed accepted request is expired, its date freed and both parties told
 * in one commit** (VEN-536).
 *
 * `findLapsedRequests` selects only unexpired rows, so when the status committed
 * first and the date release then failed, nothing ever retried: the vendor
 * stayed `booked` for a date the request no longer held, and nobody was told.
 */
vi.mock('./booking-requests.dao.js', async () => {
  const actual = await vi.importActual<typeof BookingRequestsDao>('./booking-requests.dao.js');

  return {
    ...actual,
    setHeldDate: async (...args: Parameters<typeof actual.setHeldDate>) =>
      failHeldDateWrites
        ? Promise.reject(new Error('connection terminated'))
        : actual.setHeldDate(...args),
  };
});

/** Flipped per test; the mock above reads it on every call. */
let failHeldDateWrites = false;

describe('expiring an accepted request', () => {
  let harness: TestHarness;
  let photographyId: string;

  const VENDOR = 'user_expiry_vendor';
  const CUSTOMER = 'user_expiry_customer';
  const EVENT_DATE = toDateString(addDays(new Date(), 30));

  const mailDeps = (): Parameters<typeof expireLapsedRequests>[2] => ({
    db: harness.app.db,
    email: harness.app.email,
    log: harness.app.log,
    webOrigin: 'https://web.test',
    background: harness.app.background,
  });

  /** An accepted request whose payment window has already closed. */
  async function lapsedAcceptedRequest(): Promise<{ vendorId: string; requestId: string }> {
    const profile = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
      },
    });
    expect(profile.statusCode, profile.body).toBe(201);
    const vendorId = profile.json().id as string;

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    const pkg = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
        priceType: 'fixed',
        inclusions: ['6 hours', '2 photographers'],
      },
    });
    expect(pkg.statusCode, pkg.body).toBe(201);

    const agreed = await harness.app.inject({
      method: 'POST',
      url: '/vendor/agreement/accept',
      headers: bearer(VENDOR),
      payload: { version: CURRENT_VENDOR_AGREEMENT_VERSION },
    });
    expect(agreed.statusCode, agreed.body).toBe(200);

    const created = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId,
        packageId: pkg.json().id as string,
        eventDate: EVENT_DATE,
        eventType: 'wedding',
        eventLocation: 'Barr Mansion, Austin, TX',
        customDetails: 'Full-day documentary coverage for about a hundred guests.',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const requestId = created.json().id as string;

    const accepted = await harness.app.inject({
      method: 'POST',
      url: `/booking-requests/${requestId}/accept`,
      headers: bearer(VENDOR),
    });
    expect(accepted.statusCode, accepted.body).toBe(200);

    await harness.database.db
      .update(bookingRequests)
      .set({ expiresAt: addDays(new Date(), -1) })
      .where(eq(bookingRequests.id, requestId));

    return { vendorId, requestId };
  }

  async function statusOf(requestId: string): Promise<string | undefined> {
    const [row] = await harness.database.db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, requestId));

    return row?.status;
  }

  async function heldDateStatus(vendorId: string): Promise<string | null> {
    const rows = await harness.database.db
      .select({ status: availability.status, date: availability.date })
      .from(availability)
      .where(eq(availability.vendorId, vendorId));

    return rows.find((cell) => cell.date === EVENT_DATE)?.status ?? null;
  }

  async function expiredNotificationCount(): Promise<number> {
    const rows = await harness.database.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.type, 'request_expired'));

    return rows.length;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [authUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  afterEach(async () => {
    failHeldDateWrites = false;
    harness.email.sent.length = 0;
    harness.email.messageIdsByKey.clear();
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('leaves the request accepted and the date booked when releasing the date fails, and the next sweep finishes it', async () => {
    const { vendorId, requestId } = await lapsedAcceptedRequest();
    expect(await heldDateStatus(vendorId)).toBe('booked');

    failHeldDateWrites = true;
    await expect(expireLapsedRequests(harness.app.db, new Date(), mailDeps())).rejects.toThrow(
      'connection terminated',
    );

    expect(await statusOf(requestId)).toBe('accepted');
    expect(await heldDateStatus(vendorId)).toBe('booked');
    expect(await expiredNotificationCount()).toBe(0);

    failHeldDateWrites = false;
    expect(await expireLapsedRequests(harness.app.db, new Date(), mailDeps())).toBe(1);

    expect(await statusOf(requestId)).toBe('expired');
    expect(await heldDateStatus(vendorId)).toBeNull();
    expect(await expiredNotificationCount()).toBe(2);
  });

  it('announces once when two sweeps race for the same request', async () => {
    const { requestId } = await lapsedAcceptedRequest();
    await harness.flushEmail();
    harness.email.sent.length = 0;

    await Promise.all([
      expireLapsedRequests(harness.app.db, new Date(), mailDeps()),
      expireLapsedRequests(harness.app.db, new Date(), mailDeps()),
    ]);
    await harness.flushEmail();

    expect(await statusOf(requestId)).toBe('expired');
    expect(await expiredNotificationCount()).toBe(2);
    expect(harness.email.sent.map((mail) => mail.subject).sort()).toEqual([
      'A booking was not paid in time',
      'Your booking was not paid in time',
    ]);
  });
});
