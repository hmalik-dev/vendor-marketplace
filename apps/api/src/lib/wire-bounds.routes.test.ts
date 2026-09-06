import {
  availability,
  bookingRequests,
  categories,
  conversations,
  notifications,
  tagSuggestions,
  tags,
  users,
  vendorProfiles,
  vendorTags,
} from '@vendor-marketplace/db/schema';
import {
  MAX_BUSINESS_NAME_LENGTH,
  MAX_DISPLAY_ORDER,
  MAX_NAME_LENGTH,
  MAX_NOTIFICATION_TITLE_LENGTH,
  MAX_PAGE_SIZE,
  MAX_SLUG_LENGTH,
  MAX_TAG_SLUG_LENGTH,
  addDays,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../testing/test-server.js';

/**
 * **Every schema bound has to agree with the column behind it.**
 *
 * The class #408 groups: a value the wire schema accepts is wider than the
 * column that stores it, so an ordinary input answers 500 — and, for the three
 * notification titles, answers it *after* the state transition has already
 * committed. Each test here drives a real route with the **longest legal
 * value** for its field, which is the input a bounds test is worth writing for
 * and the one no suite had.
 */
describe('wire bounds agree with their columns', () => {
  let harness: TestHarness;
  let photographyId: string;

  const VENDOR = 'user_bounds_vendor';
  const OTHER_VENDOR = 'user_bounds_vendor_two';
  const CUSTOMER = 'user_bounds_customer';
  const ADMIN = 'user_bounds_admin';

  const EVENT_DATE = toDateString(addDays(new Date(), 30));

  /** A business name at exactly the column's limit — the case that overflowed. */
  const LONGEST_BUSINESS_NAME = 'A'.repeat(MAX_BUSINESS_NAME_LENGTH);

  /** A well-formed id that names nothing — the read must 400 before it 404s. */
  const NIL_UUID = '11111111-1111-4111-8111-111111111111';

  async function createVendorProfile(clerkUserId: string, businessName: string): Promise<string> {
    const profile = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(clerkUserId),
      payload: {
        businessName,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
      },
    });
    expect(profile.statusCode, profile.body).toBe(201);
    const vendorId = profile.json().id as string;

    const servicePackage = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(clerkUserId),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
      },
    });
    expect(servicePackage.statusCode, servicePackage.body).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    return vendorId;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [VENDOR, 'vendor'],
      [OTHER_VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
      [ADMIN, 'admin'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
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

  /**
   * `role = 'admin'` is not reachable from a sign-in: the lazy sync reads
   * Clerk's hint and falls back to `customer`, and the column is immutable
   * afterwards. The console suite promotes in the database for the same reason.
   */
  async function signInAsAdmin(): Promise<void> {
    const me = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(ADMIN),
    });
    expect(me.statusCode).toBe(200);

    await harness.database.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.clerkUserId, ADMIN));
  }

  afterEach(async () => {
    harness.email.sent.length = 0;
    harness.email.deliveredKeys.clear();
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorTags);
    await harness.database.db.delete(tagSuggestions);
    await harness.database.db.delete(tags);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  /*
   * The load-bearing one. `applyTransition` and `syncHeldDate` have committed
   * before `announce` runs, so an overflow here left the request `quoted` with
   * the vendor holding a 500, the customer holding nothing, and a retry
   * answering 409 `INVALID_STATE_TRANSITION` because the state really had moved.
   */
  it('quotes a request from a vendor whose name fills the business-name column', async () => {
    const vendorId = await createVendorProfile(VENDOR, LONGEST_BUSINESS_NAME);

    const request = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId,
        eventDate: EVENT_DATE,
        eventType: 'wedding',
        eventLocation: 'Barr Mansion, Austin, TX',
        customDetails: 'Full-day documentary coverage for about a hundred and twenty guests.',
      },
    });
    expect(request.statusCode, request.body).toBe(201);

    const quoted = await harness.app.inject({
      method: 'POST',
      url: `/booking-requests/${request.json().id}/quote`,
      headers: bearer(VENDOR),
      payload: { quotedPriceCents: 145_000 },
    });

    expect(quoted.statusCode).toBe(200);
    expect(quoted.json().status).toBe('quoted');

    const stored = await harness.database.db
      .select({ title: notifications.title, type: notifications.type })
      .from(notifications)
      .where(eq(notifications.type, 'request_quoted'));

    // The title really is longer than the name column it interpolates.
    expect(stored).toHaveLength(1);
    expect(stored[0]!.title).toBe(`${LONGEST_BUSINESS_NAME} sent a quote`);
    expect(stored[0]!.title.length).toBeGreaterThan(MAX_BUSINESS_NAME_LENGTH);
    expect(stored[0]!.title.length).toBeLessThanOrEqual(MAX_NOTIFICATION_TITLE_LENGTH);
  });

  /*
   * `generateSlug` caps the base at `MAX_SLUG_LENGTH`, which is the column
   * width — so the `-2` a collision appends used to push the candidate past it.
   * `slugExists` compared it happily and the insert threw.
   */
  it('resolves a slug collision on the longest legal business name', async () => {
    const first = await createVendorProfile(VENDOR, LONGEST_BUSINESS_NAME);
    const second = await createVendorProfile(OTHER_VENDOR, LONGEST_BUSINESS_NAME);

    const [firstRow, secondRow] = await Promise.all(
      [first, second].map(async (id) => {
        const rows = await harness.database.db
          .select({ slug: vendorProfiles.slug })
          .from(vendorProfiles)
          .where(eq(vendorProfiles.id, id));
        return rows[0]!.slug;
      }),
    );

    expect(firstRow).not.toBe(secondRow);
    expect(secondRow).toMatch(/-2$/);
    for (const slug of [firstRow, secondRow] as string[]) {
      expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
      // Not `studio--2`: the base yields the room, and cleanly.
      expect(slug).not.toContain('--');
    }
  });

  /*
   * `tagSlug` prefixes the category, so a name at its own limit produced a slug
   * nine characters past `varchar(100)`. The transaction rolled back, the admin
   * got an opaque INTERNAL_ERROR, and the suggestion stayed pending forever.
   */
  it('approves a tag suggestion whose name fills the name column', async () => {
    const longestName = 'B'.repeat(MAX_NAME_LENGTH);
    await signInAsAdmin();
    await createVendorProfile(VENDOR, 'Sunlit Studio');

    const vendorUser = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, VENDOR));

    const suggestion = await harness.database.db
      .insert(tagSuggestions)
      .values({ vendorId: vendorUser[0]!.id, suggestedName: longestName, category: 'dietary' })
      .returning({ id: tagSuggestions.id });

    const approved = await harness.app.inject({
      method: 'PUT',
      url: `/admin/tag-suggestions/${suggestion[0]!.id}`,
      headers: bearer(ADMIN),
      payload: { action: 'approve' },
    });

    expect(approved.statusCode).toBe(200);
    expect(approved.json().suggestion.status).toBe('approved');

    const slug: string = approved.json().tag.slug;
    expect(slug).toBe(`dietary-${'b'.repeat(MAX_NAME_LENGTH)}`);
    expect(slug.length).toBeGreaterThan(MAX_NAME_LENGTH);
    expect(slug.length).toBeLessThanOrEqual(MAX_TAG_SLUG_LENGTH);
  });

  /*
   * `displayOrder` is stored in int4 and the schema accepted up to 2^53, so
   * `2147483648` reached the insert and came back as an opaque 500. Every other
   * bounded integer on the wire answers 400; this one now does too.
   */
  it('refuses a displayOrder past int4 with a 400, and accepts the largest one that fits', async () => {
    await createVendorProfile(VENDOR, 'Sunlit Studio');

    const overflow = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
        displayOrder: MAX_DISPLAY_ORDER + 1,
      },
    });

    expect(overflow.statusCode).toBe(400);

    const accepted = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Half day coverage',
        description: 'Three hours of coverage with one photographer on site.',
        priceCents: 95_000,
        displayOrder: MAX_DISPLAY_ORDER,
      },
    });

    expect(accepted.statusCode).toBe(201);
    expect(accepted.json().displayOrder).toBe(MAX_DISPLAY_ORDER);
  });

  /*
   * Portfolio takes the same field through a different service, and the
   * ticket's finding named both — so both are driven rather than one standing
   * in for the other.
   */
  it('refuses a portfolio displayOrder past int4 with a 400', async () => {
    await createVendorProfile(VENDOR, 'Sunlit Studio');

    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/portfolio',
      headers: bearer(VENDOR),
      payload: {
        imageUrl: 'https://images.example.com/one.jpg',
        displayOrder: MAX_DISPLAY_ORDER + 1,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  /*
   * The reads that had no ceiling at all. The window is what bounds the payload,
   * the two joins behind it, and — for `/booking-requests` — how many expiry
   * chains one read can start.
   */
  describe('the four unbounded reads take a page window', () => {
    it('caps /booking-requests at the page size and walks the rest by page', async () => {
      const vendorId = await createVendorProfile(VENDOR, 'Sunlit Studio');

      for (const days of [10, 20, 30]) {
        const created = await harness.app.inject({
          method: 'POST',
          url: '/booking-requests',
          headers: bearer(CUSTOMER),
          payload: {
            vendorId,
            eventDate: toDateString(addDays(new Date(), days)),
            eventType: 'wedding',
            eventLocation: 'Barr Mansion, Austin, TX',
            customDetails: 'Full-day documentary coverage for about a hundred guests.',
          },
        });
        expect(created.statusCode, created.body).toBe(201);
      }

      const first = await harness.app.inject({
        method: 'GET',
        url: '/booking-requests?pageSize=2',
        headers: bearer(CUSTOMER),
      });
      const second = await harness.app.inject({
        method: 'GET',
        url: '/booking-requests?pageSize=2&page=2',
        headers: bearer(CUSTOMER),
      });

      expect(first.statusCode).toBe(200);
      expect(first.json()).toHaveLength(2);
      expect(second.json()).toHaveLength(1);

      // Distinct rows, so the window really is paging rather than re-reading.
      const ids = [...first.json(), ...second.json()].map((row: { id: string }) => row.id);
      expect(new Set(ids).size).toBe(3);
    });

    /*
     * The regression the window itself introduced. `?status=` used to be applied
     * to the rows *after* they came back, which was equivalent while the read
     * was unbounded — and once it is one page, a "page" is the matching subset
     * of a page of all statuses, so it reads empty whenever that page holds none
     * while matches sit further down. At the default page size that made an
     * account's oldest pending request invisible to `?status=pending` outright.
     */
    it('filters by status in the query, not over the page it returned', async () => {
      const vendorId = await createVendorProfile(VENDOR, 'Sunlit Studio');

      const ids: string[] = [];
      for (const days of [10, 20, 30]) {
        const created = await harness.app.inject({
          method: 'POST',
          url: '/booking-requests',
          headers: bearer(CUSTOMER),
          payload: {
            vendorId,
            eventDate: toDateString(addDays(new Date(), days)),
            eventType: 'wedding',
            eventLocation: 'Barr Mansion, Austin, TX',
            customDetails: 'Full-day documentary coverage for about a hundred guests.',
          },
        });
        expect(created.statusCode, created.body).toBe(201);
        ids.push(created.json().id as string);
      }

      /*
       * The two newest are declined, so the only `pending` row is the oldest —
       * off the first page of two, because the queue is newest-first.
       */
      for (const id of ids.slice(1)) {
        const declined = await harness.app.inject({
          method: 'POST',
          url: `/booking-requests/${id}/decline`,
          headers: bearer(VENDOR),
        });
        expect(declined.statusCode, declined.body).toBe(200);
      }

      const pending = await harness.app.inject({
        method: 'GET',
        url: '/booking-requests?status=pending&pageSize=2',
        headers: bearer(CUSTOMER),
      });

      expect(pending.statusCode).toBe(200);
      expect(pending.json()).toHaveLength(1);
      expect(pending.json()[0].id).toBe(ids[0]);
      expect(pending.json()[0].status).toBe('pending');

      // And the complement, from the same window.
      const declined = await harness.app.inject({
        method: 'GET',
        url: '/booking-requests?status=declined&pageSize=2',
        headers: bearer(CUSTOMER),
      });
      expect(declined.json()).toHaveLength(2);
    });

    it('refuses a page size past the ceiling on all four reads', async () => {
      const beyond = MAX_PAGE_SIZE + 1;

      /*
       * All four, including the vendor-facing one behind a relationship gate:
       * the ceiling has to be refused before the gate, not instead of it.
       */
      for (const [url, actor] of [
        ['/booking-requests', CUSTOMER],
        ['/bookings', CUSTOMER],
        ['/customers/me/reviews', CUSTOMER],
        [`/customers/${NIL_UUID}/reviews`, VENDOR],
      ] as const) {
        const response = await harness.app.inject({
          method: 'GET',
          url: `${url}?pageSize=${beyond}`,
          headers: bearer(actor),
        });

        expect(response.statusCode, url).toBe(400);
      }
    });
  });
});
