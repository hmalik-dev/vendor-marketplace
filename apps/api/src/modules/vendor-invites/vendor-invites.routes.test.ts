import { setUserRole } from '../../testing/set-user-role.js';
import { eq, sql } from 'drizzle-orm';
import {
  adminActions,
  legalAcceptances,
  platformSettings,
  users,
  vendorApplications,
  vendorInvites,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { CURRENT_TERMS_VERSION, VENDOR_SIGN_UP_PATH } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  TEST_ENV,
  type TestHarness,
} from '../../testing/test-server.js';
import { forgetPlatformSwitches } from '../platform-settings/platform-settings.service.js';
import { renderVendorInviteEmail, vendorNotInvited } from './vendor-invites.service.js';

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

  function application(email: string): Record<string, unknown> {
    return {
      email,
      businessName: 'Hopper Florals',
      category: 'Florist',
      city: 'Austin',
      message: 'Weddings, mostly.',
    };
  }

  beforeAll(async () => {
    harness = await createTestHarness({ acceptTerms: false });

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
    it('refuses an un-invited vendor with vendor_not_invited and writes nothing', async () => {
      await setGate(true);
      const vendor = freshIdentity('vendor');
      const before = await counts();

      const response = await accept(vendor);

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: 'vendor_not_invited' });
      expect(await counts()).toEqual(before);
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
    it('adds the applicant once, and answers a repeat the same way', async () => {
      const visitor = fromANewVisitor();
      const send = (body: Record<string, unknown>) =>
        harness.app.inject({
          method: 'POST',
          url: '/vendor-applications',
          ...visitor,
          payload: body,
        });

      const first = await send(application('Applicant@Example.com'));
      const second = await send({ ...application('applicant@example.com'), city: 'Dallas' });

      expect([first.statusCode, first.json()]).toEqual([200, { received: true }]);
      expect([second.statusCode, second.json()]).toEqual([200, { received: true }]);
      const rows = await harness.database.db.select().from(vendorApplications);
      expect(rows.map((row) => [row.email, row.city, row.status])).toEqual([
        ['applicant@example.com', 'Austin', 'new'],
      ]);
    });

    it('takes a 150-character business name and stores it whole (VEN-544)', async () => {
      const businessName = 'B'.repeat(150);

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: { ...application('long@example.com'), businessName },
      });

      expect([response.statusCode, response.json()]).toEqual([200, { received: true }]);
      const rows = await harness.database.db.select().from(vendorApplications);
      expect(rows.map((row) => row.businessName)).toEqual([businessName]);
    });

    it('arrives already invited when the address was invited first', async () => {
      await invite('early@example.com');

      await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: application('early@example.com'),
      });

      const [row] = await harness.database.db.select().from(vendorApplications);
      expect(row?.status).toBe('invited');
    });

    it('applies with a session’s own address, replacing what a stranger filed under it', async () => {
      const owner = freshIdentity('vendor', 'owner@example.com');
      await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: { ...application('owner@example.com'), businessName: 'Squatter Co' },
      });

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        headers: bearer(owner),
        payload: { ...application('someone-else@example.com'), businessName: 'Owner Florals' },
      });

      expect(response.statusCode).toBe(200);
      const rows = await harness.database.db.select().from(vendorApplications);
      expect(rows.map((row) => [row.email, row.businessName])).toEqual([
        ['owner@example.com', 'Owner Florals'],
      ]);
    });

    it('stops one caller after six applications in an hour', async () => {
      const visitor = fromANewVisitor();

      for (let attempt = 1; attempt <= 6; attempt += 1) {
        const response = await harness.app.inject({
          method: 'POST',
          url: '/vendor-applications',
          ...visitor,
          payload: application(`rate-${attempt}@example.com`),
        });
        expect(response.statusCode, `attempt ${attempt}`).toBe(200);
      }

      const seventh = await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...visitor,
        payload: application('rate-7@example.com'),
      });
      expect(seventh.statusCode).toBe(429);
      expect(seventh.json()).toMatchObject({ error: 'RATE_LIMITED' });
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
    });

    it('invites an applicant: invite row, status, audit and the email', async () => {
      await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: application('newcomer@example.com'),
      });
      const listed = await inject('GET', '/admin/vendor-applications', ADMIN);
      expect(listed.statusCode).toBe(200);
      const [row] = listed.json().items;
      expect(row).toMatchObject({ email: 'newcomer@example.com', status: 'new' });

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
      expect(harness.email.sent[0]!.text).toContain(`${TEST_ENV.WEB_URL}${VENDOR_SIGN_UP_PATH}`);

      const again = await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, {
        decision: 'invite',
      });
      expect(again.statusCode).toBe(409);
    });

    it('refuses to decline an applicant whose address is already invited', async () => {
      await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: application('both@example.com'),
      });
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
      await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: application('declined@example.com'),
      });
      const [row] = (await inject('GET', '/admin/vendor-applications', ADMIN)).json().items;

      const decided = await inject('PUT', `/admin/vendor-applications/${row.id}`, ADMIN, {
        decision: 'decline',
      });
      await harness.flushEmail();

      expect(decided.json()).toMatchObject({ status: 'declined' });
      expect(await harness.database.db.select().from(vendorInvites)).toHaveLength(0);
      expect(harness.email.sent).toHaveLength(0);
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

    it('files nothing for a signed-out application from an address with an account, and says nothing about it', async () => {
      const customer = freshIdentity('customer', 'quiet@example.com');
      expect((await accept(customer)).statusCode).toBe(200);

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: application('quiet@example.com'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: true });
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
      await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: application('late@example.com'),
      });
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
      await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: application('declined-twice@example.com'),
      });
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
      await harness.app.inject({
        method: 'POST',
        url: '/vendor-applications',
        ...fromANewVisitor(),
        payload: application('waiting@example.com'),
      });
      const created = await inject('POST', '/admin/vendor-invites', ADMIN, {
        email: 'waiting@example.com',
      });

      await inject('DELETE', `/admin/vendor-invites/${created.json().id}`, ADMIN);

      const [row] = await harness.database.db.select().from(vendorApplications);
      expect(row?.status).toBe('new');
    });

    it('tells a refused vendor and an invitee that signing in is the path', () => {
      expect(vendorNotInvited().message).toBe(
        'Vendor accounts are by invitation for now. No account was created — apply to join, then sign in with this same email once you are invited.',
      );

      const mail = renderVendorInviteEmail('https://orla.test');
      expect(mail.text).toBe(
        [
          "You're invited to open a vendor account on Orla.",
          '',
          'Sign up with this email address and choose vendor to list your services. If you already signed up with it, sign in instead: your vendor account opens then.',
          '',
          `https://orla.test${VENDOR_SIGN_UP_PATH}`,
        ].join('\n'),
      );
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
});
