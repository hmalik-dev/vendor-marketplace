import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  servicePackages,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { addDays, todayDateString, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';

interface DashboardBody {
  newRequestCount: number;
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  responseRate: number | null;
  avgRating: number;
  reviewCount: number;
  earningsThisMonthCents: number;
  isPublished: boolean;
  publishBlockers: string[];
  todaysBookings: { customerFirstName: string }[];
}

describe('/vendor/dashboard', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function read(actor = VENDOR): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method: 'GET',
      url: '/vendor/dashboard',
      headers: bearer(actor),
    });
  }

  /** A profile that satisfies every blocker except the ones named. */
  async function createProfile(): Promise<string> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
        responseTimeHours: 4,
      },
    });
    expect(response.statusCode).toBe(201);

    return response.json().id;
  }

  async function addPackage(): Promise<string> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
        priceType: 'fixed',
        inclusions: ['6 hours'],
      },
    });
    expect(created.statusCode).toBe(201);

    return created.json().id;
  }

  /** A request can only be sent to a published vendor. */
  async function publish(vendorId: string): Promise<void> {
    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true })
      .where(eq(vendorProfiles.id, vendorId));
  }

  /**
   * One request per event date. A repeat submission for a date this customer
   * already has a live request on is deduped by the API, so a test that wants
   * two distinct requests has to ask about two distinct days.
   */
  async function request(vendorId: string, packageId: string, dayOffset: number): Promise<string> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId,
        packageId,
        eventDate: toDateString(addDays(new Date(), dayOffset)),
        eventType: 'wedding',
      },
    });
    expect(created.statusCode).toBe(201);

    return created.json().id;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email,
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
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(servicePackages);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('rejects an unauthenticated read', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/vendor/dashboard' });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a customer', async () => {
    expect((await read(CUSTOMER)).statusCode).toBe(403);
  });

  /*
   * A brand-new vendor's dashboard must be honest rather than encouraging:
   * every figure is a true zero and the response rate is absent, not 0%.
   */
  it('reports honest zeroes for a vendor nobody has asked yet', async () => {
    await createProfile();

    const body = (await read()).json() as DashboardBody;

    expect(body.newRequestCount).toBe(0);
    expect(body.bookingsThisMonth).toBe(0);
    expect(body.earningsThisMonthCents).toBe(0);
    expect(body.reviewCount).toBe(0);
    // Not 0 — nobody has asked, so there is no rate to report.
    expect(body.responseRate).toBeNull();
    expect(body.todaysBookings).toEqual([]);
  });

  it('counts the requests still waiting on this vendor', async () => {
    const vendorId = await createProfile();
    const packageId = await addPackage();
    await publish(vendorId);
    await request(vendorId, packageId, 30);
    await request(vendorId, packageId, 31);

    expect(((await read()).json() as DashboardBody).newRequestCount).toBe(2);
  });

  it('stops counting a request once it has been answered', async () => {
    const vendorId = await createProfile();
    const packageId = await addPackage();
    await publish(vendorId);
    const requestId = await request(vendorId, packageId, 30);

    await harness.app.inject({
      method: 'POST',
      url: `/booking-requests/${requestId}/decline`,
      headers: bearer(VENDOR),
    });

    const body = (await read()).json() as DashboardBody;
    expect(body.newRequestCount).toBe(0);
    // One offered, one answered.
    expect(body.responseRate).toBe(1);
  });

  it('counts an unanswered request against the rate, and a withdrawn one not at all', async () => {
    const vendorId = await createProfile();
    const packageId = await addPackage();
    await publish(vendorId);
    const answered = await request(vendorId, packageId, 30);
    await request(vendorId, packageId, 31);
    const withdrawn = await request(vendorId, packageId, 32);

    await harness.app.inject({
      method: 'POST',
      url: `/booking-requests/${answered}/decline`,
      headers: bearer(VENDOR),
    });
    // The vendor was never given the chance on this one.
    await harness.app.inject({
      method: 'POST',
      url: `/booking-requests/${withdrawn}/cancel`,
      headers: bearer(CUSTOMER),
    });

    // 1 answered of 2 offered; the cancelled request is in neither half.
    expect(((await read()).json() as DashboardBody).responseRate).toBe(0.5);
  });

  it('reports the payout share, not the gross the customer paid', async () => {
    const vendorId = await createProfile();
    const packageId = await addPackage();
    await publish(vendorId);
    const requestId = await request(vendorId, packageId, 30);

    const customer = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, CUSTOMER));

    await harness.database.db.insert(bookings).values({
      requestId,
      customerId: customer[0]!.id,
      vendorId,
      eventDate: todayDateString(),
      totalAmountCents: 145_000,
      platformFeeCents: 17_400,
      vendorPayoutCents: 127_600,
      paidAt: new Date(),
    });

    const body = (await read()).json() as DashboardBody;

    expect(body.earningsThisMonthCents).toBe(127_600);
    expect(body.bookingsThisMonth).toBe(1);
    expect(body.todaysBookings).toHaveLength(1);
    expect(body.todaysBookings[0]?.customerFirstName).toBe('Test');
  });

  /*
   * The acceptance that matters most here: a checklist which disagrees with
   * the gate tells a vendor they are ready when publishing will refuse them.
   * Each blocker is provoked in turn and asserted to appear.
   */
  describe('the checklist is the real publish gate', () => {
    it('names a missing package while everything else is satisfied', async () => {
      await createProfile();

      const body = (await read()).json() as DashboardBody;

      expect(body.publishBlockers).toEqual(['packages']);
      expect(body.isPublished).toBe(false);
    });

    it('clears once the package exists', async () => {
      await createProfile();
      await addPackage();

      expect(((await read()).json() as DashboardBody).publishBlockers).toEqual([]);
    });

    it.each([
      ['bio', { bio: null }],
      ['location', { city: null }],
      ['responseTime', { responseTimeHours: null }],
    ] as const)('names %s when it is missing', async (blocker, patch) => {
      const vendorId = await createProfile();
      await addPackage();

      await harness.database.db
        .update(vendorProfiles)
        .set(patch)
        .where(eq(vendorProfiles.id, vendorId));

      expect(((await read()).json() as DashboardBody).publishBlockers).toContain(blocker);
    });
  });
});
