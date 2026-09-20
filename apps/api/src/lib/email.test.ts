import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmailGateway, createResendGateway, EMAIL_SEND_TIMEOUT_MS } from './email.js';

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
   * The id every delivery event is keyed on, and the only place production
   * obtains it — every other suite runs the recording fake, which mints its own.
   * With this unasserted, a `readMessageId` that always returned `null` left the
   * whole gate green while every Resend webhook in production found no record.
   */
  it('returns the provider message id Resend answers with', async () => {
    stubFetch(new Response('{"id":"56761188-7520-42d8-8898-ff6fc54ce618"}', { status: 200 }));

    await expect(gateway().send(message)).resolves.toEqual({
      providerMessageId: '56761188-7520-42d8-8898-ff6fc54ce618',
    });
  });

  /*
   * Acceptance is the contract; the id is not. A 200 whose body is missing,
   * malformed or reshaped still means the message was taken, so this resolves
   * with no id rather than throwing — throwing would record `failed` for an
   * email the customer is about to receive.
   */
  it.each([
    ['no body at all', new Response(null, { status: 200 })],
    ['a body that is not JSON', new Response('accepted', { status: 200 })],
    ['a body carrying no id', new Response('{"ok":true}', { status: 200 })],
    ['an id that is not a string', new Response('{"id":42}', { status: 200 })],
    ['an empty id', new Response('{"id":""}', { status: 200 })],
  ])('accepts the send with no id when Resend answers %s', async (_case, response) => {
    stubFetch(response);

    await expect(gateway().send(message)).resolves.toEqual({ providerMessageId: null });
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

describe('createEmailGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const SINK = 'sink@orla.example.test';
  const message = {
    to: 'real@example.com',
    subject: 'A booking is confirmed',
    html: '<p>hi</p>',
    text: 'hi',
    replyTo: 'visitor@example.test',
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
  };

  function sentBodies(): Record<string, unknown>[] {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (_url: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(init?.body as string) as Record<string, unknown>);
      return new Response('{"id":"abc"}', { status: 200 });
    });
    return bodies;
  }

  const log = { info: vi.fn() };
  const gateway = (
    deployEnv: string,
    sinkAddress?: string,
  ): ReturnType<typeof createEmailGateway> =>
    createEmailGateway({
      apiKey: 'key',
      from: 'Orla <hi@example.test>',
      deployEnv,
      sinkAddress,
      log,
    });

  it('staging delivers to the sink only, with the intended recipient in the subject and both bodies', async () => {
    const bodies = sentBodies();

    await gateway('staging', SINK).send(message);

    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.to).toBe(SINK);
    expect(bodies[0]?.subject).toBe('[to: real@example.com] A booking is confirmed');
    expect(bodies[0]?.html).toBe(
      '<p><strong>Intended recipient: real@example.com</strong></p><p>hi</p>',
    );
    expect(bodies[0]?.text).toBe('Intended recipient: real@example.com\n\nhi');
    expect(bodies[0]?.reply_to).toBe('visitor@example.test');
  });

  it('a local process with a real key and a sink is sunk too, never sent to the seeded address', async () => {
    const bodies = sentBodies();

    await gateway('local', SINK).send(message);

    expect(bodies.map((body) => body.to)).toEqual([SINK]);
  });

  it('production passes the message through unchanged', async () => {
    const bodies = sentBodies();

    await gateway('production', SINK).send(message);

    expect(bodies[0]?.to).toBe('real@example.com');
    expect(bodies[0]?.subject).toBe('A booking is confirmed');
    expect(bodies[0]?.html).toBe('<p>hi</p>');
  });

  it('a non-production process with no sink delivers nothing and logs without the recipient', async () => {
    const bodies = sentBodies();

    await expect(gateway('local').send(message)).resolves.toEqual({ providerMessageId: null });

    expect(bodies).toHaveLength(0);
    expect(log.info).toHaveBeenCalledWith(
      { idempotencyKey: message.idempotencyKey },
      'email not delivered outside production',
    );
  });
});
