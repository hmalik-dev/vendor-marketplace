import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as UsersDao from '../users/users.dao.js';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null, entered: false }));

vi.mock('../users/users.dao.js', async (importOriginal) => {
  const original = await importOriginal<typeof UsersDao>();

  return {
    ...original,
    findUserById: async (...args: Parameters<typeof original.findUserById>) => {
      if (gate.hold) {
        gate.entered = true;
        await gate.hold;
      }

      return original.findUserById(...args);
    },
  };
});

const CUSTOMER = 'user_customer_abort';

describe('a stream client that leaves while its account is being checked', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
    harness.authUsers.set(CUSTOMER, {
      authUserId: CUSTOMER,
      email: 'abort@example.com',
      firstName: 'Abort',
      lastName: 'Reader',
      roleHint: 'customer',
      avatarUrl: null,
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('leaves no subscription and starts no heartbeat', async () => {
    const issued = await harness.app.inject({
      method: 'POST',
      url: '/v1/events/stream-ticket',
      headers: bearer(CUSTOMER),
    });
    const ticket: string = issued.json().ticket;

    await harness.app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = harness.app.server.address() as AddressInfo;

    let release!: () => void;
    gate.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    gate.entered = false;

    const subscribe = vi.spyOn(harness.app.events, 'subscribe');
    const timers = vi.spyOn(globalThis, 'setInterval');

    const client = httpRequest({
      host: '127.0.0.1',
      port,
      path: `/v1/events/stream?ticket=${ticket}`,
    });
    client.on('error', () => {});
    client.end();

    await vi.waitFor(() => expect(gate.entered).toBe(true));

    // The abort, while the handler is parked on the account lookup.
    client.destroy();
    await new Promise((resolve) => setTimeout(resolve, 50));

    gate.hold = null;
    release();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(subscribe).not.toHaveBeenCalled();
    expect(timers.mock.calls.filter(([, delay]) => delay === 30_000)).toEqual([]);

    subscribe.mockRestore();
    timers.mockRestore();
  });
});
