import { ERROR_CODES } from '@vendor-marketplace/shared';
import { adminActions, users } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setUserRole } from '../../testing/set-user-role.js';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

const ADMIN = 'user_ops_admin';
const OTHER_ADMIN = 'user_ops_admin_two';
const CUSTOMER = 'user_ops_customer';
const VENDOR = 'user_ops_vendor';
const OUTSIDER = 'user_ops_outsider';

/**
 * VEN-506: an operator adds and removes operators in the app, with a step-up,
 * an audit row in the same transaction, and never the last live operator.
 */
describe('operator grant and revoke', () => {
  let harness: TestHarness;

  const emailOf = (authUserId: string): string => `${authUserId}@example.com`;

  async function stepUp(authUserId: string): Promise<void> {
    await harness.app.inject({
      method: 'POST',
      url: '/admin/step-up/challenge',
      headers: bearer(authUserId),
    });
    const message = [...harness.email.sent].reverse().find((m) => m.to === emailOf(authUserId));
    const code = /\b(\d{6})\b/.exec(message?.text ?? '')?.[1];
    const response = await harness.app.inject({
      method: 'POST',
      url: '/admin/step-up/verify',
      headers: bearer(authUserId),
      payload: { code },
    });
    expect(response.statusCode).toBe(200);
  }

  const grant = (actor: string, email: string) =>
    harness.app.inject({
      method: 'POST',
      url: '/admin/operators',
      headers: bearer(actor),
      payload: { email },
    });

  const revoke = (actor: string, userId: string) =>
    harness.app.inject({
      method: 'DELETE',
      url: `/admin/operators/${userId}`,
      headers: bearer(actor),
    });

  async function idOf(authUserId: string): Promise<string> {
    const [row] = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, authUserId));
    return row!.id;
  }

  async function roleOf(authUserId: string): Promise<string> {
    const [row] = await harness.database.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.authUserId, authUserId));
    return row!.role;
  }

  async function auditRows(subjectId: string) {
    return harness.database.db
      .select()
      .from(adminActions)
      .where(eq(adminActions.subjectId, subjectId));
  }

  /** Two operators, both stepped up, plus a customer and a vendor to promote. */
  async function fixtures(): Promise<void> {
    await signInAs(harness, ADMIN, true);
    await signInAs(harness, OTHER_ADMIN, true);
    await signInAs(harness, CUSTOMER);
    await signInAs(harness, VENDOR);
    await stepUp(ADMIN);
    await stepUp(OTHER_ADMIN);
  }

  beforeAll(async () => {
    harness = await createTestHarness({ enforceStepUp: true });

    for (const [authUserId, role] of [
      [ADMIN, 'customer'],
      [OTHER_ADMIN, 'customer'],
      [CUSTOMER, 'customer'],
      [VENDOR, 'vendor'],
      [OUTSIDER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: emailOf(authUserId),
        firstName: 'Test',
        lastName: authUserId,
        roleHint: role,
        avatarUrl: null,
      });
    }
  });

  afterEach(async () => {
    await harness.database.db.delete(users);
    harness.email.sent.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('grants a customer operator access on their next request, with exactly one audit row', async () => {
    await fixtures();
    const customerId = await idOf(CUSTOMER);
    const adminId = await idOf(ADMIN);

    const first = await grant(ADMIN, emailOf(CUSTOMER).toUpperCase());

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ userId: customerId, changed: true });
    expect(await roleOf(CUSTOMER)).toBe('admin');

    const console = await harness.app.inject({
      method: 'GET',
      url: '/admin/operators',
      headers: bearer(CUSTOMER),
    });
    expect(console.statusCode).toBe(200);

    const repeat = await grant(ADMIN, emailOf(CUSTOMER));
    expect(repeat.statusCode).toBe(200);
    expect(repeat.json()).toEqual({ userId: customerId, changed: false });

    const rows = await auditRows(customerId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'operator_granted',
      actorId: adminId,
      subjectType: 'user',
      subjectId: customerId,
      detail: { previousRole: 'customer' },
    });
    expect(JSON.stringify(rows[0]!.detail)).not.toContain('@');
  });

  it('lists operators with who granted them, and a bootstrap operator as not revocable', async () => {
    await fixtures();
    await grant(ADMIN, emailOf(VENDOR));

    const response = await harness.app.inject({
      method: 'GET',
      url: '/admin/operators',
      headers: bearer(ADMIN),
    });
    const items = response.json().items as Array<Record<string, unknown>>;
    const byEmail = new Map(items.map((item) => [item.email, item]));

    expect(items).toHaveLength(3);
    expect(byEmail.get(emailOf(VENDOR))).toMatchObject({
      grantedByName: `Test ${ADMIN}`,
      revocable: true,
    });
    expect(byEmail.get(emailOf(ADMIN))).toMatchObject({
      grantedAt: null,
      grantedByName: null,
      revocable: false,
    });
  });

  it('revokes one of two operators back to the role the grant recorded', async () => {
    await fixtures();
    const vendorId = await idOf(VENDOR);
    await grant(ADMIN, emailOf(VENDOR));

    const response = await revoke(ADMIN, vendorId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: vendorId, changed: true });
    expect(await roleOf(VENDOR)).toBe('vendor');
    expect((await auditRows(vendorId)).map((row) => row.action).sort()).toEqual([
      'operator_granted',
      'operator_revoked',
    ]);

    const again = await revoke(ADMIN, vendorId);
    expect(again.json()).toEqual({ userId: vendorId, changed: false });
    expect(await auditRows(vendorId)).toHaveLength(2);
  });

  it('refuses to revoke the last live operator and changes nothing', async () => {
    await signInAs(harness, ADMIN, true);
    await stepUp(ADMIN);
    const adminId = await idOf(ADMIN);

    const response = await revoke(ADMIN, adminId);

    expect(response.statusCode).toBe(409);
    expect(await roleOf(ADMIN)).toBe('admin');
    expect(await auditRows(adminId)).toHaveLength(0);
  });

  it('refuses an operator nobody granted in the app rather than guess their role', async () => {
    await fixtures();
    const otherId = await idOf(OTHER_ADMIN);

    const response = await revoke(ADMIN, otherId);

    expect(response.statusCode).toBe(409);
    expect(await roleOf(OTHER_ADMIN)).toBe('admin');
  });

  // The lock itself is proved on real Postgres in `operator-access.contention.test.ts`.
  it('lets only one of two operators revoke the other when they ask together', async () => {
    await fixtures();
    await grant(ADMIN, emailOf(CUSTOMER));
    await grant(ADMIN, emailOf(VENDOR));
    // Leave the two granted operators as the only ones, so each is the other's last.
    await setUserRole(harness.database.db, 'customer', eq(users.authUserId, ADMIN));
    await setUserRole(harness.database.db, 'customer', eq(users.authUserId, OTHER_ADMIN));
    await stepUp(CUSTOMER);
    await stepUp(VENDOR);

    const [a, b] = await Promise.all([
      revoke(CUSTOMER, await idOf(VENDOR)),
      revoke(VENDOR, await idOf(CUSTOMER)),
    ]);

    expect([a.statusCode, b.statusCode].filter((code) => code === 200)).toHaveLength(1);
    const roles = [await roleOf(CUSTOMER), await roleOf(VENDOR)];
    expect(roles.filter((role) => role === 'admin')).toHaveLength(1);
  });

  it('answers 403 to a non-operator, 401 to nobody, and the step-up error without a fresh one', async () => {
    await fixtures();
    await signInAs(harness, OUTSIDER);
    const customerId = await idOf(CUSTOMER);

    const nonOperator = await grant(OUTSIDER, emailOf(CUSTOMER));
    const signedOut = await harness.app.inject({
      method: 'POST',
      url: '/admin/operators',
      payload: { email: emailOf(CUSTOMER) },
    });
    harness.app.stepUp.revoke(await idOf(ADMIN));
    const stale = await grant(ADMIN, emailOf(CUSTOMER));
    const staleRevoke = await revoke(ADMIN, customerId);

    expect(nonOperator.statusCode).toBe(403);
    expect(signedOut.statusCode).toBe(401);
    expect(stale.statusCode).toBe(403);
    expect(stale.json().error).toBe(ERROR_CODES.STEP_UP_REQUIRED);
    expect(staleRevoke.json().error).toBe(ERROR_CODES.STEP_UP_REQUIRED);
    expect(await roleOf(CUSTOMER)).toBe('customer');
    expect(await auditRows(customerId)).toHaveLength(0);
  });

  /*
   * Two live accounts in different case used to be a state the grant had to
   * refuse. VEN-649 made it one the database refuses, so the grant finds one
   * account whatever case the operator types.
   */
  it('grants the one live account an address names, whatever case it is typed in', async () => {
    await fixtures();
    const customerId = await idOf(CUSTOMER);
    await harness.database.db
      .update(users)
      .set({ email: 'twin@example.com' })
      .where(eq(users.id, customerId));

    await expect(
      harness.database.db
        .update(users)
        .set({ email: 'twin@example.com' })
        .where(eq(users.id, await idOf(VENDOR))),
    ).rejects.toThrow();

    const response = await grant(ADMIN, 'Twin@Example.com');

    expect(response.statusCode).toBe(200);
    expect(await roleOf(CUSTOMER)).toBe('admin');
    expect(await roleOf(VENDOR)).toBe('vendor');
  });

  it('cannot grant a banned, retired or unconfirmed-address account', async () => {
    await fixtures();
    await signInAs(harness, OUTSIDER);
    const customerId = await idOf(CUSTOMER);
    const vendorId = await idOf(VENDOR);
    const outsiderId = await idOf(OUTSIDER);
    await harness.database.db.update(users).set({ isBanned: true }).where(eq(users.id, customerId));
    await harness.database.db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, vendorId));
    await harness.database.db
      .update(users)
      .set({ pendingEmail: 'new@example.com' })
      .where(eq(users.id, outsiderId));

    expect((await grant(ADMIN, emailOf(CUSTOMER))).statusCode).toBe(409);
    expect((await grant(ADMIN, emailOf(VENDOR))).statusCode).toBe(404);
    expect((await grant(ADMIN, emailOf(OUTSIDER))).statusCode).toBe(409);
    expect((await grant(ADMIN, 'nobody@example.com')).statusCode).toBe(404);
    expect(await roleOf(CUSTOMER)).toBe('customer');
    expect(await roleOf(VENDOR)).toBe('vendor');
    expect(await roleOf(OUTSIDER)).toBe('customer');
    expect(await auditRows(customerId)).toHaveLength(0);
  });
});
