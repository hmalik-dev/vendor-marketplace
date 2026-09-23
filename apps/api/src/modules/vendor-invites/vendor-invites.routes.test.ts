import { setUserRole } from '../../testing/set-user-role.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  adminActions,
  categories,
  legalAcceptances,
  platformSettings,
  users,
  vendorApplications,
  vendorInvites,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  CURRENT_TERMS_VERSION,
  VENDOR_SIGN_IN_PATH,
  VENDOR_SIGN_UP_PATH,
} from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  TEST_ENV,
  type TestHarness,
} from '../../testing/test-server.js';
import { forgetPlatformSwitches } from '../platform-settings/platform-settings.service.js';
import {
  renderVendorApplicationConfirmationEmail,
  renderVendorInviteEmail,
  retryFailedApplicationConfirmationEmails,
  vendorNotInvited,
} from './vendor-invites.service.js';

/**
 * The vendor gate (VEN-406): while `vendorInviteOnly` is on, the Terms
 * acceptance creates a vendor account only for an invited address, and never
 * asks a customer.
 *
 * `acceptTerms: false`, like the Terms suite, because the acceptance *is* where
 * an account is created and so where the gate stands.
 */
const ADMIN = 'user_gate_admin';

/** Passed to `accept` to send a body with no `role` at all. */
const NO_ROLE = Symbol('no role');

let identities = 0;
let visitors = 0;

type Response = Awaited<ReturnType<TestHarness['app']['inject']>>;

function fromANewVisitor(): { remoteAddress: string } {
  visitors += 1;
  return { remoteAddress: `10.9.${Math.floor(visitors / 250)}.${visitors % 250}` };
}

/** A syntactically valid uuid that names no row, for the bulk invite's id-shaped tests. */
function fakeId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
}

describe('the vendor gate', () => {
  let harness: TestHarness;

  /** An auth identity nobody has seen, signing up as `role`. */
  function freshIdentity(role: 'vendor' | 'customer', email?: string): string {
    identities += 1;
    const id = `user_gate_${role}_${identities}`;

    harness.authUsers.set(id, {
      authUserId: id,
      email: email ?? `${id}@example.com`,
      firstName: 'Grace',
      lastName: 'Hopper',
      roleHint: role,
      avatarUrl: null,
    });

    return id;
  }

  function inject(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    actor: string | null,
    payload?: Record<string, unknown>,
  ): Promise<Response> {
    return harness.app.inject({
      method,
      url,
      ...(actor ? { headers: bearer(actor) } : {}),
      ...(payload ? { payload } : {}),
    });
  }

  /** The screen's submit: `role` defaults to the one the identity signed up as. */
  function accept(
    actor: string,
    role: unknown = harness.authUsers.get(actor)?.roleHint,
  ): Promise<Response> {
    return inject('POST', '/legal/terms/accept', actor, {
      version: CURRENT_TERMS_VERSION,
      accepted: true,
      ...(role === NO_ROLE ? {} : { role }),
    });
  }

  async function setGate(vendorInviteOnly: boolean): Promise<void> {
    await harness.database.db
      .insert(platformSettings)
      .values({ vendorInviteOnly })
      .onConflictDoUpdate({ target: platformSettings.id, set: { vendorInviteOnly } });
    forgetPlatformSwitches(harness.database.db);
  }

  async function invite(email: string): Promise<void> {
    await harness.database.db.insert(vendorInvites).values({ email });
  }

  async function counts(): Promise<{ users: number; acceptances: number; profiles: number }> {
    const count = async (table: typeof users | typeof legalAcceptances | typeof vendorProfiles) =>
      (await harness.database.db.select({ n: sql<number>`count(*)::int` }).from(table))[0]!.n;

    return {
      users: await count(users),
      acceptances: await count(legalAcceptances),
      profiles: await count(vendorProfiles),
    };
  }

  /** A real, active category id — `category` on the wire is a category id, never free text (VEN-512). */
  let categoryId: string;

  function application(email: string): Record<string, unknown> {
    return {
      email,
      businessName: 'Hopper Florals',
      category: categoryId,
      city: 'Austin',
      state: 'TX',
      message: 'Weddings, mostly.',
    };
  }

  /** `POST /vendor-applications` now requires a session; the body's `email` is always ignored. */
  function apply(actor: string, body: Record<string, unknown>): Promise<Response> {
    return harness.app.inject({
      method: 'POST',
      url: '/vendor-applications',
      ...fromANewVisitor(),
      headers: bearer(actor),
      payload: body,
    });
  }

  /** A fresh, verified vendor session, refused by the gate, applying with its own address. */
  async function refusedVendor(email: string): Promise<{ actor: string; email: string }> {
    const actor = freshIdentity('vendor', email);
    await setGate(true);
    expect((await accept(actor)).statusCode).toBe(403);
    return { actor, email };
  }

  beforeAll(async () => {
    harness = await createTestHarness({ acceptTerms: false });

    const [category] = await harness.database.db
      .insert(categories)
      .values({ name: 'Florist', slug: 'florist' })
      .returning({ id: categories.id });
    categoryId = category!.id;

    harness.authUsers.set(ADMIN, {
      authUserId: ADMIN,
      email: 'gate-admin@example.com',
      firstName: 'Ada',
      lastName: 'Operator',
      roleHint: 'customer',
      avatarUrl: null,
    });
    expect((await accept(ADMIN)).statusCode).toBe(200);
    await setUserRole(harness.database.db, 'admin', eq(users.authUserId, ADMIN));
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorInvites);
    await harness.database.db.delete(vendorApplications);
    await harness.database.db.delete(platformSettings);
    forgetPlatformSwitches(harness.database.db);
    await harness.flushEmail();
    harness.email.sent.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('at the Terms acceptance', () => {
    it('refuses an un-invited vendor with vendor_not_invited, writes no account, and puts them on the waitlist (VEN-512)', async () => {
      await setGate(true);
      const vendor = freshIdentity('vendor', 'refused@example.com');
      const before = await counts();

      const response = await accept(vendor);

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: 'vendor_not_invited' });
      // No `users`, acceptance or `vendor_profiles` row (AC2).
      expect(await counts()).toEqual(before);
      // The waitlist row exists from the verified session email, not the body (AC1, AC5): nothing was sent to accept.
      const [row] = await harness.database.db.select().from(vendorApplications);
      expect(row).toMatchObject({
        email: 'refused@example.com',
        status: 'new',
        businessName: null,
        category: null,
        city: null,
      });
    });

    it('leaves exactly one waitlist row on a repeated refusal, and does not overwrite details already given (AC3)', async () => {
      await setGate(true);
      const vendor = freshIdentity('vendor', 'repeat-refused@example.com');
      expect((await accept(vendor)).statusCode).toBe(403);

      // The person fills in the details screen after the first refusal.
      expect((await apply(vendor, application('anyone@example.com'))).statusCode).toBe(200);

      // Signing in and being refused again must not touch what they already gave.
      expect((await accept(vendor)).statusCode).toBe(403);

      const rows = await harness.database.db.select().from(vendorApplications);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        email: 'repeat-refused@example.com',
        businessName: 'Hopper Florals',
        category: categoryId,
        city: 'Austin',
      });
    });

    it('writes no waitlist row for an invited address, or with the gate off (AC4)', async () => {
      await setGate(true);
      await invite('already-invited@example.com');
      const invited = freshIdentity('vendor', 'already-invited@example.com');
      expect((await accept(invited)).statusCode).toBe(200);
      expect(await harness.database.db.select().from(vendorApplications)).toHaveLength(0);

      await setGate(false);
      const ungated = freshIdentity('vendor', 'ungated@example.com');
      expect((await accept(ungated)).statusCode).toBe(200);
      expect(await harness.database.db.select().from(vendorApplications)).toHaveLength(0);
    });

    it('leaves an existing waitlist row exactly as it was once the gate is switched off (AC7)', async () => {
      const vendor = await refusedVendor('lifted@example.com');
      const [seeded] = await harness.database.db.select().from(vendorApplications);

      await setGate(false);
      const response = await accept(vendor.actor);

      expect(response.statusCode).toBe(200);
      const rows = await harness.database.db.select().from(vendorApplications);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(seeded);
    });

    it('creates a customer exactly as before, gate on and nobody invited', async () => {
      await setGate(true);
      const customer = freshIdentity('customer');

      const response = await accept(customer);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ accepted: true, current: CURRENT_TERMS_VERSION });
      const [row] = await harness.database.db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.authUserId, customer));
      expect(row).toEqual({ role: 'customer' });
      expect((await inject('GET', '/users/me', customer)).statusCode).toBe(200);
    });

    it('creates an invited vendor, matching the address case-insensitively, and stamps the invite', async () => {
      await setGate(true);
      await invite('invited.florist@example.com');
      const vendor = freshIdentity('vendor', 'Invited.Florist@Example.com');

      const response = await accept(vendor);

      expect(response.statusCode).toBe(200);
      const [row] = await harness.database.db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.authUserId, vendor));
      expect(row).toEqual({ role: 'vendor' });
      const [stamped] = await harness.database.db.select().from(vendorInvites);
      expect(stamped!.acceptedAt).toBeInstanceOf(Date);
    });

    it('preselects vendor for an invited address with no remembered role, and still needs the choice', async () => {
      await setGate(true);
      await invite('signed-in-later@example.com');
      const later = freshIdentity('customer', 'signed-in-later@example.com');
      const before = await counts();

      const status = await inject('GET', '/legal/terms', later);
      expect(status.json()).toMatchObject({
        account: { exists: false, role: null },
        suggestedRole: 'vendor',
      });

      const unchosen = await accept(later, NO_ROLE);
      expect(unchosen.statusCode).toBe(400);
      expect(await counts()).toEqual(before);

      expect((await accept(later, 'vendor')).statusCode).toBe(200);
      const [row] = await harness.database.db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.authUserId, later));
      expect(row).toEqual({ role: 'vendor' });
      const [stamped] = await harness.database.db.select().from(vendorInvites);
      expect(stamped!.acceptedAt).toBeInstanceOf(Date);
    });

    it('makes an invited address that chooses customer a customer and leaves the invite unused', async () => {
      await setGate(true);
      await invite('invited-customer@example.com');
      const person = freshIdentity('customer', 'invited-customer@example.com');

      const response = await accept(person, 'customer');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ account: { exists: true, role: 'customer' } });
      const [row] = await harness.database.db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.authUserId, person));
      expect(row).toEqual({ role: 'customer' });
      const [stamped] = await harness.database.db.select().from(vendorInvites);
      expect(stamped!.acceptedAt).toBeNull();
    });

    it('never suggests vendor for an address with no invite', async () => {
      await setGate(true);
      const person = freshIdentity('vendor');

      const status = await inject('GET', '/legal/terms', person);

      expect(status.json()).toMatchObject({ suggestedRole: null });
    });

    it('lets an un-invited vendor in while the gate is off', async () => {
      await setGate(false);
      const vendor = freshIdentity('vendor');
      const before = await counts();

      const response = await accept(vendor);

      expect(response.statusCode).toBe(200);
      expect(await counts()).toEqual({
        ...before,
        users: before.users + 1,
        acceptances: before.acceptances + 1,
      });
    });

    it('gates the row as saved when a vendor webhook row lands after the snapshot said customer', async () => {
      await setGate(true);
      const identity = freshIdentity('customer');
      const snapshot = harness.authUsers.get(identity)!;
      const get = harness.authUsers.get.bind(harness.authUsers);
      let landed: Promise<unknown> | null = null;

      /*
       * The account holder rewrote `unsafeMetadata.role` to customer after the
       * sign-up queued a vendor `user.created`. The webhook's row is written
       * while the acceptance reads the snapshot — queued ahead of the
       * acceptance's own transaction on the one PGlite connection.
       */
      harness.authUsers.get = (id: string) => {
        if (id === identity && landed === null) {
          // `.execute()` starts it now; a Drizzle builder otherwise runs only when awaited.
          landed = harness.database.db
            .insert(users)
            .values({
              authUserId: identity,
              email: snapshot.email,
              role: 'vendor',
              firstName: 'Grace',
              lastName: 'Hopper',
            })
            .execute();
        }
        return get(id);
      };

      try {
        const response = await accept(identity);

        expect(response.statusCode).toBe(403);
        expect(response.json()).toMatchObject({ error: 'vendor_not_invited' });
      } finally {
        harness.authUsers.get = get;
      }

      await landed;
      const [row] = await harness.database.db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.authUserId, identity));
      expect(row?.role).toBe('vendor');
      const held = await harness.database.db
        .select()
        .from(legalAcceptances)
        .where(eq(legalAcceptances.acceptedByUserId, row!.id));
      expect(held).toHaveLength(0);
    });

    it('never makes a vendor row that exists without an invite usable', async () => {
      await setGate(true);
      const vendor = freshIdentity('vendor');
      const snapshot = harness.authUsers.get(vendor)!;

      /*
       * The row a writer other than the acceptance gate would leave: a `vendor`
       * role, no acceptance, no invite. Nothing writes one on the product path
       * now, and the gate must not treat one as an account if something ever
       * does.
       */
      await harness.database.db.insert(users).values({
        authUserId: vendor,
        email: snapshot.email,
        firstName: 'Grace',
        lastName: 'Hopper',
        role: 'vendor',
      });
      const [row] = await harness.database.db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.authUserId, vendor));
      expect(row?.role).toBe('vendor');

      const refused = await accept(vendor);
      expect(refused.statusCode).toBe(403);
      expect(refused.json()).toMatchObject({ error: 'vendor_not_invited' });

      for (const url of ['/users/me', '/vendor/dashboard', '/vendor/profile']) {
        const response = await inject('GET', url, vendor);
        expect({ url, status: response.statusCode, error: response.json().error }).toEqual({
          url,
          status: 403,
          error: 'TERMS_REQUIRED',
        });
      }

      const held = await harness.database.db
        .select()
        .from(legalAcceptances)
        .where(eq(legalAcceptances.acceptedByUserId, row!.id));
      expect(held).toHaveLength(0);
    });
  });

  describe('the operator switch', () => {
    it('flips through /admin/settings with an audit row', async () => {
      const response = await inject('PUT', '/admin/settings', ADMIN, { vendorInviteOnly: true });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ vendorInviteOnly: true });
      const audit = await harness.database.db
        .select()
        .from(adminActions)
        .where(eq(adminActions.action, 'platform_setting_changed'));
      expect(audit.map((row) => [row.action, row.detail])).toEqual([
        ['platform_setting_changed', { field: 'vendorInviteOnly', before: false, after: true }],
      ]);
      expect((await inject('GET', '/vendor-applications/gate', null)).json()).toEqual({
        vendorInviteOnly: true,
      });
    });
  });

  describe('POST /vendor-applications', () => {
    it('refuses a signed-out submit and writes nothing (AC15)', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: application('drifter@example.com'),
      });

      expect(response.statusCode).toBe(401);
      expect(await harness.database.db.select().from(vendorApplications)).toHaveLength(0);
    });

    it('fills in the seeded row from the session, ignoring whatever the body carries', async () => {
      const vendor = await refusedVendor('applicant@example.com');

      const response = await apply(vendor.actor, {
        ...application('someone-else@example.com'),
        city: 'Dallas',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: true });
      const rows = await harness.database.db.select().from(vendorApplications);
      expect(rows.map((row) => [row.email, row.city, row.status])).toEqual([
        ['applicant@example.com', 'Dallas', 'new'],
      ]);
    });

    it('takes a 150-character business name and stores it whole (VEN-544)', async () => {
      const vendor = await refusedVendor('long@example.com');
      const businessName = 'B'.repeat(150);

      const response = await apply(vendor.actor, { ...application(vendor.email), businessName });

      expect([response.statusCode, response.json()]).toEqual([200, { received: true }]);
      const rows = await harness.database.db.select().from(vendorApplications);
      expect(rows.map((row) => row.businessName)).toEqual([businessName]);
    });

    it('refuses a category id that does not exist (AC11)', async () => {
      const vendor = await refusedVendor('bad-category@example.com');

      const response = await apply(vendor.actor, {
        ...application(vendor.email),
        category: '00000000-0000-4000-8000-00000000dead',
      });

      expect(response.statusCode).toBe(400);
    });

    it('arrives already invited when the address was invited first', async () => {
      const vendor = await refusedVendor('early@example.com');
      await invite('early@example.com');

      await apply(vendor.actor, application(vendor.email));

      const [row] = await harness.database.db.select().from(vendorApplications);
      expect(row?.status).toBe('invited');
    });

    it('stops one caller after six applications in an hour', async () => {
      const vendor = await refusedVendor('rate-limited@example.com');

      for (let attempt = 1; attempt <= 6; attempt += 1) {
        const response = await apply(vendor.actor, application(vendor.email));
        expect(response.statusCode, `attempt ${attempt}`).toBe(200);
      }

      const seventh = await apply(vendor.actor, application(vendor.email));
      expect(seventh.statusCode).toBe(429);
      expect(seventh.json()).toMatchObject({ error: 'RATE_LIMITED' });
    });
  });

  describe('GET /vendor-applications/me', () => {
    it('refuses a signed-out call', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor-applications/me',
        ...fromANewVisitor(),
      });
      expect(response.statusCode).toBe(401);
    });

    it('never writes a row itself: an eligible session with no prior refusal reads back empty', async () => {
      const vendor = freshIdentity('vendor', 'never-refused@example.com');
      await setGate(true);

      const first = await inject('GET', '/vendor-applications/me', vendor);
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({ email: 'never-refused@example.com', complete: false });

      const second = await inject('GET', '/vendor-applications/me', vendor);
      expect(second.statusCode).toBe(200);
      // Landing here twice, with no actual refusal, writes nothing at all (VEN-512).
      expect(await harness.database.db.select().from(vendorApplications)).toHaveLength(0);
    });

    it('reflects the row a real refusal already wrote, and twice leaves exactly one row (AC13)', async () => {
      const vendor = await refusedVendor('arriving@example.com');

      const first = await inject('GET', '/vendor-applications/me', vendor.actor);
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({ email: 'arriving@example.com', complete: false });

      const second = await inject('GET', '/vendor-applications/me', vendor.actor);
      expect(second.statusCode).toBe(200);
      expect(await harness.database.db.select().from(vendorApplications)).toHaveLength(1);

      await apply(vendor.actor, application(vendor.email));
      const after = await inject('GET', '/vendor-applications/me', vendor.actor);
      expect(after.json()).toMatchObject({ complete: true });
    });

    it('reads back empty for an invited address, an address with a live account, or with the gate off (VEN-512)', async () => {
      const invited = await refusedVendor('now-invited@example.com');
      await invite('now-invited@example.com');
      expect((await inject('GET', '/vendor-applications/me', invited.actor)).json()).toMatchObject({
        complete: false,
        businessName: null,
      });

      await setGate(false);
      const ungated = freshIdentity('vendor', 'gate-is-off@example.com');
      expect((await inject('GET', '/vendor-applications/me', ungated)).json()).toMatchObject({
        businessName: null,
      });
      await setGate(true);

      const customer = freshIdentity('customer', 'has-an-account@example.com');
      expect((await accept(customer)).statusCode).toBe(200);
      expect((await inject('GET', '/vendor-applications/me', customer)).json()).toMatchObject({
        businessName: null,
      });
    });
  });

  describe('the console', () => {
    it('refuses every route to a customer and to a vendor', async () => {
      await setGate(false);
      const customer = freshIdentity('customer');
      const vendor = freshIdentity('vendor');
      expect((await accept(customer)).statusCode).toBe(200);
      expect((await accept(vendor)).statusCode).toBe(200);
      const id = '00000000-0000-4000-8000-00000000abcd';

      for (const actor of [customer, vendor]) {
        for (const [method, url, payload] of [
          ['GET', '/admin/vendor-applications', undefined],
          ['PUT', `/admin/vendor-applications/${id}`, { decision: 'invite' }],
          ['POST', '/admin/vendor-applications/invite', { applicationIds: [id] }],
          ['GET', '/admin/vendor-invites', undefined],
          ['POST', '/admin/vendor-invites', { email: 'x@example.com' }],
          ['DELETE', `/admin/vendor-invites/${id}`, undefined],
        ] as const) {
          const response = await inject(method, url, actor, payload);
          expect({ actor, url: `${method} ${url}`, status: response.statusCode }).toEqual({
            actor,
            url: `${method} ${url}`,
            status: 403,
          });
        }
      }

      expect((await inject('GET', '/admin/vendor-invites', null)).statusCode).toBe(401);
      expect(
        (
          await inject('POST', '/admin/vendor-applications/invite', null, {
            applicationIds: [id],
          })
        ).statusCode,
      ).toBe(401);
    });

    it('invites an applicant who has a waitlist application: the sign-in variant (AC1)', async () => {
      const vendor = await refusedVendor('newcomer@example.com');
      await apply(vendor.actor, application(vendor.email));
      // The application's own confirmation email, settled and cleared: this test's
      // assertions are about the invite the decision below sends, not that one.
      await harness.flushEmail();
      harness.email.sent.length = 0;
      const listed = await inject('GET', '/admin/vendor-applications', ADMIN);
      expect(listed.statusCode).toBe(200);
      const [row] = listed.json().items;
      expect(row).toMatchObject({ email: 'newcomer@example.com', status: 'new', complete: true });

      const decided = await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, {
        decision: 'invite',
      });
      await harness.flushEmail();

      expect(decided.statusCode).toBe(200);
      expect(decided.json()).toMatchObject({ id: row.id, status: 'invited' });
      const invites = (await inject('GET', '/admin/vendor-invites', ADMIN)).json().items;
      expect(invites).toMatchObject([
        { email: 'newcomer@example.com', invitedByName: 'Ada Operator', acceptedAt: null },
      ]);
      const audit = await harness.database.db
        .select()
        .from(adminActions)
        .where(eq(adminActions.subjectId, invites[0].id));
      expect(audit.map((action) => action.action)).toEqual(['vendor_invited']);
      expect(harness.email.sent).toHaveLength(1);
      expect(harness.email.sent[0]).toMatchObject({ to: 'newcomer@example.com' });
      expect(harness.email.sent[0]!.text).toContain(`${TEST_ENV.WEB_URL}${VENDOR_SIGN_IN_PATH}`);
      expect(harness.email.sent[0]!.text).not.toContain('Sign up');

      const again = await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, {
        decision: 'invite',
      });
      expect(again.statusCode).toBe(409);
    });

    it('refuses to decline an applicant whose address is already invited', async () => {
      const vendor = await refusedVendor('both@example.com');
      await apply(vendor.actor, application(vendor.email));
      await invite('both@example.com');
      await harness.database.db.update(vendorApplications).set({ status: 'new' });
      const [row] = (await inject('GET', '/admin/vendor-applications', ADMIN)).json().items;

      const decided = await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, {
        decision: 'decline',
      });

      expect(decided.statusCode).toBe(409);
      const [stored] = await harness.database.db.select().from(vendorApplications);
      expect(stored?.status).toBe('new');
    });

    it('declines an applicant without inviting or emailing them', async () => {
      const vendor = await refusedVendor('declined@example.com');
      await apply(vendor.actor, application(vendor.email));
      // Settle and clear the application's own confirmation email before the
      // assertion below, which is about the decline sending no *invite* email.
      await harness.flushEmail();
      harness.email.sent.length = 0;
      const [row] = (await inject('GET', '/admin/vendor-applications', ADMIN)).json().items;

      const decided = await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, {
        decision: 'decline',
      });
      await harness.flushEmail();

      expect(decided.json()).toMatchObject({ status: 'declined' });
      expect(await harness.database.db.select().from(vendorInvites)).toHaveLength(0);
      expect(harness.email.sent).toHaveLength(0);
    });

    it('refuses to invite an incomplete row (409), while a direct invite by email still succeeds (AC9)', async () => {
      const vendor = freshIdentity('vendor', 'unfinished@example.com');
      await setGate(true);
      expect((await accept(vendor)).statusCode).toBe(403);
      const [row] = (await inject('GET', '/admin/vendor-applications', ADMIN)).json().items;
      expect(row).toMatchObject({ email: 'unfinished@example.com', complete: false });

      const decided = await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, {
        decision: 'invite',
      });
      expect(decided.statusCode).toBe(409);

      const direct = await inject('POST', '/admin/vendor-invites', ADMIN, {
        email: 'unfinished@example.com',
      });
      expect(direct.statusCode).toBe(201);
    });

    it('invites by address, refuses a duplicate, and revokes only an unused invite', async () => {
      const created = await inject('POST', '/admin/vendor-invites', ADMIN, {
        email: 'Direct@Example.com',
      });
      await harness.flushEmail();

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ email: 'direct@example.com', acceptedAt: null });
      expect(created.headers.location).toBe(`/admin/vendor-invites/${created.json().id}`);
      expect(harness.email.sent.map((message) => message.to)).toEqual(['direct@example.com']);

      const duplicate = await inject('POST', '/admin/vendor-invites', ADMIN, {
        email: 'direct@example.com',
      });
      expect(duplicate.statusCode).toBe(409);

      await harness.database.db.update(vendorInvites).set({ acceptedAt: new Date() });
      const used = await inject('DELETE', `/admin/vendor-invites/${created.json().id}`, ADMIN);
      expect(used.statusCode).toBe(409);

      await harness.database.db.update(vendorInvites).set({ acceptedAt: null });
      const revoked = await inject('DELETE', `/admin/vendor-invites/${created.json().id}`, ADMIN);
      expect(revoked.statusCode).toBe(204);
      expect(await harness.database.db.select().from(vendorInvites)).toHaveLength(0);
    });

    it('refuses an application from a signed-in address that already has an account', async () => {
      const customer = freshIdentity('customer', 'holder@example.com');
      expect((await accept(customer)).statusCode).toBe(200);

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        headers: bearer(customer),
        payload: application('holder@example.com'),
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'That address already has an account, and an account cannot become a vendor. Use a different email address to apply.',
      );
      expect(await harness.database.db.select().from(vendorApplications)).toHaveLength(0);
    });

    it('refuses an application from an address with an account signed in as itself', async () => {
      const customer = freshIdentity('customer', 'quiet@example.com');
      expect((await accept(customer)).statusCode).toBe(200);

      const response = await apply(customer, application('quiet@example.com'));

      expect(response.statusCode).toBe(409);
      expect(await harness.database.db.select().from(vendorApplications)).toHaveLength(0);
    });

    it('refuses to invite an address that already has an account, and sends nothing', async () => {
      const customer = freshIdentity('customer', 'taken@example.com');
      expect((await accept(customer)).statusCode).toBe(200);

      const response = await inject('POST', '/admin/vendor-invites', ADMIN, {
        email: 'Taken@Example.com',
      });
      await harness.flushEmail();

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('already has an account');
      expect(await harness.database.db.select().from(vendorInvites)).toHaveLength(0);
      expect(harness.email.sent).toHaveLength(0);
    });

    it('refuses to invite an existing account through its waiting application too', async () => {
      const vendor = await refusedVendor('late@example.com');
      await apply(vendor.actor, application(vendor.email));
      await setGate(false);
      // The address changes its mind and becomes a customer instead — an account now exists.
      const customer = freshIdentity('customer', 'late@example.com');
      expect((await accept(customer)).statusCode).toBe(200);
      const [row] = (await inject('GET', '/admin/vendor-applications', ADMIN)).json().items;

      const response = await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, {
        decision: 'invite',
      });

      expect(response.statusCode).toBe(409);
      expect(await harness.database.db.select().from(vendorInvites)).toHaveLength(0);
    });

    it('puts a declined applicant back to declined when a direct invite is revoked', async () => {
      const vendor = await refusedVendor('declined-twice@example.com');
      await apply(vendor.actor, application(vendor.email));
      const [row] = (await inject('GET', '/admin/vendor-applications', ADMIN)).json().items;
      await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, { decision: 'decline' });

      const created = await inject('POST', '/admin/vendor-invites', ADMIN, {
        email: 'declined-twice@example.com',
      });
      expect(created.statusCode).toBe(201);
      const [invited] = await harness.database.db.select().from(vendorApplications);
      expect(invited?.status).toBe('invited');

      const revoked = await inject('DELETE', `/admin/vendor-invites/${created.json().id}`, ADMIN);
      expect(revoked.statusCode).toBe(204);

      const [restored] = await harness.database.db.select().from(vendorApplications);
      expect(restored).toMatchObject({ status: 'declined', statusBeforeInvite: null });
      const list = (await inject('GET', '/admin/vendor-applications', ADMIN)).json();
      expect(list.waiting).toBe(0);
    });

    it('puts a waiting applicant back to waiting when their invite is revoked', async () => {
      const vendor = await refusedVendor('waiting@example.com');
      await apply(vendor.actor, application(vendor.email));
      const created = await inject('POST', '/admin/vendor-invites', ADMIN, {
        email: 'waiting@example.com',
      });

      await inject('DELETE', `/admin/vendor-invites/${created.json().id}`, ADMIN);

      const [row] = await harness.database.db.select().from(vendorApplications);
      expect(row?.status).toBe('new');
    });

    it('tells a refused vendor they are on the waitlist', () => {
      expect(vendorNotInvited().message).toBe(
        "Vendor accounts are by invitation for now. No account was created, but you're on the waitlist — tell us about your business and we'll invite you.",
      );
    });

    it('renders the sign-in variant for an address that has a waitlist application (AC1)', () => {
      const mail = renderVendorInviteEmail('https://orla.test', 'mara@example.com', true);

      expect(mail.subject).toBe("You're invited to join Orla as a vendor");
      expect(mail.text).toContain(`https://orla.test${VENDOR_SIGN_IN_PATH}`);
      expect(mail.html).toContain(`https://orla.test${VENDOR_SIGN_IN_PATH}`);
      expect(mail.text).not.toContain('Sign up');
      expect(mail.html).not.toContain('Sign up');
      expect(mail.text).not.toContain(VENDOR_SIGN_UP_PATH);
    });

    it('renders the sign-up variant, with the address quoted, for one with no application (AC2)', () => {
      const mail = renderVendorInviteEmail('https://orla.test', 'mara@example.com', false);

      expect(mail.subject).toBe("You're invited to join Orla as a vendor");
      expect(mail.text).toContain(`https://orla.test${VENDOR_SIGN_UP_PATH}`);
      expect(mail.html).toContain(`https://orla.test${VENDOR_SIGN_UP_PATH}`);
      expect(mail.text).toContain('mara@example.com');
      expect(mail.html).toContain('mara@example.com');
      expect(mail.text).not.toContain('Sign in');
    });

    const NO_URGENCY_COPY = [
      /\bday(?:s)?\b/i,
      /\bwithin\b/i,
      /\bexpir\w*/i,
      /\bposition\b/i,
      /\bqueue\b/i,
      /\bone of \d/i,
      /\bsoon\b/i,
      /\bhurry\b/i,
      /\blimited\b/i,
      /\burgent\w*/i,
      /test[\s-]?mode/i,
    ];

    it('carries the prices/work/dates sentence in both variants, and no date, count, position or expiry language (AC3, AC4)', () => {
      for (const hasApplication of [true, false]) {
        const mail = renderVendorInviteEmail(
          'https://orla.test',
          'mara@example.com',
          hasApplication,
        );

        expect(mail.text).toContain(
          'set your prices, put up your work and open the dates you want to be booked on',
        );
        for (const pattern of NO_URGENCY_COPY) {
          expect(mail.text).not.toMatch(pattern);
          expect(mail.html).not.toMatch(pattern);
        }
      }
    });

    it('carries no date, count, position, expiry or urgency language in the waitlist confirmation either (AC4)', () => {
      const mail = renderVendorApplicationConfirmationEmail({
        businessName: 'Hopper Florals',
        categoryName: 'Florist',
        city: 'Austin',
        state: 'TX',
        email: 'mara@example.com',
      });

      for (const pattern of NO_URGENCY_COPY) {
        expect(mail.text).not.toMatch(pattern);
        expect(mail.html).not.toMatch(pattern);
      }
    });

    it('renders the waitlist confirmation with the four saved facts, no button', () => {
      const mail = renderVendorApplicationConfirmationEmail({
        businessName: 'Hopper Florals',
        categoryName: 'Florist',
        city: 'Austin',
        state: 'TX',
        email: 'mara@example.com',
      });

      expect(mail.subject).toBe("You're on the Orla waitlist");
      expect(mail.text).toContain('Hopper Florals');
      expect(mail.text).toContain('Florist');
      expect(mail.text).toContain('Austin, Texas');
      expect(mail.text).toContain('mara@example.com');
      expect(mail.text).not.toContain('href');
      expect(mail.html).not.toContain('<a ');
      expect(mail.text).toContain('reply to this email');
    });

    it('matches the Frame 38 template on both invite variants: 600px card, brand mark, body copy, clay button, footer rule (VEN-600 AC1)', () => {
      for (const hasApplication of [true, false]) {
        const mail = renderVendorInviteEmail(
          'https://orla.test',
          'mara@example.com',
          hasApplication,
        );

        expect(mail.html).toContain(
          '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif',
        );
        expect(mail.html).toContain('width="600" style="width:600px;max-width:600px;');
        expect(mail.html).toContain('background:#F8F5EF;border-radius:10px');
        expect(mail.html).toContain('background:#E9E6DF');
        // The two-circle brand mark: clay fill + ink outline, 17px each.
        expect(mail.html).toContain('width:17px;height:17px;border-radius:50%;background:#B4552F;');
        expect(mail.html).toContain(
          'width:17px;height:17px;border-radius:50%;border:1.3px solid #23201C;',
        );
        expect(mail.html).toContain(
          "font-family:'Instrument Serif', Georgia, serif;font-size:24px;color:#23201C",
        );
        expect(mail.html).toContain(
          "font-family:'Instrument Serif', Georgia, serif;font-size:31px;line-height:1.18;color:#23201C",
        );
        // Body paragraph typography, pinned in full — not just a loose color match.
        expect(mail.html).toContain('font-size:14.5px;line-height:1.75;color:#4A443C');
        expect(mail.html).toContain(
          "font-family:'Instrument Sans', Arial, Helvetica, sans-serif;font-size:14px;font-weight:600;line-height:14px;color:#FFFDF9;background:#B4552F;padding:13px 26px;border-radius:10px",
        );
        // Footer typography and rule, pinned in full.
        expect(mail.html).toContain(
          "border-top:1px solid #E4DDD1;font-family:'Instrument Sans', Arial, Helvetica, sans-serif;font-size:12px;line-height:1.65;color:#6B6459",
        );
        expect(mail.html).toContain('Your invitation is here');
      }
    });

    it("bolds the quoted address to Frame 38's ink weight, not the browser default <strong> (VEN-600 AC1)", () => {
      const mail = renderVendorInviteEmail('https://orla.test', 'mara@example.com', false);

      expect(mail.html).toContain('font-weight:600;color:#23201C;">mara@example.com</span>');
      expect(mail.html).not.toContain('<strong>');
    });

    it('matches the Frame 38 template on the waitlist confirmation: info box, gapped label column, one bold row, no button (VEN-600 AC1)', () => {
      const mail = renderVendorApplicationConfirmationEmail({
        businessName: 'Hopper Florals',
        categoryName: 'Florist',
        city: 'Austin',
        state: 'TX',
        email: 'mara@example.com',
      });

      expect(mail.html).toContain('width="600" style="width:600px;max-width:600px;');
      expect(mail.html).toContain(
        'background:#FFFDF9;border:1px solid #E4DDD1;border-radius:12px;padding:16px 18px',
      );
      expect(mail.html).toContain(
        'width:104px;padding-right:12px;font-size:13.5px;line-height:1.6;color:#6B6459',
      );
      // Only the Business row is bold — the other three facts stay regular weight.
      expect(mail.html).toContain('font-weight:600;">Hopper Florals</td>');
      expect(mail.html).toContain('font-weight:400;">Florist</td>');
      expect(mail.html).toContain('font-weight:400;">Austin, Texas</td>');
      expect(mail.html).toContain('font-weight:400;">mara@example.com</td>');
      // The closing "if any of that is wrong" line sits below body size, per Frame 38.
      expect(mail.html).toContain('font-size:13.5px;line-height:1.7;color:#4A443C');
      expect(mail.html).not.toContain('<a href="https://orla.test');
      expect(mail.html).toContain("You're on the waitlist");
    });

    it('walks past 200 applications, with server-side totals for both lists', async () => {
      const APPLICATIONS = 201;
      await harness.database.db.insert(vendorApplications).values(
        Array.from({ length: APPLICATIONS }, (_, index) => ({
          email: `applicant-${index}@example.com`,
          businessName: `Business ${index}`,
          category: 'photography',
          city: 'Austin',
          message: '',
          status: index < 3 ? ('declined' as const) : ('new' as const),
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        })),
      );
      await harness.database.db
        .insert(vendorInvites)
        .values(
          Array.from({ length: 17 }, (_, index) => ({ email: `invitee-${index}@example.com` })),
        );

      const first = (await inject('GET', '/admin/vendor-applications', ADMIN)).json();
      expect(first).toMatchObject({ total: APPLICATIONS, waiting: APPLICATIONS - 3, page: 1 });
      expect(first.items).toHaveLength(first.pageSize);

      // The oldest applicant is on the last page, not silently dropped.
      const lastPage = Math.ceil(APPLICATIONS / first.pageSize);
      const last = (
        await inject('GET', `/admin/vendor-applications?page=${lastPage}`, ADMIN)
      ).json();
      expect(last.items.at(-1)).toMatchObject({ email: 'applicant-0@example.com' });

      const invites = (await inject('GET', '/admin/vendor-invites?page=2', ADMIN)).json();
      expect(invites).toMatchObject({ total: 17, page: 2 });
      expect(invites.items).toHaveLength(17 - invites.pageSize);
    });
  });

  describe('POST /admin/vendor-applications/invite (VEN-513)', () => {
    /** Three fresh, complete, `new` applications, in the order given. */
    async function threeApplications(prefix: string): Promise<string[]> {
      const emails = [
        `${prefix}-1@example.com`,
        `${prefix}-2@example.com`,
        `${prefix}-3@example.com`,
      ];
      for (const email of emails) {
        const vendor = await refusedVendor(email);
        await apply(vendor.actor, application(email));
      }
      const items = (await inject('GET', '/admin/vendor-applications', ADMIN)).json().items;
      // Each `apply` above queued its own waitlist confirmation; settle and clear
      // them so a test's own email assertions read only the invite it sent.
      await harness.flushEmail();
      harness.email.sent.length = 0;
      return emails.map(
        (email) => items.find((row: { email: string; id: string }) => row.email === email).id,
      );
    }

    it('invites three applications in one action: invites, audit rows, statuses and emails (AC1)', async () => {
      const ids = await threeApplications('bulk-invite');

      const response = await inject('POST', '/admin/vendor-applications/invite', ADMIN, {
        applicationIds: ids,
      });
      await harness.flushEmail();

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        results: ids.map((id) => ({ id, status: 'invited', emailFailed: false })),
      });
      const invites = await harness.database.db.select().from(vendorInvites);
      expect(invites).toHaveLength(3);
      const applications = await harness.database.db.select().from(vendorApplications);
      expect(applications.map((row) => row.status)).toEqual(['invited', 'invited', 'invited']);
      const audit = await harness.database.db
        .select()
        .from(adminActions)
        .where(
          and(
            eq(adminActions.action, 'vendor_invited'),
            inArray(
              adminActions.subjectId,
              invites.map((invite) => invite.id),
            ),
          ),
        );
      expect(audit).toHaveLength(3);
      expect(harness.email.sent).toHaveLength(3);
    });

    it('reports already_invited for an already-invited applicant, and writes nothing new (AC2)', async () => {
      const vendor = await refusedVendor('bulk-already@example.com');
      await apply(vendor.actor, application(vendor.email));
      const [row] = (await inject('GET', '/admin/vendor-applications', ADMIN)).json().items;
      await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, { decision: 'invite' });
      await harness.flushEmail();
      harness.email.sent.length = 0;

      const response = await inject('POST', '/admin/vendor-applications/invite', ADMIN, {
        applicationIds: [row.id],
      });

      expect(response.json()).toEqual({
        results: [{ id: row.id, status: 'already_invited', emailFailed: false }],
      });
      const invites = await harness.database.db.select().from(vendorInvites);
      expect(invites).toHaveLength(1);
      const audit = await harness.database.db
        .select()
        .from(adminActions)
        .where(
          and(
            eq(adminActions.action, 'vendor_invited'),
            eq(adminActions.subjectId, invites[0]!.id),
          ),
        );
      expect(audit).toHaveLength(1);
      expect(harness.email.sent).toHaveLength(0);
    });

    it('reports a declined or unknown id as not_found_or_decided and an incomplete one as incomplete, without failing the request (AC3)', async () => {
      const declinedVendor = await refusedVendor('bulk-declined@example.com');
      await apply(declinedVendor.actor, application(declinedVendor.email));
      const [declinedRow] = (await inject('GET', '/admin/vendor-applications', ADMIN)).json().items;
      await inject('PUT', `/admin/vendor-applications/${declinedRow.id}`, ADMIN, {
        decision: 'decline',
      });

      await refusedVendor('bulk-incomplete@example.com');
      const incompleteRow = (await inject('GET', '/admin/vendor-applications', ADMIN))
        .json()
        .items.find((row: { email: string }) => row.email === 'bulk-incomplete@example.com');
      const unknownId = fakeId(1);

      const response = await inject('POST', '/admin/vendor-applications/invite', ADMIN, {
        applicationIds: [declinedRow.id, incompleteRow.id, unknownId],
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        results: [
          { id: declinedRow.id, status: 'not_found_or_decided', emailFailed: false },
          { id: incompleteRow.id, status: 'incomplete', emailFailed: false },
          { id: unknownId, status: 'not_found_or_decided', emailFailed: false },
        ],
      });
      const [stored] = await harness.database.db
        .select()
        .from(vendorApplications)
        .where(eq(vendorApplications.id, declinedRow.id));
      expect(stored?.status).toBe('declined');
      expect(await harness.database.db.select().from(vendorInvites)).toHaveLength(0);
    });

    it('marks the one invite whose email fails, and leaves the other two unaffected (AC4)', async () => {
      const ids = await threeApplications('bulk-partial');

      // `failNext` fires on the first send the service makes, which is the first id in the array.
      harness.email.failNext = true;
      const response = await inject('POST', '/admin/vendor-applications/invite', ADMIN, {
        applicationIds: ids,
      });
      await harness.flushEmail();

      expect(response.json()).toEqual({
        results: [
          { id: ids[0], status: 'invited', emailFailed: true },
          { id: ids[1], status: 'invited', emailFailed: false },
          { id: ids[2], status: 'invited', emailFailed: false },
        ],
      });
      const invites = await harness.database.db.select().from(vendorInvites);
      expect(invites).toHaveLength(3);
      const failed = invites.find((invite) => invite.email === 'bulk-partial-1@example.com');
      expect(failed?.emailSentAt).toBeNull();
      expect(failed?.emailFailureReason).toBe('Resend refused the send (500)');
      const sent = invites.filter((invite) => invite.email !== 'bulk-partial-1@example.com');
      expect(sent.every((invite) => invite.emailSentAt !== null)).toBe(true);
      expect(harness.email.sent).toHaveLength(2);
    });

    it('refuses more than 50 ids, an empty list and a non-uuid, with the standard error shape (AC5)', async () => {
      const tooMany = Array.from({ length: 51 }, (_, index) => fakeId(index));

      const over = await inject('POST', '/admin/vendor-applications/invite', ADMIN, {
        applicationIds: tooMany,
      });
      const empty = await inject('POST', '/admin/vendor-applications/invite', ADMIN, {
        applicationIds: [],
      });
      const malformed = await inject('POST', '/admin/vendor-applications/invite', ADMIN, {
        applicationIds: ['not-a-uuid'],
      });

      for (const response of [over, empty, malformed]) {
        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({ error: 'VALIDATION_ERROR' });
      }
      expect(await harness.database.db.select().from(vendorInvites)).toHaveLength(0);
    });
  });

  describe('the waitlist confirmation email (VEN-516, AC4)', () => {
    function confirmationDeps(): Parameters<typeof retryFailedApplicationConfirmationEmails>[0] {
      return {
        db: harness.database.db,
        email: harness.email,
        background: harness.app.background,
        log: harness.app.log,
        webOrigin: TEST_ENV.WEB_URL,
        now: () => new Date(),
      };
    }

    it('sends once on the first submit, and a resubmit sends nothing', async () => {
      const vendor = await refusedVendor('confirm-once@example.com');

      await apply(vendor.actor, application(vendor.email));
      await harness.flushEmail();

      expect(harness.email.sent).toHaveLength(1);
      expect(harness.email.sent[0]).toMatchObject({
        to: 'confirm-once@example.com',
        subject: "You're on the Orla waitlist",
      });
      const [row] = await harness.database.db.select().from(vendorApplications);
      expect(row).toMatchObject({ confirmationEmailAttempts: 1 });
      expect(row?.confirmationEmailSentAt).toBeInstanceOf(Date);

      await apply(vendor.actor, application(vendor.email));
      await harness.flushEmail();

      expect(harness.email.sent).toHaveLength(1);
      // The fake gateway would dedupe a second send under the same idempotency
      // key even if the resubmit tried one, so `sent` alone cannot catch the
      // gate regressing — the attempt count is the tell.
      const [after] = await harness.database.db.select().from(vendorApplications);
      expect(after).toMatchObject({ confirmationEmailAttempts: 1 });
    });

    it('records a failed send and still returns 200; the retry sweep sends it once, same idempotency key', async () => {
      const vendor = await refusedVendor('confirm-fails@example.com');
      harness.email.failNext = true;

      const response = await apply(vendor.actor, application(vendor.email));
      await harness.flushEmail();

      expect(response.statusCode).toBe(200);
      expect(harness.email.sent).toHaveLength(0);
      const [failed] = await harness.database.db.select().from(vendorApplications);
      expect(failed).toMatchObject({
        confirmationEmailAttempts: 1,
        confirmationEmailSentAt: null,
        confirmationEmailFailureReason: 'Resend refused the send (500)',
      });

      const tried = await retryFailedApplicationConfirmationEmails(confirmationDeps());
      expect(tried).toBe(1);
      expect(harness.email.sent).toHaveLength(1);
      expect(harness.email.sent[0]?.idempotencyKey).toBe(
        `vendor-application-confirmation-${failed!.id}`,
      );
      const [sent] = await harness.database.db.select().from(vendorApplications);
      expect(sent).toMatchObject({
        confirmationEmailAttempts: 2,
        confirmationEmailFailureReason: null,
      });
      expect(sent?.confirmationEmailSentAt).toBeInstanceOf(Date);

      // A second tick finds nothing left to retry: already sent.
      expect(await retryFailedApplicationConfirmationEmails(confirmationDeps())).toBe(0);
      expect(harness.email.sent).toHaveLength(1);
    });
  });
});
