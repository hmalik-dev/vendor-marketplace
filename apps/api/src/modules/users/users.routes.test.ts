import { eq, sql } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const CUSTOMER_AUTH_ID = 'user_customer';
const VENDOR_AUTH_ID = 'user_vendor';
const AMPERSAND_AUTH_ID = 'user_ampersand';

describe('/users/me', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();

    harness.authUsers.set(CUSTOMER_AUTH_ID, {
      authUserId: CUSTOMER_AUTH_ID,
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      roleHint: 'customer',
      avatarUrl: null,
    });
    harness.authUsers.set(VENDOR_AUTH_ID, {
      authUserId: VENDOR_AUTH_ID,
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
      const response = await harness.app.inject({ method: 'GET', url: '/v1/users/me' });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ statusCode: 401, error: 'UNAUTHORIZED' });
    });

    it('rejects a token it cannot verify', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { authorization: 'Bearer expired-nonsense' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('UNAUTHORIZED');
    });

    it('answers GET and PUT for an address the strict email check refuses', async () => {
      harness.authUsers.set(AMPERSAND_AUTH_ID, {
        authUserId: AMPERSAND_AUTH_ID,
        email: 'first&last@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        roleHint: 'customer',
        avatarUrl: null,
      });

      const read = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(AMPERSAND_AUTH_ID),
      });
      const written = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(AMPERSAND_AUTH_ID),
        payload: { firstName: 'Augusta' },
      });

      expect(read.statusCode).toBe(200);
      expect(read.json().email).toBe('first&last@example.com');
      expect(written.statusCode).toBe(200);
      expect(written.json()).toMatchObject({
        firstName: 'Augusta',
        email: 'first&last@example.com',
      });
    });

    it('lazily creates the local user when the webhook has not landed yet', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        authUserId: CUSTOMER_AUTH_ID,
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
        .where(eq(users.authUserId, CUSTOMER_AUTH_ID));
      expect(rows).toHaveLength(1);
    });

    it('reuses the existing row on a second call rather than inserting again', async () => {
      await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
      });
      const second = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
      });

      expect(second.statusCode).toBe(200);

      const rows = await harness.database.db
        .select()
        .from(users)
        .where(eq(users.authUserId, CUSTOMER_AUTH_ID));
      expect(rows).toHaveLength(1);
    });

    it('never exposes an admin role chosen in client-writable auth metadata', async () => {
      harness.authUsers.set('user_escalate', {
        authUserId: 'user_escalate',
        email: 'mallory@example.com',
        firstName: 'Mallory',
        lastName: 'Nguyen',
        // auth `unsafeMetadata` is writable by the account holder.
        roleHint: 'admin',
        avatarUrl: null,
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer('user_escalate'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().role).toBe('customer');
    });

    it('serializes an auth identity that carries no name', async () => {
      /*
       * The auth provider's email-and-password sign-up does not collect a name, so
       * `first_name` arrives null and the lazily created row has none. The
       * response schema has to tolerate that — it previously required a
       * non-empty name and answered its own freshly created user with a 500.
       */
      harness.authUsers.set('user_nameless', {
        authUserId: 'user_nameless',
        email: 'nameless@example.com',
        firstName: '',
        lastName: '',
        roleHint: 'vendor',
        avatarUrl: null,
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
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
      harness.authUsers.set('user_nameless2', {
        authUserId: 'user_nameless2',
        email: 'nameless2@example.com',
        firstName: '',
        lastName: '',
        roleHint: 'customer',
        avatarUrl: null,
      });
      await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer('user_nameless2'),
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer('user_nameless2'),
        payload: { firstName: 'Katherine', lastName: 'Johnson' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ firstName: 'Katherine', lastName: 'Johnson' });

      /*
       * VEN-642, AC8: the Neon Auth identity itself, not only `users` — read
       * back rather than inferred, so the sign-up form's synthetic
       * email-prefix placeholder does not survive the next reconcile pass
       * (`auth-sync.reconcile.ts` mirrors the identity's name back onto
       * `users` the moment they disagree).
       */
      expect(harness.authUsers.get('user_nameless2')).toMatchObject({
        firstName: 'Katherine',
        lastName: 'Johnson',
      });
    });

    it('refuses a suspended account', async () => {
      await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(VENDOR_AUTH_ID),
      });
      await harness.database.db
        .update(users)
        .set({ isBanned: true })
        .where(eq(users.authUserId, VENDOR_AUTH_ID));

      const response = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(VENDOR_AUTH_ID),
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('PUT', () => {
    async function signIn(authUserId: string): Promise<void> {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(authUserId),
      });
      expect(response.statusCode).toBe(200);
    }

    /** The `users.id` the upload route writes into the owner segment of a key. */
    async function userIdOf(authUserId: string): Promise<string> {
      const [row] = await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.authUserId, authUserId));

      return row!.id;
    }

    it('refuses a minimum guest count above the stored maximum (VEN-544)', async () => {
      await signIn(CUSTOMER_AUTH_ID);
      const stored = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { typicalGuestCountMin: 10, typicalGuestCountMax: 100 },
      });
      expect(stored.statusCode).toBe(200);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { typicalGuestCountMin: 500 },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe(
        'Minimum guest count must not exceed maximum guest count',
      );

      const reloaded = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
      });
      expect(reloaded.json()).toMatchObject({
        typicalGuestCountMin: 10,
        typicalGuestCountMax: 100,
      });
    });

    it('refuses a maximum guest count below the stored minimum (VEN-544)', async () => {
      await signIn(CUSTOMER_AUTH_ID);
      await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { typicalGuestCountMin: 50, typicalGuestCountMax: 100 },
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { typicalGuestCountMax: 20 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('still reads back a row stored before the refusal existed (VEN-544)', async () => {
      await signIn(CUSTOMER_AUTH_ID);
      await harness.database.db
        .update(users)
        .set({ firstName: 'Jo\u200bhn', phone: '()-. ()' })
        .where(eq(users.id, await userIdOf(CUSTOMER_AUTH_ID)));

      const response = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ firstName: 'Jo\u200bhn', phone: '()-. ()' });
    });

    it('refuses a NUL byte in a name with a 400, not a 500 (VEN-544)', async () => {
      await signIn(CUSTOMER_AUTH_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { firstName: 'a\u0000b' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('updates the fields a user owns', async () => {
      await signIn(CUSTOMER_AUTH_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { firstName: 'Ada', lastName: 'Byron', phone: '+15551234567' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ lastName: 'Byron', phone: '+15551234567' });
    });

    /*
     * VEN-703: the account settings name page writes through this route for
     * every role, so each role is asserted, not assumed.
     */
    it.each(['customer', 'vendor', 'admin'] as const)(
      'lets a %s change their own name and nothing else of theirs',
      async (role) => {
        const authId = role === 'customer' ? CUSTOMER_AUTH_ID : VENDOR_AUTH_ID;
        await signIn(authId);
        // Only the admin grant path may change a role; the test opens it for its own transaction.
        await harness.database.db.transaction(async (tx) => {
          await tx.execute(sql`select set_config('app.operator_role_grant', 'on', true)`);
          await tx.update(users).set({ role }).where(eq(users.authUserId, authId));
        });

        const response = await harness.app.inject({
          method: 'PUT',
          url: '/v1/users/me',
          headers: bearer(authId),
          payload: { firstName: 'Augusta', lastName: 'King' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ firstName: 'Augusta', lastName: 'King', role });
      },
    );

    it.each([
      ['a blank first name', { firstName: '   ', lastName: 'King' }],
      ['a blank last name', { firstName: 'Augusta', lastName: '' }],
      ['a first name over the length limit', { firstName: 'a'.repeat(101), lastName: 'King' }],
      ['a last name over the length limit', { firstName: 'Augusta', lastName: 'a'.repeat(101) }],
    ])('refuses %s', async (_name, payload) => {
      await signIn(CUSTOMER_AUTH_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it("cannot edit another user's name by naming their id", async () => {
      await signIn(CUSTOMER_AUTH_ID);
      await signIn(VENDOR_AUTH_ID);
      const vendorId = await userIdOf(VENDOR_AUTH_ID);
      const readVendor = () =>
        harness.database.db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, vendorId));
      const before = await readVendor();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { id: vendorId, firstName: 'Mallory', lastName: 'Intruder' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ firstName: 'Mallory', lastName: 'Intruder' });
      expect(await readVendor()).toEqual(before);
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
      await signIn(CUSTOMER_AUTH_ID);

      // The owner segment is the caller's own `users.id`, exactly as the upload
      // route mints it — anything else is now refused (#407).
      const avatarUrl = `customer-profile/${await userIdOf(CUSTOMER_AUTH_ID)}/0f4a1c2e.webp`;

      const saved = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { firstName: 'Ada', lastName: 'Byron', avatarUrl },
      });

      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toMatchObject({ avatarUrl });

      // Survives the reload: the read model has to accept it too.
      const reloaded = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
      });

      expect(reloaded.statusCode).toBe(200);
      expect(reloaded.json().avatarUrl).toBe(avatarUrl);
    });

    /*
     * VEN-648: sent as `<STORAGE_PUBLIC_URL>/<key>`, stored as the key. A host
     * in the row would read as a provider avatar, which the next sign-in
     * overwrites with the provider's image.
     */
    it('stores an avatar sent as a storage URL as its key', async () => {
      await signIn(CUSTOMER_AUTH_ID);
      const key = `customer-profile/${await userIdOf(CUSTOMER_AUTH_ID)}/0f4a1c2e.webp`;

      const saved = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        // `STORAGE_PUBLIC_URL` is `http://cdn.test` in the harness.
        payload: { avatarUrl: `http://cdn.test/${key}` },
      });

      expect(saved.statusCode).toBe(200);
      expect(saved.json().avatarUrl).toBe(key);
      const [row] = await harness.database.db
        .select({ avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.authUserId, CUSTOMER_AUTH_ID));
      expect(row).toEqual({ avatarUrl: key });
    });

    /* #407 — the write guard on `avatarUrl`. See `assertOwnedImageRefs`. */
    it('refuses an avatar naming an object minted for another account', async () => {
      await signIn(CUSTOMER_AUTH_ID);
      // The other account has to exist for its key to have a real owner segment.
      await signIn(VENDOR_AUTH_ID);
      const theirs = await userIdOf(VENDOR_AUTH_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { firstName: 'Ada', avatarUrl: `customer-profile/${theirs}/stolen.webp` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe('That image belongs to another account');
    });

    /*
     * The two references that carry no owner still pass: seeded marketing art
     * is a site-relative path, and an auth avatar is an absolute URL on a host
     * that is not ours. Refusing "not mine" rather than "someone else's" would
     * have locked both out.
     */
    it('still accepts a reference that carries no owner at all', async () => {
      await signIn(CUSTOMER_AUTH_ID);

      for (const avatarUrl of ['/images/placeholder-avatar.webp', 'https://img.auth.com/a.png']) {
        const response = await harness.app.inject({
          method: 'PUT',
          url: '/v1/users/me',
          headers: bearer(CUSTOMER_AUTH_ID),
          payload: { firstName: 'Ada', avatarUrl },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().avatarUrl).toBe(avatarUrl);
      }
    });

    it('still refuses an avatar reference that would reach an img src', async () => {
      await signIn(CUSTOMER_AUTH_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { firstName: 'Ada', lastName: 'Byron', avatarUrl: 'javascript:alert(1)' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an empty body', async () => {
      await signIn(CUSTOMER_AUTH_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ statusCode: 400, error: 'VALIDATION_ERROR' });
    });

    it('rejects a guest range whose minimum exceeds its maximum', async () => {
      await signIn(CUSTOMER_AUTH_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
        payload: { typicalGuestCountMin: 200, typicalGuestCountMax: 50 },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('ignores fields outside the self-service contract', async () => {
      await signIn(CUSTOMER_AUTH_ID);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/v1/users/me',
        headers: bearer(CUSTOMER_AUTH_ID),
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
        url: '/v1/users/me',
        payload: { firstName: 'Nobody' },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
