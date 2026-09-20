import { emailDeliveries, notifications, vendorInvites } from '@vendor-marketplace/db/schema';
import { EMAIL_RETRY_MAX_ATTEMPTS, EMAIL_RETRY_WINDOW_MS } from '@vendor-marketplace/shared';
import { asc, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';
import { retryFailedEmails } from './email-retry.service.js';

/**
 * VEN-465: a Resend blip no longer drops an email, and the operator can see an
 * invite whose email did not go out.
 *
 * The clock is the real one: the retry's own attempt rows take their `sent_at`
 * from the database, so fixtures are placed relative to now rather than to a
 * pinned instant the database would not agree with.
 */
const HOUR_MS = 60 * 60_000;

describe('the email retry sweep', () => {
  let harness: TestHarness;
  let userId: string;
  let adminAuthId: string;

  beforeAll(async () => {
    harness = await createTestHarness();
    harness.authUsers.set('user_retry_reader', {
      authUserId: 'user_retry_reader',
      email: 'reader@example.com',
      firstName: 'Ada',
      lastName: 'Reyes',
      roleHint: 'customer',
      avatarUrl: null,
    });
    harness.authUsers.set('user_retry_admin', {
      authUserId: 'user_retry_admin',
      email: 'retry-admin@example.com',
      firstName: 'Op',
      lastName: 'Erator',
      roleHint: 'customer',
      avatarUrl: null,
    });
    userId = await signInAs(harness, 'user_retry_reader');
    adminAuthId = 'user_retry_admin';
    await signInAs(harness, adminAuthId, true);
  });

  afterEach(async () => {
    await harness.database.db.delete(emailDeliveries);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(vendorInvites);
    harness.email.sent.length = 0;
    harness.email.messageIdsByKey.clear();
  });

  afterAll(async () => {
    await harness.close();
  });

  function sweep(): Promise<{ notifications: number; invites: number }> {
    const shared = {
      db: harness.database.db,
      email: harness.email,
      log: harness.app.log,
      webOrigin: 'https://web.test',
      background: harness.app.background,
    };

    return retryFailedEmails(
      { notifications: shared, invites: { ...shared, now: () => new Date() } },
      () => new Date(),
    );
  }

  /** A confirmed-booking notification whose only email attempt failed `ageMs` ago. */
  async function failedNotification(
    ageMs: number,
    outcome: 'failed' | 'sent' = 'failed',
  ): Promise<string> {
    const [row] = await harness.database.db
      .insert(notifications)
      .values({
        userId,
        type: 'booking_confirmed',
        title: 'Your booking is confirmed',
        body: 'See you there.',
        data: { bookingId: '33333333-3333-4333-8333-333333333333' },
      })
      .returning({ id: notifications.id });
    const id = row!.id;

    await harness.database.db.insert(emailDeliveries).values({
      notificationId: id,
      userId,
      recipientEmail: 'reader@example.com',
      notificationType: 'booking_confirmed',
      outcome,
      providerMessageId: outcome === 'failed' ? null : `resend-${id}`,
      failureReason: outcome === 'failed' ? 'Resend refused the send (500)' : null,
      sentAt: new Date(Date.now() - ageMs),
    });

    return id;
  }

  async function outcomes(notificationId: string): Promise<string[]> {
    const rows = await harness.database.db
      .select({ outcome: emailDeliveries.outcome })
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, notificationId))
      .orderBy(asc(emailDeliveries.sentAt));

    return rows.map((row) => row.outcome);
  }

  describe('notification email', () => {
    it('re-sends a failed delivery younger than 24 hours, keyed on the notification uuid', async () => {
      const id = await failedNotification(HOUR_MS);

      expect(await sweep()).toEqual({ notifications: 1, invites: 0 });

      expect(harness.email.sent).toHaveLength(1);
      expect(harness.email.sent[0]).toMatchObject({
        to: 'reader@example.com',
        subject: 'Your booking is confirmed',
        idempotencyKey: id,
      });
      expect(await outcomes(id)).toEqual(['failed', 'sent']);
    });

    it('does not re-send a delivery older than 24 hours', async () => {
      const id = await failedNotification(EMAIL_RETRY_WINDOW_MS + HOUR_MS);

      expect(await sweep()).toEqual({ notifications: 0, invites: 0 });

      expect(harness.email.sent).toHaveLength(0);
      expect(await outcomes(id)).toEqual(['failed']);
    });

    it('tries a failing row once per tick and stops at the attempt cap', async () => {
      const id = await failedNotification(HOUR_MS);
      let attempts = 0;
      const send = harness.email.send;
      harness.email.send = async () => {
        attempts += 1;
        throw new Error('Resend refused the send (500)');
      };

      try {
        // One failed row exists; each tick adds exactly one attempt, never two.
        for (let tick = 1; tick <= EMAIL_RETRY_MAX_ATTEMPTS - 1; tick += 1) {
          await sweep();
          expect(attempts).toBe(tick);
        }

        // The cap is reached: a further tick sends nothing.
        await sweep();
        expect(attempts).toBe(EMAIL_RETRY_MAX_ATTEMPTS - 1);
        expect(await outcomes(id)).toEqual(Array(EMAIL_RETRY_MAX_ATTEMPTS).fill('failed'));
      } finally {
        harness.email.send = send;
      }
    });

    it('never re-sends a row that was sent or delivered', async () => {
      const sent = await failedNotification(HOUR_MS, 'sent');
      const delivered = await failedNotification(HOUR_MS, 'sent');
      await harness.database.db
        .update(emailDeliveries)
        .set({ outcome: 'delivered' })
        .where(eq(emailDeliveries.notificationId, delivered));

      expect(await sweep()).toEqual({ notifications: 0, invites: 0 });

      expect(harness.email.sent).toHaveLength(0);
      expect(await outcomes(sent)).toEqual(['sent']);
      expect(await outcomes(delivered)).toEqual(['delivered']);
    });

    it('does not re-send once a later attempt got through', async () => {
      const id = await failedNotification(2 * HOUR_MS);
      await harness.database.db.insert(emailDeliveries).values({
        notificationId: id,
        userId,
        recipientEmail: 'reader@example.com',
        notificationType: 'booking_confirmed',
        outcome: 'sent',
        providerMessageId: 'resend-later',
        sentAt: new Date(Date.now() - HOUR_MS),
      });

      await sweep();

      expect(harness.email.sent).toHaveLength(0);
    });
  });

  describe('vendor invites', () => {
    let inviteCount = 0;

    async function invite(overrides: Partial<typeof vendorInvites.$inferInsert>): Promise<string> {
      const [row] = await harness.database.db
        .insert(vendorInvites)
        .values({
          email: `invitee-${(inviteCount += 1)}@example.com`,
          ...overrides,
        })
        .returning({ id: vendorInvites.id });

      return row!.id;
    }

    const failedAgo = (ms: number): Partial<typeof vendorInvites.$inferInsert> => ({
      emailAttempts: 1,
      emailLastAttemptAt: new Date(Date.now() - ms),
      emailFailureReason: 'Resend refused the send (500)',
    });

    it('re-sends a failed invite under its original idempotency key and records it', async () => {
      const id = await invite(failedAgo(HOUR_MS));

      expect(await sweep()).toEqual({ notifications: 0, invites: 1 });

      expect(harness.email.sent).toHaveLength(1);
      expect(harness.email.sent[0]?.idempotencyKey).toBe(`vendor-invite-${id}`);
      const [row] = await harness.database.db
        .select()
        .from(vendorInvites)
        .where(eq(vendorInvites.id, id));
      expect(row).toMatchObject({ emailAttempts: 2, emailFailureReason: null });
      expect(row?.emailSentAt).toBeInstanceOf(Date);
    });

    it('skips an invite older than 24 hours, one that was sent, one used, and one at the cap', async () => {
      await invite(failedAgo(EMAIL_RETRY_WINDOW_MS + HOUR_MS));
      await invite({ ...failedAgo(HOUR_MS), emailSentAt: new Date() });
      await invite({ ...failedAgo(HOUR_MS), acceptedAt: new Date() });
      await invite({ ...failedAgo(HOUR_MS), emailAttempts: EMAIL_RETRY_MAX_ATTEMPTS });
      await invite({});

      expect(await sweep()).toEqual({ notifications: 0, invites: 0 });
      expect(harness.email.sent).toHaveLength(0);
    });

    it('lists a failed invite as failed, and resending it goes through the same path', async () => {
      const id = await invite(failedAgo(EMAIL_RETRY_WINDOW_MS + HOUR_MS));
      const headers = bearer(adminAuthId);

      const before = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendor-invites',
        headers,
      });
      expect(before.json().items[0]).toMatchObject({
        id,
        emailStatus: 'failed',
        emailFailureReason: 'Resend refused the send (500)',
      });

      const resent = await harness.app.inject({
        method: 'POST',
        url: `/admin/vendor-invites/${id}/resend`,
        headers,
      });
      expect(resent.statusCode).toBe(200);
      expect(resent.json()).toMatchObject({ id, emailStatus: 'sent', emailFailureReason: null });
      expect(harness.email.sent.map((message) => message.idempotencyKey)).toEqual([
        `vendor-invite-${id}`,
      ]);

      const again = await harness.app.inject({
        method: 'POST',
        url: `/admin/vendor-invites/${id}/resend`,
        headers,
      });
      expect(again.statusCode).toBe(409);
      expect(harness.email.sent).toHaveLength(1);
    });

    it('answers 404 for an unknown invite and refuses a non-admin', async () => {
      const missing = await harness.app.inject({
        method: 'POST',
        url: '/admin/vendor-invites/44444444-4444-4444-8444-444444444444/resend',
        headers: bearer(adminAuthId),
      });
      expect(missing.statusCode).toBe(404);

      const customer = await harness.app.inject({
        method: 'POST',
        url: '/admin/vendor-invites/44444444-4444-4444-8444-444444444444/resend',
        headers: bearer('user_retry_reader'),
      });
      expect(customer.statusCode).toBe(403);
    });

    it('records a failed first send, so the operator sees it', async () => {
      const headers = bearer(adminAuthId);
      harness.email.failNext = true;

      const created = await harness.app.inject({
        method: 'POST',
        url: '/admin/vendor-invites',
        headers,
        payload: { email: 'first-send-fails@example.com' },
      });
      expect(created.statusCode).toBe(201);
      await harness.flushEmail();

      const [row] = await harness.database.db
        .select()
        .from(vendorInvites)
        .where(eq(vendorInvites.email, 'first-send-fails@example.com'));
      expect(row).toMatchObject({
        emailAttempts: 1,
        emailSentAt: null,
        emailFailureReason: 'Resend refused the send (500)',
      });
    });
  });
});
