import { emailDeliveries, users } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { applyDeliveryEvent, insertEmailDelivery } from './email-delivery.dao.js';

/**
 * The delivery record's two guards, on the **driver production uses** and under
 * real contention.
 *
 * Both are exactly the shape `pnpm test` cannot see. PGlite holds a single
 * connection, so two `applyDeliveryEvent` calls fired with `Promise.all` never
 * overlap there: each runs to completion before the next begins, and the
 * `UPDATE`'s rank predicate would pass a green suite with it deleted (#399).
 * Resend, meanwhile, retries — two deliveries of the same event genuinely are
 * in flight at once — so the case this suite covers is the one that happens.
 *
 * The unique index has the same problem. It exists so two rows can never claim
 * one provider message id, which decides "which record does this bounce belong
 * to"; nothing serialised can put it under the concurrent insert it is for.
 */
describe('the email delivery record, under real contention', () => {
  const USER_ID = '11111111-1111-4111-8111-111111111111';
  const MESSAGE_ID = 'resend-contention-message';

  let database: PostgresTestDatabase;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();

    await database.db.insert(users).values({
      id: USER_ID,
      clerkUserId: 'clerk_delivery_contention',
      email: 'reader@example.com',
      role: 'customer',
      firstName: 'Ada',
      lastName: 'Reyes',
    });
  });

  afterEach(async () => {
    await database.db.delete(emailDeliveries);
  });

  afterAll(async () => {
    await database.db.delete(users);
    await database.close();
  });

  async function recordAttempt(providerMessageId: string | null): Promise<void> {
    await insertEmailDelivery(database.db, {
      notificationId: '22222222-2222-4222-8222-222222222222',
      userId: USER_ID,
      recipientEmail: 'reader@example.com',
      notificationType: 'booking_confirmed',
      relatedEntityType: 'booking',
      relatedEntityId: '33333333-3333-4333-8333-333333333333',
      outcome: providerMessageId === null ? 'failed' : 'sent',
      providerMessageId,
      failureReason: null,
    });
  }

  /**
   * Two connections applying the *same* event at once. Exactly one may report
   * `applied`; a second would mean the predicate was evaluated before either
   * wrote, which is the read-modify-write this is written as an `UPDATE ...
   * WHERE` to avoid.
   */
  it('applies one of two simultaneous deliveries of the same event', async () => {
    await recordAttempt(MESSAGE_ID);

    const event = {
      providerMessageId: MESSAGE_ID,
      outcome: 'delivered' as const,
      failureReason: null,
      occurredAt: new Date('2026-03-04T09:15:00.000Z'),
    };

    const outcomes = await Promise.all([
      applyDeliveryEvent(database.db, event),
      applyDeliveryEvent(database.db, event),
    ]);

    expect(outcomes.filter((outcome) => outcome === 'applied')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === 'superseded')).toHaveLength(1);

    const rows = await database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.providerMessageId, MESSAGE_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe('delivered');
  });

  /**
   * A bounce and a delivery racing each other. Whichever lands second, the
   * bounce stands — it outranks `delivered`, and it is the outcome that says
   * the *address* is dead rather than that this message arrived.
   */
  it('leaves the bounce standing however the race is ordered', async () => {
    await recordAttempt(MESSAGE_ID);

    const at = new Date('2026-03-04T09:15:00.000Z');
    await Promise.all([
      applyDeliveryEvent(database.db, {
        providerMessageId: MESSAGE_ID,
        outcome: 'bounced',
        failureReason: 'Permanent/General',
        occurredAt: at,
      }),
      applyDeliveryEvent(database.db, {
        providerMessageId: MESSAGE_ID,
        outcome: 'delivered',
        failureReason: null,
        occurredAt: at,
      }),
    ]);

    const [row] = await database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.providerMessageId, MESSAGE_ID));
    expect(row?.outcome).toBe('bounced');
    expect(row?.failureReason).toBe('Permanent/General');
  });

  /**
   * Two attempts carrying one provider message id, which is what a send Resend
   * deduplicated looks like: the replayed idempotency key is answered with the
   * id of the message it already accepted. The second insert must be a no-op
   * rather than a raised constraint — the caller's catch is best-effort, so a
   * raise would be swallowed after logging the recipient's address on the way
   * past. Fired concurrently, because that is the only way the index arbitrates
   * rather than a prior read.
   */
  it('keeps one row when two attempts claim one provider message id', async () => {
    await Promise.all([recordAttempt(MESSAGE_ID), recordAttempt(MESSAGE_ID)]);

    const rows = await database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.providerMessageId, MESSAGE_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe('sent');
  });

  /**
   * The partial index's whole point. A failed send never got an id, and a plain
   * unique index would let the first `failed` row block every one after it —
   * turning the record of a Resend outage into a single row plus a stream of
   * insert errors the best-effort catch would swallow.
   */
  it('allows any number of failed attempts, which carry no id to collide on', async () => {
    await Promise.all([recordAttempt(null), recordAttempt(null), recordAttempt(null)]);

    const rows = await database.db.select().from(emailDeliveries);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.outcome === 'failed')).toBe(true);
  });
});
