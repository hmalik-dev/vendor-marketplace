import {
  emailDeliveries,
  notifications,
  users,
  vendorInvites,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import type { EmailGateway, EmailMessage } from '../../lib/email.js';
import { createBackgroundWork } from '../../lib/background.js';
import { resendVendorInvite } from '../vendor-invites/vendor-invites.service.js';
import { retryFailedEmails, type EmailRetryDeps } from './email-retry.service.js';

/**
 * VEN-465: two overlapping sweeps send a row once.
 *
 * On the driver production uses, because PGlite runs each transaction to
 * completion before the next begins: two `Promise.all`'d sweeps never overlap
 * there, and the `SKIP LOCKED` claim would pass a green suite with it deleted.
 * The sender is slow on purpose — it holds the first sweep's row lock open for
 * long enough that the second sweep is guaranteed to arrive while it is held.
 */
describe('the email retry sweep, under real contention', () => {
  const USER_ID = '11111111-1111-4111-8111-111111111111';
  const HOUR_MS = 60 * 60_000;
  const SEND_DELAY_MS = 300;

  let database: PostgresTestDatabase;
  let sent: EmailMessage[];

  const log = {
    error: () => undefined,
    info: () => undefined,
    warn: () => undefined,
  } as unknown as EmailRetryDeps['notifications']['log'];

  const slowEmail: EmailGateway = {
    send: async (message) => {
      await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
      sent.push(message);
      return { providerMessageId: `resend-${message.idempotencyKey}` };
    },
  };

  function deps(): EmailRetryDeps {
    const shared = {
      db: database.db,
      email: slowEmail,
      log,
      webOrigin: 'https://web.test',
      background: createBackgroundWork(log),
    };

    return { notifications: shared, invites: { ...shared, now: () => new Date() } };
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase();

    await database.db.insert(users).values({
      id: USER_ID,
      authUserId: 'auth_retry_contention',
      email: 'reader@example.com',
      role: 'customer',
      firstName: 'Ada',
      lastName: 'Reyes',
    });
  });

  afterEach(async () => {
    sent = [];
    await database.db.delete(emailDeliveries);
    await database.db.delete(notifications);
    await database.db.delete(vendorInvites);
  });

  afterAll(async () => {
    await database.db.delete(users);
    await database.close();
  });

  it('sends a failed notification email once when two sweeps overlap', async () => {
    sent = [];
    const [row] = await database.db
      .insert(notifications)
      .values({
        userId: USER_ID,
        type: 'booking_confirmed',
        title: 'Your booking is confirmed',
        data: { bookingId: '33333333-3333-4333-8333-333333333333' },
      })
      .returning({ id: notifications.id });

    await database.db.insert(emailDeliveries).values({
      notificationId: row!.id,
      userId: USER_ID,
      recipientEmail: 'reader@example.com',
      notificationType: 'booking_confirmed',
      outcome: 'failed',
      sentAt: new Date(Date.now() - HOUR_MS),
    });

    const totals = await Promise.all([
      retryFailedEmails(deps(), () => new Date()),
      retryFailedEmails(deps(), () => new Date()),
    ]);

    expect(sent.map((message) => message.idempotencyKey)).toEqual([row!.id]);
    expect(totals.reduce((sum, total) => sum + total.notifications, 0)).toBe(1);

    const attempts = await database.db
      .select({ outcome: emailDeliveries.outcome })
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, row!.id));
    expect(attempts.map((attempt) => attempt.outcome).sort()).toEqual(['failed', 'sent']);
  });

  it('sends a failed invite once when two sweeps overlap', async () => {
    sent = [];
    const [row] = await database.db
      .insert(vendorInvites)
      .values({
        email: 'invitee@example.com',
        emailAttempts: 1,
        emailLastAttemptAt: new Date(Date.now() - HOUR_MS),
        emailFailureReason: 'Resend refused the send (500)',
      })
      .returning({ id: vendorInvites.id });

    const totals = await Promise.all([
      retryFailedEmails(deps(), () => new Date()),
      retryFailedEmails(deps(), () => new Date()),
    ]);

    expect(sent.map((message) => message.idempotencyKey)).toEqual([`vendor-invite-${row!.id}`]);
    expect(totals.reduce((sum, total) => sum + total.invites, 0)).toBe(1);
  });

  it('makes an operator resend that overlaps a sweep wait, then refuse: one send', async () => {
    sent = [];
    const [row] = await database.db
      .insert(vendorInvites)
      .values({
        email: 'invitee@example.com',
        emailAttempts: 1,
        emailLastAttemptAt: new Date(Date.now() - HOUR_MS),
        emailFailureReason: 'Resend refused the send (500)',
      })
      .returning({ id: vendorInvites.id });

    const sweep = retryFailedEmails(deps(), () => new Date());
    // Let the sweep take its row lock before the operator's request arrives.
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS / 3));
    // Settled at once, so its refusal is never an unhandled rejection while the sweep finishes.
    const refusal = resendVendorInvite(deps().invites, row!.id).then(
      () => null,
      (error: unknown) => error,
    );

    await sweep;
    expect(await refusal).toMatchObject({ statusCode: 409 });
    expect(sent).toHaveLength(1);
  });
});
