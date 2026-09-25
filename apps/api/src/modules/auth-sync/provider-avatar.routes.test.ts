import { setUserRole } from '../../testing/set-user-role.js';
import { eq } from 'drizzle-orm';
import {
  bookingRequests,
  conversations,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

/*
 * VEN-538. A stored avatar that the write-side schema would refuse — a row from
 * before the provider value was validated — must not make a response fail
 * serialisation for the person who reads it.
 */
const BAD_AVATAR = 'javascript:alert(1)';

describe('a stored provider avatar the write schema would refuse', () => {
  let harness: TestHarness;
  let requestId: string;

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [authUserId, firstName] of [
      ['avatar-customer', 'Rosa'],
      ['avatar-vendor', 'Dana'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName,
        lastName: 'Rivera',
        roleHint: 'customer',
        avatarUrl: null,
      });
    }

    const customerId = await signInAs(harness, 'avatar-customer');
    const vendorUserId = await signInAs(harness, 'avatar-vendor');
    const db = harness.database.db;

    await setUserRole(db, 'vendor', eq(users.id, vendorUserId));
    const [vendor] = await db
      .insert(vendorProfiles)
      .values({
        userId: vendorUserId,
        businessName: 'Wren & Field',
        slug: 'wren-field-avatar',
        profileImageUrl: BAD_AVATAR,
      })
      .returning({ id: vendorProfiles.id });
    const [request] = await db
      .insert(bookingRequests)
      .values({ customerId, vendorId: vendor!.id, eventDate: '2027-06-14', status: 'pending' })
      .returning({ id: bookingRequests.id });
    requestId = request!.id;
    await db
      .insert(conversations)
      .values({ customerId, vendorId: vendor!.id, bookingRequestId: requestId });
    await db.update(users).set({ avatarUrl: BAD_AVATAR }).where(eq(users.id, customerId));
  });

  afterAll(async () => {
    await harness.close();
  });

  const read = (url: string, authUserId: string) =>
    harness.app.inject({ method: 'GET', url, headers: bearer(authUserId) });

  it('still answers GET /users/me for its owner', async () => {
    const response = await read('/v1/users/me', 'avatar-customer');

    expect(response.statusCode).toBe(200);
    expect(response.json().avatarUrl).toBe(BAD_AVATAR);
  });

  it('still answers GET /conversations for the other party', async () => {
    const response = await read('/v1/conversations', 'avatar-vendor');

    expect(response.statusCode).toBe(200);
    expect(response.json().items[0].otherPartyAvatarUrl).toBe(BAD_AVATAR);
  });

  it('still answers GET /booking-requests/:id for both parties', async () => {
    const asVendor = await read(`/v1/booking-requests/${requestId}`, 'avatar-vendor');
    const asCustomer = await read(`/v1/booking-requests/${requestId}`, 'avatar-customer');

    expect(asVendor.statusCode).toBe(200);
    expect(asCustomer.statusCode).toBe(200);
    expect(asCustomer.json().vendor.avatarUrl).toBe(BAD_AVATAR);
  });
});
