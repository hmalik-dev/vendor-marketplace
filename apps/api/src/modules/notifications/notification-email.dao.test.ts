import { eq } from 'drizzle-orm';
import { emailDeliveries, notifications, users } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { findNotificationRecipient, findUserEmail } from './notification-email.dao.js';
import { sendNotificationEmail } from './notification-email.js';

/*
 * VEN-386, against a real Postgres: a row whose address is diverged from Clerk
 * gets its notification in-app only, while the acknowledgement read keeps the
 * stored address.
 */
describe('the notification recipient of a diverged account', () => {
  let harness: TestHarness;
  let userId: string;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterEach(async () => {
    await harness.database.db.delete(emailDeliveries);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(users);
    harness.email.sent.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  async function seedUser(pendingEmail: string | null) {
    const [row] = await harness.database.db
      .insert(users)
      .values({
        authUserId: 'user_diverged',
        email: 'old@example.com',
        pendingEmail,
        emailSyncFailedAt: pendingEmail ? new Date('2026-09-14T00:00:00Z') : null,
        role: 'customer',
        firstName: 'Ada',
        lastName: 'Reyes',
      })
      .returning();

    userId = row!.id;
  }

  it('reads a diverged row as diverged for notifications and as its address for acknowledgements', async () => {
    await seedUser('new@example.com');

    expect(await findNotificationRecipient(harness.database.db, userId)).toEqual({
      emailDiverged: true,
    });
    expect(await findUserEmail(harness.database.db, userId)).toEqual({ email: 'old@example.com' });
  });

  it('reads an agreeing row as its address', async () => {
    await seedUser(null);

    expect(await findNotificationRecipient(harness.database.db, userId)).toEqual({
      email: 'old@example.com',
    });
  });

  it('keeps the in-app notification and sends no email while the address is diverged', async () => {
    await seedUser('new@example.com');
    const [notification] = await harness.database.db
      .insert(notifications)
      .values({
        userId,
        type: 'booking_confirmed',
        title: 'June 14 is confirmed',
        body: 'Payment is held until the event is complete.',
        data: { bookingId: '33333333-3333-4333-8333-333333333333' },
      })
      .returning();

    await sendNotificationEmail(
      {
        db: harness.database.db,
        email: harness.email,
        log: harness.app.log,
        webOrigin: 'http://localhost:3000',
        background: harness.app.background,
      },
      notification!,
    );

    expect(harness.email.sent).toHaveLength(0);
    expect(
      await harness.database.db
        .select()
        .from(emailDeliveries)
        .where(eq(emailDeliveries.notificationId, notification!.id)),
    ).toEqual([]);
    expect(
      await harness.database.db
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.userId, userId)),
    ).toEqual([{ id: notification!.id }]);
  });
});
