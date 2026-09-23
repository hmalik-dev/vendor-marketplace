import type { ServerResponse } from 'node:http';
import { and, eq } from 'drizzle-orm';
import {
  bookingRequests,
  notifications,
  streamTickets,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { addDays, toDateString } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { StreamTicketStore } from '../../lib/stream-tickets.js';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { expireLapsedRequests } from '../booking-requests/booking-requests.service.js';
import { bookingContextFor, expiryGuardFor } from '../payments/payments.service.js';

/**
 * Two API instances over one real Postgres (VEN-462).
 *
 * PGlite is one connection, so only here can two `delete … returning` statements
 * actually overlap, and only here are "instance A" and "instance B" two pools.
 */
describe('two API instances sharing one database', () => {
  const CUSTOMER = 'user_two_instance_customer';
  const START = new Date('2026-06-01T12:00:00Z');

  let database: PostgresTestDatabase | undefined;
  let a: TestHarness<PostgresTestDatabase> | undefined;
  let b: TestHarness<PostgresTestDatabase> | undefined;
  let customerId: string;

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 8 });
    a = await createTestHarness({ database, clock: () => START });
    b = await createTestHarness({ database, clock: () => START });

    a.authUsers.set(CUSTOMER, {
      authUserId: CUSTOMER,
      email: `${CUSTOMER}@example.com`,
      firstName: 'Two',
      lastName: 'Instances',
      roleHint: 'customer',
      avatarUrl: null,
    });
    // Provisions the account row through a guarded route, as a sign-in does.
    await a.app.inject({ method: 'GET', url: '/v1/users/me', headers: bearer(CUSTOMER) });
    const [row] = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, CUSTOMER));
    customerId = row!.id;
  });

  afterAll(async () => {
    await b?.app.close();
    if (a) {
      await a.close();
    } else {
      await database?.close();
    }
  });

  it('lets exactly one of many racing consumes win a ticket', async () => {
    const issued = await new StreamTicketStore(database!.db).issue(customerId);
    const racers = Array.from({ length: 8 }, () => new StreamTicketStore(database!.db));

    const results = await Promise.all(racers.map((store) => store.consume(issued.ticket)));

    expect(results.filter((who) => who === customerId)).toHaveLength(1);
    expect(results.filter((who) => who === null)).toHaveLength(7);
  });

  it('spends on B what A issued, opens B’s stream, and refuses a second spend on A', async () => {
    const issued = await a!.app.inject({
      method: 'POST',
      url: '/v1/events/stream-ticket',
      headers: bearer(CUSTOMER),
    });
    const { ticket } = issued.json();

    const stream = b!.app.inject({ method: 'GET', url: `/v1/events/stream?ticket=${ticket}` });
    await vi.waitFor(() => expect(b!.app.events.countFor(customerId)).toBe(1));

    const replay = await a!.app.inject({
      method: 'GET',
      url: `/v1/events/stream?ticket=${ticket}`,
    });
    expect(replay.statusCode).toBe(401);

    b!.app.events.closeFor(customerId);
    await stream;
    expect(await database!.db.select().from(streamTickets)).toEqual([]);
  });

  /*
   * VEN-650: each instance LISTENs on a connection of its own, so this is the
   * bus itself — a NOTIFY sent over A's pool, heard on B's listener.
   */
  it('delivers a live event published through A to a stream B holds', async () => {
    const frames: string[] = [];
    const tab = {
      write: (frame: string) => frames.push(frame) > 0,
      end: () => undefined,
    } as unknown as ServerResponse;
    const stop = b!.app.events.subscribe(customerId, tab);
    const event = { type: 'new_notification', notification: { id: 'n-two-instances' } } as const;

    a!.app.events.publish(customerId, event);

    await vi.waitFor(() => expect(frames).toEqual([`data: ${JSON.stringify(event)}\n\n`]));
    stop?.();
  });

  /*
   * Two containers' expiry timers tick together during a rolling deploy. The
   * status change is a guarded UPDATE, so the loser sends nothing.
   */
  it('announces a lapsed request once when both instances sweep it at the same moment', async () => {
    const db = database!.db;
    const [owner] = await db
      .insert(users)
      .values({
        authUserId: 'user_two_instance_owner',
        email: 'owner-two@example.com',
        role: 'vendor',
        firstName: 'Own',
        lastName: 'Er',
      })
      .returning({ id: users.id });
    const [vendor] = await db
      .insert(vendorProfiles)
      .values({
        userId: owner!.id,
        businessName: 'Two Instance Studio',
        slug: 'two-instance-studio',
        city: 'Austin',
        state: 'TX',
        bio: 'Photography for events that run on two containers at once.',
      })
      .returning({ id: vendorProfiles.id });
    await db.insert(bookingRequests).values({
      customerId,
      vendorId: vendor!.id,
      eventDate: toDateString(addDays(START, 60)),
      eventType: 'wedding',
      status: 'pending',
      expiresAt: addDays(START, -1),
    });

    const sweep = (harness: TestHarness<PostgresTestDatabase>): Promise<number> => {
      const context = {
        ...bookingContextFor(harness.app, harness.app.log, 'https://web.test'),
        platformFeeRate: 0.12,
      };

      return expireLapsedRequests(db, START, context.mail, expiryGuardFor(context));
    };

    await Promise.all([sweep(a!), sweep(b!)]);
    await Promise.all([a!.app.background.drain(), b!.app.background.drain()]);

    const told = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, customerId), eq(notifications.type, 'request_expired')));
    expect(told).toHaveLength(1);

    const [row] = await db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .where(eq(bookingRequests.customerId, customerId));
    expect(row?.status).toBe('expired');
  });
});
