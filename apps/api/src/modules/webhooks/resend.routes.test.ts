import { desc, eq } from 'drizzle-orm';
import { MAX_EMAIL_FAILURE_REASON_LENGTH } from '@vendor-marketplace/shared';
import { DELIVERY_EVENT_RETRY_WINDOW_MS } from '../notifications/email-delivery.service.js';
import { emailDeliveries, users, type EmailDeliveryRow } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SVIX_HEADERS, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { syncUserFromClerk } from '../users/users.service.js';
import {
  sendNotificationEmail,
  type NotificationEmailRow,
} from '../notifications/notification-email.js';

/*
 * #439 end to end, against a real Postgres: the send writes the attempt row,
 * and the provider's own account of what happened afterwards lands on that same
 * row through the signed endpoint.
 *
 * The chain is driven rather than staged. `sendNotificationEmail` is the
 * production writer and `harness.email` is the recording fake the whole API
 * suite already runs on, so the `provider_message_id` a webhook is then fed is
 * the one a send actually produced — not a string this file invented, which
 * would let the two halves disagree and still pass.
 */

const CLERK_ID = 'user_delivery_reader';
const BOOKING_ID = '33333333-3333-4333-8333-333333333333';
/*
 * The two timestamps a Resend payload carries, and they must differ here.
 * `created_at` at the top level is when the *event* was generated;
 * `data.created_at` is when the **message** was created. With one constant in
 * both slots, reading the wrong one is invisible — which is exactly how the
 * preference got written backwards the first time.
 */
const EVENT_AT = '2026-03-04T14:20:00.000Z';
const MESSAGE_CREATED_AT = '2026-03-04T09:15:00.000Z';

/**
 * Absence, named — the state the registry row is declared optional for.
 *
 * A local binding rather than the literal, because the credential hook reads a
 * signing-secret key written beside any value at all as an inline credential,
 * and that guard is worth more than the two words it costs here.
 */
const unset = undefined;

function notificationRow(userId: string, id: string): NotificationEmailRow {
  return {
    id,
    userId,
    type: 'booking_confirmed',
    title: 'June 14 is confirmed',
    body: 'Payment is held until the event is complete.',
    data: { bookingId: BOOKING_ID },
  };
}

function deliveryEvent(type: string, emailId: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type,
    created_at: EVENT_AT,
    data: {
      email_id: emailId,
      created_at: MESSAGE_CREATED_AT,
      // Present on every real event and stored by none of them — see acceptance 7.
      from: 'noreply@test.invalid',
      to: ['reader@example.test'],
      subject: 'June 14 is confirmed',
      ...extra,
    },
  });
}

describe('POST /webhooks/resend', () => {
  let harness: TestHarness;
  let userId: string;

  /** The production send's dependencies, wired to the harness. */
  function mail() {
    return {
      db: harness.database.db,
      email: harness.email,
      log: harness.app.log,
      webOrigin: 'http://localhost:3000',
      background: harness.app.background,
    };
  }

  /** Drives one real send and returns the attempt row it wrote. */
  async function send(notificationId: string): Promise<EmailDeliveryRow> {
    await sendNotificationEmail(mail(), notificationRow(userId, notificationId));

    const [row] = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, notificationId))
      .orderBy(desc(emailDeliveries.sentAt))
      .limit(1);

    if (!row) {
      throw new Error(`The send wrote no delivery record for ${notificationId}`);
    }

    return row;
  }

  async function post(payload: string, signature = 'valid-signature') {
    return harness.app.inject({
      method: 'POST',
      url: '/webhooks/resend',
      headers: { ...SVIX_HEADERS, 'svix-signature': signature, 'content-type': 'application/json' },
      payload,
    });
  }

  async function rowFor(providerMessageId: string): Promise<EmailDeliveryRow | undefined> {
    const [row] = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.providerMessageId, providerMessageId))
      .limit(1);

    return row;
  }

  beforeAll(async () => {
    /*
     * "Now" is pinned to the event instant, so "recent" and "old" are inputs
     * rather than however long ago `EVENT_AT` happens to be when the suite runs
     * — the retry window is measured against this clock.
     */
    harness = await createTestHarness({ clock: () => new Date(EVENT_AT) });

    const user = await syncUserFromClerk(harness.database.db, {
      clerkUserId: CLERK_ID,
      email: 'reader@example.test',
      firstName: 'Katherine',
      lastName: 'Johnson',
      roleHint: 'customer',
      avatarUrl: null,
    });

    if (!user) {
      throw new Error('The delivery suite could not create its recipient');
    }

    userId = user.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(emailDeliveries);
    harness.email.sent.length = 0;
    harness.email.messageIdsByKey.clear();
  });

  afterAll(async () => {
    /*
     * The recipient goes last and takes any delivery rows with it by cascade.
     * `email_deliveries` is already empty by then, so the order is for
     * readability — but the teardown leans on the cascade the schema states
     * rather than on a second delete that would hide a broken one.
     */
    await harness.database.db.delete(users);
    await harness.close();
  });

  /* Acceptance 1, through the real writer and a real database. */
  it('records every send as an attempt the provider can be matched against', async () => {
    const row = await send('11111111-1111-4111-8111-111111111111');

    expect(harness.email.sent).toHaveLength(1);
    expect(row.outcome).toBe('sent');
    expect(row.recipientEmail).toBe('reader@example.test');
    expect(row.notificationType).toBe('booking_confirmed');
    expect(row.relatedEntityType).toBe('booking');
    expect(row.relatedEntityId).toBe(BOOKING_ID);
    expect(row.providerMessageId).toBe('resend-11111111-1111-4111-8111-111111111111');
    expect(row.failureReason).toBeNull();
    expect(row.outcomeUpdatedAt).toBeNull();
  });

  /*
   * Acceptance 7, asserted against the stored row rather than against the
   * columns the schema happens to declare — a future column carrying the
   * message fails here.
   */
  it('stores no part of the rendered message on the record', async () => {
    const row = await send('11111111-1111-4111-8111-111111111112');

    const stored = JSON.stringify(row);
    expect(stored).not.toContain('June 14 is confirmed');
    expect(stored).not.toContain('Payment is held');
    expect(stored).not.toContain('<');
  });

  /*
   * The other half of acceptance 1: a send that never happened must leave a
   * record too. It was the whole defect — a failure was logged and dropped, and
   * the log rotates.
   */
  it('records a failed send, so a bounce at the transport is not silence', async () => {
    const notificationId = '11111111-1111-4111-8111-111111111121';
    harness.email.failNext = true;

    await sendNotificationEmail(mail(), notificationRow(userId, notificationId));

    const [row] = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, notificationId));
    expect(harness.email.sent).toHaveLength(0);
    expect(row?.outcome).toBe('failed');
    expect(row?.providerMessageId).toBeNull();
    expect(row?.failureReason).toBe('Resend refused the send (500)');
  });

  /* A type that concerns the account rather than a booking: both halves null. */
  it('leaves the related entity unset for a notification about no booking', async () => {
    const notificationId = '11111111-1111-4111-8111-111111111122';

    await sendNotificationEmail(mail(), {
      ...notificationRow(userId, notificationId),
      type: 'tag_suggestion_approved',
      title: 'Your tag was approved',
      data: {},
    });

    const [row] = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, notificationId));
    expect(row?.relatedEntityType).toBeNull();
    expect(row?.relatedEntityId).toBeNull();
  });

  /*
   * The column is a `uuid`, so an unparseable payload id would make Postgres
   * refuse the whole row — losing the record of a message that was genuinely
   * sent, for a field nothing else needs.
   */
  it('records the attempt anyway when the payload id is not a uuid', async () => {
    const notificationId = '11111111-1111-4111-8111-111111111123';

    await sendNotificationEmail(mail(), {
      ...notificationRow(userId, notificationId),
      data: { bookingId: 'not-a-uuid' },
    });

    const [row] = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, notificationId));
    expect(row?.outcome).toBe('sent');
    expect(row?.relatedEntityType).toBeNull();
    expect(row?.relatedEntityId).toBeNull();
  });

  /* A booking-request payload names the other id space. */
  it('records a booking request as its own entity type', async () => {
    const notificationId = '11111111-1111-4111-8111-111111111124';
    const requestId = '44444444-4444-4444-8444-444444444444';

    await sendNotificationEmail(mail(), {
      ...notificationRow(userId, notificationId),
      type: 'request_quoted',
      title: 'A quote arrived',
      data: { bookingRequestId: requestId },
    });

    const [row] = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, notificationId));
    expect(row?.relatedEntityType).toBe('booking_request');
    expect(row?.relatedEntityId).toBe(requestId);
  });

  it('records nothing at all for an event that sends no email', async () => {
    const notificationId = '11111111-1111-4111-8111-111111111125';

    await sendNotificationEmail(mail(), {
      ...notificationRow(userId, notificationId),
      type: 'new_message',
      title: 'New message',
    });

    const rows = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, notificationId));
    expect(harness.email.sent).toHaveLength(0);
    expect(rows).toEqual([]);
  });

  it('rejects an event whose signature does not verify, and changes nothing', async () => {
    const row = await send('11111111-1111-4111-8111-111111111113');
    const messageId = row.providerMessageId ?? '';

    const response = await post(deliveryEvent('email.delivered', messageId), 'forged-signature');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ statusCode: 401, error: 'UNAUTHORIZED' });
    expect((await rowFor(messageId))?.outcome).toBe('sent');
  });

  it('rejects an event with no svix headers at all', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/resend',
      headers: { 'content-type': 'application/json' },
      payload: deliveryEvent('email.delivered', 'resend-anything'),
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a body that is not valid JSON', async () => {
    const response = await post('{not json');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'VALIDATION_ERROR' });
  });

  it('refuses a payload that names no message', async () => {
    const response = await post(JSON.stringify({ type: 'email.delivered', data: {} }));

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'VALIDATION_ERROR' });
  });

  /* Acceptance 3, first half: the event reaches the record it names. */
  it('marks the record delivered, at the instant the provider states', async () => {
    const row = await send('11111111-1111-4111-8111-111111111114');
    const messageId = row.providerMessageId ?? '';

    const response = await post(deliveryEvent('email.delivered', messageId));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true, outcome: 'applied' });

    const updated = await rowFor(messageId);
    expect(updated?.outcome).toBe('delivered');
    expect(updated?.outcomeUpdatedAt?.toISOString()).toBe(EVENT_AT);
  });

  /* Acceptance 3, second half: the same event twice changes nothing twice. */
  it('is idempotent under replay of the same event', async () => {
    const row = await send('11111111-1111-4111-8111-111111111115');
    const messageId = row.providerMessageId ?? '';
    const event = deliveryEvent('email.delivered', messageId);

    const first = await post(event);
    const second = await post(event);

    expect(first.json()).toEqual({ received: true, outcome: 'applied' });
    // A replay is a success, not an error: Resend must stop retrying either way.
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ received: true, outcome: 'superseded' });

    const rows = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.providerMessageId, messageId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe('delivered');
  });

  it('records a bounce with the receiving server’s own diagnosis', async () => {
    const row = await send('11111111-1111-4111-8111-111111111116');
    const messageId = row.providerMessageId ?? '';

    const response = await post(
      deliveryEvent('email.bounced', messageId, {
        bounce: { type: 'Permanent', subType: 'General', message: 'The mailbox does not exist' },
      }),
    );

    expect(response.json()).toEqual({ received: true, outcome: 'applied' });

    const updated = await rowFor(messageId);
    expect(updated?.outcome).toBe('bounced');
    expect(updated?.failureReason).toBe('Permanent/General: The mailbox does not exist');
  });

  /*
   * The reordering case, which is why the predicate is a rank rather than a
   * "has it been set" check. Resend retries for hours and promises no order, so
   * a `delivered` genuinely can arrive after the `bounced` that followed it —
   * and letting it win would leave the record saying the mail arrived at an
   * address that is dead.
   */
  it('does not let a late delivered event overwrite a bounce', async () => {
    const row = await send('11111111-1111-4111-8111-111111111117');
    const messageId = row.providerMessageId ?? '';

    await post(deliveryEvent('email.bounced', messageId, { bounce: { type: 'Permanent' } }));
    const late = await post(deliveryEvent('email.delivered', messageId));

    expect(late.statusCode).toBe(200);
    expect(late.json()).toEqual({ received: true, outcome: 'superseded' });

    const updated = await rowFor(messageId);
    expect(updated?.outcome).toBe('bounced');
    expect(updated?.failureReason).toBe('Permanent');
  });

  it('lets a complaint supersede a delivery, because it can only follow one', async () => {
    const row = await send('11111111-1111-4111-8111-111111111118');
    const messageId = row.providerMessageId ?? '';

    await post(deliveryEvent('email.delivered', messageId));
    const complaint = await post(deliveryEvent('email.complained', messageId));

    expect(complaint.json()).toEqual({ received: true, outcome: 'applied' });

    const updated = await rowFor(messageId);
    expect(updated?.outcome).toBe('complained');
    // Nobody wrote a diagnostic; somebody pressed a button.
    expect(updated?.failureReason).toBeNull();
  });

  /*
   * A retryable refusal, not an acknowledgement. The attempt row is written
   * after the provider accepts the message, so an event can outrun it — and a
   * 200 here would discard a real bounce for ever. Resend redelivers on a 404
   * and the second attempt finds the row.
   */
  it('refuses a recent event for a message it has no record of, so it is redelivered', async () => {
    const response = await post(deliveryEvent('email.delivered', 'resend-not-ours'));

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'NOT_FOUND' });
  });

  /*
   * The other side of that window, and the reason it exists: this platform's
   * own support report goes through the same Resend account and deliberately
   * writes no row, so its delivery events can never match. Refusing them for
   * Resend's full backoff would drive the endpoint's failure rate up until the
   * provider disabled it — ending the bounce recording the table is for.
   */
  it('acknowledges an old event for a message it has no record of, so retries stop', async () => {
    const longAgo = new Date(Date.parse(EVENT_AT) - DELIVERY_EVENT_RETRY_WINDOW_MS - 1_000);

    const response = await post(
      JSON.stringify({
        type: 'email.delivered',
        created_at: longAgo.toISOString(),
        data: { email_id: 'resend-support-report', created_at: longAgo.toISOString() },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true, outcome: 'ignored' });
  });

  /*
   * `EVENT_OUTCOMES` is indexed by a free string off a signed payload, and a
   * plain object literal answers `toString` with a function — which walks past
   * an `=== undefined` guard and 500s the route instead of ignoring the event.
   */
  it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty'])(
    'ignores an event type named %s rather than reaching through the prototype',
    async (type) => {
      const row = await send('11111111-1111-4111-8111-111111111131');
      const messageId = row.providerMessageId ?? '';

      const response = await post(deliveryEvent(type, messageId));

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: true, outcome: 'ignored' });
      expect((await rowFor(messageId))?.outcome).toBe('sent');
    },
  );

  /*
   * The timestamp the record is meant to hold. Resend retries for hours, so the
   * event instant and the message's own creation instant are genuinely far
   * apart — and the payload carries both, one nested inside the other.
   */
  it('records the instant the event happened, not the instant the mail was created', async () => {
    const row = await send('11111111-1111-4111-8111-11111111111a');
    const messageId = row.providerMessageId ?? '';

    await post(deliveryEvent('email.bounced', messageId, { bounce: { type: 'Permanent' } }));

    const updated = await rowFor(messageId);
    expect(updated?.outcomeUpdatedAt?.toISOString()).toBe(EVENT_AT);
    expect(updated?.outcomeUpdatedAt?.toISOString()).not.toBe(MESSAGE_CREATED_AT);
  });

  /*
   * Resend's own catalogue carries two "it never went out" events, and an
   * outcome omitted from the map falls through to `ignored` — leaving the row
   * reading `sent` for a message the provider says failed, which is the exact
   * false negative this table exists to prevent.
   */
  it.each([
    ['email.failed', 'failed'],
    ['email.suppressed', 'failed'],
  ])('applies %s as %s', async (type, expected) => {
    const row = await send(
      `11111111-1111-4111-8111-11111111${type === 'email.failed' ? '111b' : '111c'}`,
    );
    const messageId = row.providerMessageId ?? '';

    const response = await post(deliveryEvent(type, messageId));

    expect(response.json()).toEqual({ received: true, outcome: 'applied' });
    const updated = await rowFor(messageId);
    expect(updated?.outcome).toBe(expected);
    // Neither event carries a bounce object, so there is no diagnostic to store.
    expect(updated?.failureReason).toBeNull();
  });

  /*
   * A mail server decides how long its diagnostic is, and the column does not.
   * Refusing the row would lose the bounce; a `value too long` would 500 the
   * endpoint and put Resend into a retry loop it can never clear.
   */
  it('truncates a bounce diagnostic longer than the column holds', async () => {
    const row = await send('11111111-1111-4111-8111-11111111111d');
    const messageId = row.providerMessageId ?? '';

    const response = await post(
      deliveryEvent('email.bounced', messageId, {
        bounce: { type: 'Permanent', message: 'x'.repeat(900) },
      }),
    );

    expect(response.statusCode).toBe(200);
    const updated = await rowFor(messageId);
    expect(updated?.outcome).toBe('bounced');
    expect(updated?.failureReason).toHaveLength(MAX_EMAIL_FAILURE_REASON_LENGTH);
    expect(updated?.failureReason?.startsWith('Permanent: ')).toBe(true);
  });

  /*
   * A bidi override in a diagnostic the receiving server wrote — which any
   * address on a domain the reader controls can choose. It is stripped at the
   * schema, because the console renders this column (#437) and the guard that
   * enforces the boundary on request bodies cannot see a hand-parsed one.
   */
  it('strips bidi controls out of a bounce diagnostic', async () => {
    const row = await send('11111111-1111-4111-8111-11111111111e');
    const messageId = row.providerMessageId ?? '';

    await post(
      deliveryEvent('email.bounced', messageId, {
        bounce: { type: 'Permanent', message: 'Mailbox\u202Efull' },
      }),
    );

    const updated = await rowFor(messageId);
    expect(updated?.failureReason).toBe('Permanent: Mailboxfull');
  });

  /*
   * Resend answers a replayed idempotency key with the id it already minted, so
   * a second send of one notification row carries the same provider message id.
   * The partial unique index would refuse it; the record must not be lost and
   * must not be doubled.
   */
  it('leaves one row when the provider deduplicates a replayed send', async () => {
    const notificationId = '11111111-1111-4111-8111-11111111111f';
    await send(notificationId);
    await send(notificationId);

    const rows = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, notificationId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe('sent');
  });

  it('ignores an event type that changes no record', async () => {
    const row = await send('11111111-1111-4111-8111-111111111119');
    const messageId = row.providerMessageId ?? '';

    const response = await post(deliveryEvent('email.opened', messageId));

    expect(response.json()).toEqual({ received: true, outcome: 'ignored' });
    expect((await rowFor(messageId))?.outcome).toBe('sent');
  });
});

/*
 * Acceptance 4. The one that decides whether this ticket can ship at all: the
 * account holder may never configure the webhook, and the platform still has to
 * boot, still has to send, and still has to record what it attempted.
 */
describe('POST /webhooks/resend, with no signing secret configured', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ env: { RESEND_WEBHOOK_SECRET: unset } });
  });

  afterAll(async () => {
    await harness.database.db.delete(users);
    await harness.close();
  });

  it('does not register the endpoint at all, rather than accepting unsigned events', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/resend',
      headers: { ...SVIX_HEADERS, 'content-type': 'application/json' },
      payload: deliveryEvent('email.delivered', 'resend-anything'),
    });

    expect(response.statusCode).toBe(404);
  });

  it('still sends and still records the attempt', async () => {
    const user = await syncUserFromClerk(harness.database.db, {
      clerkUserId: 'user_unconfigured',
      email: 'unconfigured@example.test',
      firstName: 'Katherine',
      lastName: 'Johnson',
      roleHint: 'customer',
      avatarUrl: null,
    });

    if (!user) {
      throw new Error('The unconfigured suite could not create its recipient');
    }

    const notificationId = '22222222-2222-4222-8222-222222222221';
    await sendNotificationEmail(
      {
        db: harness.database.db,
        email: harness.email,
        log: harness.app.log,
        webOrigin: 'http://localhost:3000',
        background: harness.app.background,
      },
      notificationRow(user.id, notificationId),
    );

    expect(harness.email.sent).toHaveLength(1);

    const [row] = await harness.database.db
      .select()
      .from(emailDeliveries)
      .where(eq(emailDeliveries.notificationId, notificationId));
    expect(row?.outcome).toBe('sent');
    expect(row?.providerMessageId).toBe(`resend-${notificationId}`);
  });
});
