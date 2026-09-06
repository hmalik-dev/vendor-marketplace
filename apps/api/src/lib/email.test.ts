import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResendGateway, EMAIL_SEND_TIMEOUT_MS } from './email.js';

/**
 * The gateway had no test at all, which is how it carried no deadline for as
 * long as it existed. `fetch` has none of its own, so a stalled Resend left the
 * await sitting on undici's ~300s headers timeout — and until #408 that await
 * was on the request path, so the customer's "Sending…" and the vendor's Accept
 * button sat busy for minutes with nothing to show.
 */
describe('createResendGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response = new Response(null, { status: 200 })): {
    calls: { url: unknown; init: RequestInit | undefined }[];
  } {
    const calls: { url: unknown; init: RequestInit | undefined }[] = [];

    vi.stubGlobal('fetch', async (url: unknown, init?: RequestInit) => {
      calls.push({ url, init });
      return response;
    });

    return { calls };
  }

  const message = {
    to: 'reader@example.test',
    subject: 'A booking is confirmed',
    html: '<p>hi</p>',
    text: 'hi',
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
  };

  const gateway = (): ReturnType<typeof createResendGateway> =>
    createResendGateway({ apiKey: 'key', from: 'Orla <hi@example.test>' });

  it('carries a deadline, so an abandoned send cannot hold a task for minutes', async () => {
    const { calls } = stubFetch();

    await gateway().send(message);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    // Stated rather than merely present: 300s and 10s are both "a signal".
    expect(EMAIL_SEND_TIMEOUT_MS).toBe(10_000);
  });

  it('sends the idempotency key Resend deduplicates on', async () => {
    const { calls } = stubFetch();

    await gateway().send(message);

    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBe(message.idempotencyKey);
    expect(headers.authorization).toBe('Bearer key');
  });

  /*
   * The status and nothing else. A Resend error body can echo the recipient
   * address back, and this string reaches the log.
   */
  it('reports a refusal by status alone', async () => {
    stubFetch(new Response('{"message":"reader@example.test is not allowed"}', { status: 422 }));

    await expect(gateway().send(message)).rejects.toThrow('Resend refused the send (422)');
  });
});
