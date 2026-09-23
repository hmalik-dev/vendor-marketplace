import type { ServerResponse } from 'node:http';
import { MESSAGE_MAX_LENGTH } from '@vendor-marketplace/shared';
import { realtimeEvents, users } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NOTIFY_PAYLOAD_LIMIT_BYTES } from '../../lib/event-bus.js';
import type { StreamEvent } from '../../lib/event-stream.js';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const CUSTOMER = 'user_replicas_customer';

/**
 * VEN-650 — two API instances over one database, each with its own event hub
 * and its own `LISTEN`: what a rolling deploy runs. Before the bus, a message
 * published through one never reached a stream held open by the other.
 */
describe('live events across two API instances', () => {
  let a: TestHarness;
  let b: TestHarness;
  let customerId: string;

  beforeAll(async () => {
    a = await createTestHarness();
    b = await createTestHarness({ database: a.database });
    b.authUsers.set(CUSTOMER, {
      authUserId: CUSTOMER,
      email: `${CUSTOMER}@example.com`,
      firstName: 'Two',
      lastName: 'Replicas',
      roleHint: 'customer',
      avatarUrl: null,
    });
    await b.app.inject({ method: 'GET', url: '/v1/users/me', headers: bearer(CUSTOMER) });
    const [row] = await a.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, CUSTOMER));
    customerId = row!.id;
  });

  afterAll(async () => {
    await b?.app.close();
    await a?.close();
  });

  /** A stream held by one instance, reduced to the frames written to it. */
  function tab(harness: TestHarness): { frames: string[]; stop: () => void } {
    const frames: string[] = [];
    const response = {
      write: (frame: string) => frames.push(frame) > 0,
      end: () => undefined,
    } as unknown as ServerResponse;
    const stop = harness.app.events.subscribe(customerId, response);

    return { frames, stop: () => stop?.() };
  }

  function framesOf(event: StreamEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
  }

  it('delivers an event published on one instance to a stream held by the other, once', async () => {
    const onA = tab(a);
    const onB = tab(b);
    const event: StreamEvent = {
      type: 'new_notification',
      notification: { id: 'n-1', title: 'New message' },
    };

    a.app.events.publish(customerId, event);

    await vi.waitFor(() => expect(onB.frames).toEqual([framesOf(event)]));
    // The publisher's own tab has it from the local fan-out, and is not sent its echo.
    expect(onA.frames).toEqual([framesOf(event)]);

    onA.stop();
    onB.stop();
  });

  it('carries an event larger than a NOTIFY payload through the spill table', async () => {
    const onB = tab(b);
    // Three bytes a character: the longest message is well past the limit.
    const content = '€'.repeat(MESSAGE_MAX_LENGTH);
    const event: StreamEvent = {
      type: 'new_message',
      conversationId: 'c-1',
      message: { id: 'm-1', content },
    };
    expect(Buffer.byteLength(JSON.stringify(event))).toBeGreaterThan(NOTIFY_PAYLOAD_LIMIT_BYTES);

    a.app.events.publish(customerId, event);

    await vi.waitFor(() => expect(onB.frames).toEqual([framesOf(event)]));
    const spilled = await a.database.db.select({ id: realtimeEvents.id }).from(realtimeEvents);
    expect(spilled).toHaveLength(1);

    onB.stop();
  });

  it('ends a stream held by the other instance when one closes the account’s streams', async () => {
    const issued = await b.app.inject({
      method: 'POST',
      url: '/v1/events/stream-ticket',
      headers: bearer(CUSTOMER),
    });
    const stream = b.app.inject({
      method: 'GET',
      url: `/v1/events/stream?ticket=${issued.json().ticket}`,
    });
    await vi.waitFor(() => expect(b.app.events.countFor(customerId)).toBe(1));

    a.app.events.closeFor(customerId);

    const response = await stream;
    expect(response.statusCode).toBe(200);
    expect(b.app.events.countFor(customerId)).toBe(0);
  });
});
