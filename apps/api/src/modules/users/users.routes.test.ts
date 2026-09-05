import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const CUSTOMER_CLERK_ID = 'user_customer';
const VENDOR_CLERK_ID = 'user_vendor';

describe('/users/me', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();

    harness.clerkUsers.set(CUSTOMER_CLERK_ID, {
      clerkUserId: CUSTOMER_CLERK_ID,
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      roleHint: 'customer',
      avatarUrl: null,
    });
    harness.clerkUsers.set(VENDOR_CLERK_ID, {
      clerkUserId: VENDOR_CLERK_ID,
      email: 'grace@example.com',
      firstName: 'Grace',
      lastName: 'Hopper',
      roleHint: 'vendor',
      avatarUrl: 'https://images.example.com/grace.png',
    });
  });

  afterEach(async () => {
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('GET', () => {
    it('rejects a request with no token', async () => {
      const response = await harness.app.inject({ method: 'GET', url: '/users/me' });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ statusCode: 401, error: 'UNAUTHORIZED' });
    });

    it('rejects a token it cannot verify', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: 'Bearer expired-nonsense' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('UNAUTHORIZED');
    });

    it('lazily creates the local user when the webhook has not landed yet', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        clerkUserId: CUSTOMER_CLERK_ID,
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: 'customer',
        avgCustomerRating: 0,
        isBanned: false,
      });

      const rows = await harness.database.db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, CUSTOMER_CLERK_ID));
      expect(rows).toHaveLength(1);
    });

    it('reuses the existing row on a second call rather than inserting again', async () => {
      await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
      });
      const second = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
      });

      expect(second.statusCode).toBe(200);

      const rows = await harness.database.db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, CUSTOMER_CLERK_ID));
      expect(rows).toHaveLength(1);
    });

    it('never exposes an admin role chosen in client-writable Clerk metadata', async () => {
      harness.clerkUsers.set('user_escalate', {
        clerkUserId: 'user_escalate',
        email: 'mallory@example.com',
        firstName: 'Mallory',
        lastName: 'Nguyen',
        // Clerk `unsafeMetadata` is writable by the account holder.
        roleHint: 'admin',
        avatarUrl: null,
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer('user_escalate'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().role).toBe('customer');
    });

    it('serializes a Clerk identity that carries no name', async () => {
      /*
       * Clerk's email-and-password sign-up does not collect a name, so
       * `first_name` arrives null and the lazily created row has none. The
       * response schema has to tolerate that — it previously required a
       * non-empty name and answered its own freshly created user with a 500.
       */
      harness.clerkUsers.set('user_nameless', {
        clerkUserId: 'user_nameless',
        email: 'nameless@example.com',
        firstName: '',
        lastName: '',
        roleHint: 'vendor',
        avatarUrl: null,
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer('user_nameless'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        email: 'nameless@example.com',
        firstName: '',
        lastName: '',
        role: 'vendor',
      });
    });

    it('lets a nameless user fill their name in afterwards', async () => {
      harness.clerkUsers.set('user_nameless2', {
        clerkUserId: 'user_nameless2',
        email: 'nameless2@example.com',
        firstName: '',
        lastName: '',
        roleHint: 'customer',
        avatarUrl: null,
      });
      await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer('user_nameless2'),
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: bearer('user_nameless2'),
        payload: { firstName: 'Katherine', lastName: 'Johnson' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ firstName: 'Katherine', lastName: 'Johnson' });
    });

    it('refuses a suspended account', async () => {
      await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(VENDOR_CLERK_ID),
      });
      await harness.database.db
        .update(users)
        .set({ isBanned: true })
        .where(eq(users.clerkUserId, VENDOR_CLERK_ID));

      const response = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(VENDOR_CLERK_ID),
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe('FORBIDDEN');
    });
  });

  describe('PUT', () => {
    async function signIn(clerkUserId: string): Promise<void> {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(clerkUserId),
      });
      expect(response.statusCode).toBe(200);
    }

    /** The `users.id` the upload route writes into the owner segment of a key. */
    async function userIdOf(clerkUserId: string): Promise<string> {
      const [row] = await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId));

      return row!.id;
    }

    it('updates the fields a user owns', async () => {
      await signIn(CUSTOMER_CLERK_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
        payload: { firstName: 'Ada', lastName: 'Byron', phone: '+15551234567' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ lastName: 'Byron', phone: '+15551234567' });
    });

    /*
     * #170. An upload returns an object key, so the key is what the profile
     * form sends back. Both the request body and the 200 response are
     * schema-validated, so a URL-only rule fails the save on the way in and
     * the read on the way out — which is why the customer's photo could not
     * persist even once the 403 was fixed. Asserted through the route rather
     * than the schema because it is the round trip that was broken.
     */
    it('stores the object key an upload returns, and reads it back', async () => {
      await signIn(CUSTOMER_CLERK_ID);

      // The owner segment is the caller's own `users.id`, exactly as the upload
      // route mints it — anything else is now refused (#407).
      const avatarUrl = `customer-profile/${await userIdOf(CUSTOMER_CLERK_ID)}/0f4a1c2e.webp`;

      const saved = await harness.app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
        payload: { firstName: 'Ada', lastName: 'Byron', avatarUrl },
      });

      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toMatchObject({ avatarUrl });

      // Survives the reload: the read model has to accept it too.
      const reloaded = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
      });

      expect(reloaded.statusCode).toBe(200);
      expect(reloaded.json().avatarUrl).toBe(avatarUrl);
    });

    /* #407 — the write guard on `avatarUrl`. See `assertOwnedImageRefs`. */
    it('refuses an avatar naming an object minted for another account', async () => {
      await signIn(CUSTOMER_CLERK_ID);
      // The other account has to exist for its key to have a real owner segment.
      await signIn(VENDOR_CLERK_ID);
      const theirs = await userIdOf(VENDOR_CLERK_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
        payload: { firstName: 'Ada', avatarUrl: `customer-profile/${theirs}/stolen.webp` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe('That image belongs to another account');
    });

    /*
     * The two references that carry no owner still pass: seeded marketing art
     * is a site-relative path, and a Clerk avatar is an absolute URL on a host
     * that is not ours. Refusing "not mine" rather than "someone else's" would
     * have locked both out.
     */
    it('still accepts a reference that carries no owner at all', async () => {
      await signIn(CUSTOMER_CLERK_ID);

      for (const avatarUrl of ['/images/placeholder-avatar.webp', 'https://img.clerk.com/a.png']) {
        const response = await harness.app.inject({
          method: 'PUT',
          url: '/users/me',
          headers: bearer(CUSTOMER_CLERK_ID),
          payload: { firstName: 'Ada', avatarUrl },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().avatarUrl).toBe(avatarUrl);
      }
    });

    it('still refuses an avatar reference that would reach an img src', async () => {
      await signIn(CUSTOMER_CLERK_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
        payload: { firstName: 'Ada', lastName: 'Byron', avatarUrl: 'javascript:alert(1)' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an empty body', async () => {
      await signIn(CUSTOMER_CLERK_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ statusCode: 400, error: 'VALIDATION_ERROR' });
    });

    it('rejects a guest range whose minimum exceeds its maximum', async () => {
      await signIn(CUSTOMER_CLERK_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
        payload: { typicalGuestCountMin: 200, typicalGuestCountMax: 50 },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('ignores fields outside the self-service contract', async () => {
      await signIn(CUSTOMER_CLERK_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: bearer(CUSTOMER_CLERK_ID),
        payload: { firstName: 'Ada', role: 'admin', isBanned: true, completedBookingsCount: 99 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        role: 'customer',
        isBanned: false,
        completedBookingsCount: 0,
      });
    });

    it('rejects an unauthenticated update', async () => {
      const response = await harness.app.inject({
        method: 'PUT',
        url: '/users/me',
        payload: { firstName: 'Nobody' },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
