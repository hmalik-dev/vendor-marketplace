import { adminActions, users } from '@vendor-marketplace/db/schema';
import { ADMIN_ACTIONS, ADMIN_EXPORTS } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

const ADMIN = 'user_read_audit_admin';
const OTHER_ADMIN = 'user_read_audit_admin_two';
const CUSTOMER = 'user_read_audit_customer';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const START = new Date('2026-10-01T12:00:00.000Z');
const MINUTE = 60_000;

/**
 * Exports and bulk reads of customer data leave an `admin_actions` row
 * (VEN-475). Every assertion reads the real table.
 */
describe('admin export and read auditing', () => {
  let harness: TestHarness;
  let now = START;

  async function rows() {
    return harness.database.db.select().from(adminActions);
  }

  function exportRequest(authUserId: string | null, payload: unknown) {
    return harness.app.inject({
      method: 'POST',
      url: '/admin/exports',
      headers: authUserId ? bearer(authUserId) : {},
      payload: payload as Record<string, unknown>,
    });
  }

  function read(url: string, authUserId: string | null = ADMIN) {
    return harness.app.inject({
      method: 'GET',
      url,
      headers: authUserId ? bearer(authUserId) : {},
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => now });

    for (const [authUserId, firstName] of [
      [ADMIN, 'Ops'],
      [OTHER_ADMIN, 'Ops2'],
      [CUSTOMER, 'Rosa'],
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
  });

  afterEach(async () => {
    now = START;
    // Audit rows go with their operator; the table refuses a direct DELETE.
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('adds the two kinds to the enum the table and the activity filter share', () => {
    expect(ADMIN_ACTIONS).toContain('admin_exported');
    expect(ADMIN_ACTIONS).toContain('admin_data_read');
  });

  it.each(ADMIN_EXPORTS)(
    'records the %s export with its admin, filters and row count',
    async (name) => {
      const adminId = await signInAs(harness, ADMIN, true);

      const response = await exportRequest(ADMIN, {
        export: name,
        filters: '?status=live',
        rowCount: 42,
      });

      expect(response.statusCode).toBe(200);

      const recorded = await rows();
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toMatchObject({
        actorId: adminId,
        action: 'admin_exported',
        subjectType: 'user',
        subjectId: adminId,
        detail: { export: name, filters: '?status=live', rowCount: 42 },
      });
    },
  );

  it('refuses a non-admin and an anonymous caller without a row', async () => {
    await signInAs(harness, ADMIN, true);
    const customerId = await signInAs(harness, CUSTOMER);
    const body = { export: 'vendors', filters: '', rowCount: 1 };

    expect((await exportRequest(CUSTOMER, body)).statusCode).toBe(403);
    expect((await exportRequest(null, body)).statusCode).toBe(401);
    expect((await read(`/admin/customers/${customerId}`, CUSTOMER)).statusCode).toBe(403);
    expect((await read('/admin/payments', CUSTOMER)).statusCode).toBe(403);
    expect(await rows()).toHaveLength(0);
  });

  it('rejects an export nobody offers', async () => {
    await signInAs(harness, ADMIN, true);

    expect(
      (await exportRequest(ADMIN, { export: 'customers', filters: '', rowCount: 1 })).statusCode,
    ).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it('writes one row for a customer read twice inside the hour, and another after it', async () => {
    const adminId = await signInAs(harness, ADMIN, true);
    const customerId = await signInAs(harness, CUSTOMER);

    expect((await read(`/admin/customers/${customerId}`)).statusCode).toBe(200);
    now = new Date(START.getTime() + 59 * MINUTE);
    expect((await read(`/admin/customers/${customerId}`)).statusCode).toBe(200);

    const inHour = await rows();
    expect(inHour).toHaveLength(1);
    expect(inHour[0]).toMatchObject({
      actorId: adminId,
      action: 'admin_data_read',
      subjectType: 'user',
      subjectId: customerId,
      detail: { surface: 'customer_detail' },
    });

    now = new Date(START.getTime() + 61 * MINUTE);
    expect((await read(`/admin/customers/${customerId}`)).statusCode).toBe(200);
    expect(await rows()).toHaveLength(2);
  });

  it('counts each operator and each subject on its own', async () => {
    await signInAs(harness, ADMIN, true);
    await signInAs(harness, OTHER_ADMIN, true);
    const customerId = await signInAs(harness, CUSTOMER);

    await read(`/admin/customers/${customerId}`, ADMIN);
    await read(`/admin/customers/${customerId}`, OTHER_ADMIN);
    await read(`/admin/customers/${MISSING_ID}`, ADMIN);

    // The missing customer 404s and leaves no row; the two operators each have one.
    expect(await rows()).toHaveLength(2);
  });

  it('writes one payments row per operator per hour', async () => {
    const adminId = await signInAs(harness, ADMIN, true);

    expect((await read('/admin/payments')).statusCode).toBe(200);
    expect((await read('/admin/payments?page=2')).statusCode).toBe(200);

    const recorded = await rows();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      actorId: adminId,
      action: 'admin_data_read',
      detail: { surface: 'payments' },
    });
  });
});
