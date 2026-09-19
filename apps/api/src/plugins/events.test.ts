import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { bearer, createTestHarness } from '../testing/test-server.js';

const SHUTDOWN_DEADLINE_MS = 5_000;
const CUSTOMER = 'user_customer';

describe('shutdown with an open event stream', () => {
  it('ends the stream, drains background work and resolves', async () => {
    const harness = await createTestHarness();
    harness.clerkUsers.set(CUSTOMER, {
      authUserId: CUSTOMER,
      email: 'stream@example.com',
      firstName: 'Stream',
      lastName: 'Reader',
      roleHint: 'customer',
      avatarUrl: null,
    });
    const drain = vi.spyOn(harness.app.background, 'drain');
    const closeAll = vi.spyOn(harness.app.events, 'closeAll');

    const issued = await harness.app.inject({
      method: 'POST',
      url: '/events/stream-ticket',
      headers: bearer(CUSTOMER),
    });
    const ticket = issued.json().ticket;

    await harness.app.listen({ port: 0, host: '127.0.0.1' });
    const address = harness.app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    let onConnected: () => void = () => undefined;
    const connected = new Promise<void>((resolve) => {
      onConnected = resolve;
    });
    const ended = new Promise<void>((resolve, reject) => {
      const request = http.get(
        { host: '127.0.0.1', port, path: `/events/stream?ticket=${ticket}` },
        (response) => {
          expect(response.statusCode).toBe(200);
          response.on('data', onConnected);
          response.on('end', resolve);
        },
      );
      request.on('error', reject);
    });

    await connected;

    const closed = await Promise.race([
      harness.app.close().then(() => 'closed'),
      new Promise<string>((resolve) => setTimeout(() => resolve('hung'), SHUTDOWN_DEADLINE_MS)),
    ]);

    expect(closed).toBe('closed');
    await ended;
    expect(closeAll).toHaveBeenCalled();
    expect(drain).toHaveBeenCalled();
    await harness.database.close();
  });
});
