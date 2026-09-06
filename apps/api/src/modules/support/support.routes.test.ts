import {
  MAX_SUPPORT_MESSAGE_LENGTH,
  SUPPORT_REFERENCE_PATTERN,
  SUPPORT_TOPICS,
  SUPPORT_TOPIC_LABELS,
  supportMessageReceiptSchema,
  supportSendFailureDetailsSchema,
} from '@vendor-marketplace/shared';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createResendGateway } from '../../lib/email.js';
import {
  bearer,
  createTestHarness,
  TEST_ENV,
  type TestHarness,
} from '../../testing/test-server.js';

const CUSTOMER = 'user_customer';
const CUSTOMER_EMAIL = 'alan@example.com';

const MESSAGE = 'I got an error page trying to pay the deposit. It happened twice.';

const ERROR_CONTEXT = {
  digest: 'err_9f4c2a71b3',
  route: '/bookings/abc/checkout',
  occurredAt: '2026-06-12T14:41:00.000Z',
} as const;

/**
 * A fresh caller per request.
 *
 * The route is limited to six sends an hour, keyed by account where there is
 * one and by IP where there is not — so a suite that fired every case from
 * `inject`'s default address would exhaust the allowance mid-file and start
 * asserting 429s. Each case gets its own address, which also means the
 * limiter's key really is the caller rather than the route.
 */
let callers = 0;
function fromANewVisitor(): { remoteAddress: string } {
  callers += 1;
  return { remoteAddress: `10.0.${Math.floor(callers / 250)}.${callers % 250}` };
}

describe('POST /support/messages', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
    harness.clerkUsers.set(CUSTOMER, {
      clerkUserId: CUSTOMER,
      email: CUSTOMER_EMAIL,
      firstName: 'Alan',
      lastName: 'Turing',
      roleHint: 'customer',
      avatarUrl: null,
    });
  });

  afterEach(() => {
    harness.email.sent.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('takes a signed-out message with an email address and hands back a reference', async () => {
    const result = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      payload: { topic: 'something-else', email: 'visitor@example.com', message: MESSAGE },
    });

    expect(result.statusCode).toBe(200);

    const body = supportMessageReceiptSchema.parse(result.json());
    expect(body.reference).toMatch(SUPPORT_REFERENCE_PATTERN);

    // The report to us, then the receipt to them. Two sends, one submission.
    expect(harness.email.sent).toHaveLength(2);
    const [report, confirmation] = harness.email.sent;

    expect(report?.to).toBe(TEST_ENV.SUPPORT_EMAIL_TO);
    expect(report?.subject).toBe(`${SUPPORT_TOPIC_LABELS['something-else']} · ${body.reference}`);
    expect(report?.text).toContain(MESSAGE);
    // A human hitting Reply lands on the visitor, not on the `noreply` box.
    expect(report?.replyTo).toBe('visitor@example.com');
    // Not verified, and the inbox is told so rather than left to guess.
    expect(report?.text).toContain('signed out, address not verified');

    expect(confirmation?.to).toBe('visitor@example.com');
    // Acceptance 5: the same reference is in the confirmation email.
    expect(confirmation?.text).toContain(body.reference);

    /*
     * And **only** the reference. The recipient here is an address the caller
     * chose and nobody verified, so echoing their own text back to it would
     * make this route a way to send branded, DKIM-signed mail carrying copy of
     * the sender's choosing to a stranger who never used the product. The rate
     * limit bounds how much of that is possible, not whether it is.
     */
    expect(confirmation?.text).not.toContain(MESSAGE);
    expect(confirmation?.html).not.toContain(MESSAGE);
    expect(confirmation?.text).not.toContain('Here is what you sent');
  });

  it('refuses a signed-out message with no email address, naming the field', async () => {
    const result = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      payload: { topic: 'something-else', message: MESSAGE },
    });

    expect(result.statusCode).toBe(400);
    expect(result.json()).toMatchObject({
      error: 'VALIDATION_ERROR',
      message: 'Enter the email address we should reply to',
      details: { field: 'email' },
    });
    expect(harness.email.sent).toHaveLength(0);
  });

  it('answers a signed-in sender at their account address, ignoring any they supply', async () => {
    const result = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      headers: bearer(CUSTOMER),
      payload: {
        topic: 'booking-or-payment',
        // The design makes this unreachable in the UI; the API refuses to
        // honour it anyway, so no reply can be redirected by whoever holds
        // the form.
        email: 'attacker@example.com',
        message: MESSAGE,
      },
    });

    expect(result.statusCode).toBe(200);

    const [report, confirmation] = harness.email.sent;
    expect(report?.replyTo).toBe(CUSTOMER_EMAIL);
    expect(report?.text).toContain(`${CUSTOMER_EMAIL} — signed in`);
    expect(report?.text).not.toContain('attacker@example.com');
    expect(confirmation?.to).toBe(CUSTOMER_EMAIL);

    // The echo is kept for an address the account proved, which is the only
    // case where the recipient is not the sender's to choose.
    expect(confirmation?.text).toContain(MESSAGE);
    expect(confirmation?.text).toContain('Here is what you sent');
  });

  it('carries the error digest, route and timestamp into the report', async () => {
    const result = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      payload: {
        topic: 'something-broke',
        email: 'visitor@example.com',
        message: MESSAGE,
        errorContext: ERROR_CONTEXT,
      },
    });

    expect(result.statusCode).toBe(200);

    const [report] = harness.email.sent;
    expect(report?.text).toContain(ERROR_CONTEXT.digest);
    expect(report?.text).toContain(ERROR_CONTEXT.route);
    expect(report?.text).toContain(ERROR_CONTEXT.occurredAt);
  });

  it('accepts every topic and puts its label in the subject', async () => {
    for (const topic of SUPPORT_TOPICS) {
      const result = await harness.app.inject({
        method: 'POST',
        url: '/support/messages',
        ...fromANewVisitor(),
        payload: { topic, email: 'visitor@example.com', message: MESSAGE },
      });

      expect(result.statusCode, topic).toBe(200);
      expect(harness.email.sent.at(-2)?.subject, topic).toContain(SUPPORT_TOPIC_LABELS[topic]);
    }
  });

  it('refuses a topic outside the five', async () => {
    const result = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      payload: { topic: 'refund-me-now', email: 'visitor@example.com', message: MESSAGE },
    });

    expect(result.statusCode).toBe(400);
    expect(harness.email.sent).toHaveLength(0);
  });

  it('sends the longest legal message and refuses one character more', async () => {
    // #408: the value the schema accepts has to fit what receives it, so the
    // ceiling is driven rather than asserted against a constant.
    const longest = 'a'.repeat(MAX_SUPPORT_MESSAGE_LENGTH);

    const accepted = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      payload: { topic: 'something-else', email: 'visitor@example.com', message: longest },
    });
    expect(accepted.statusCode).toBe(200);
    expect(harness.email.sent[0]?.text).toContain(longest);

    const refused = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      payload: { topic: 'something-else', email: 'visitor@example.com', message: `${longest}a` },
    });
    expect(refused.statusCode).toBe(400);
  });

  it('refuses an empty message', async () => {
    const result = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      payload: { topic: 'something-else', email: 'visitor@example.com', message: '   ' },
    });

    expect(result.statusCode).toBe(400);
    expect(harness.email.sent).toHaveLength(0);
  });

  it('stops one caller after six sends in an hour', async () => {
    /*
     * The route is public and it makes this process send mail, which is the
     * pair that makes an open relay. The global limiter is sized for reads and
     * would let one address emit thousands a day, so this route carries its
     * own — and a limit nothing drives is a limit nobody notices removing.
     */
    const caller = fromANewVisitor();
    const send = async (): Promise<LightMyRequestResponse> =>
      harness.app.inject({
        method: 'POST',
        url: '/support/messages',
        ...caller,
        payload: { topic: 'something-else', email: 'visitor@example.com', message: MESSAGE },
      });

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      expect((await send()).statusCode, `attempt ${attempt}`).toBe(200);
    }

    const seventh = await send();
    expect(seventh.statusCode).toBe(429);
    expect(seventh.json()).toMatchObject({ error: 'RATE_LIMITED' });
  });

  it('refuses an error route that is not a same-origin path', async () => {
    const result = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      payload: {
        topic: 'something-broke',
        email: 'visitor@example.com',
        message: MESSAGE,
        errorContext: { ...ERROR_CONTEXT, route: 'https://evil.example.com/pay' },
      },
    });

    expect(result.statusCode).toBe(400);
    expect(harness.email.sent).toHaveLength(0);
  });

  /*
   * A protocol-relative URL clears a naive `^/`, and a backslash is normalised
   * to a slash by every browser. Neither is followed by anything here — the
   * route is quoted as text — but an address of someone else's choosing inside
   * our own support mail is a link to every client that autolinks.
   */
  it.each(['//evil.example.com', String.raw`/\evil.example.com`])(
    'refuses %s as an error route',
    async (route) => {
      const result = await harness.app.inject({
        method: 'POST',
        url: '/support/messages',
        ...fromANewVisitor(),
        payload: {
          topic: 'something-broke',
          email: 'visitor@example.com',
          message: MESSAGE,
          errorContext: { ...ERROR_CONTEXT, route },
        },
      });

      expect(result.statusCode).toBe(400);
      expect(harness.email.sent).toHaveLength(0);
    },
  );
});

/**
 * The failure state, against a transport that actually refuses.
 *
 * The recording fake's `failNext` throws a string this module wrote, which
 * proves only that the catch catches what the test threw. #416 shipped a
 * refund that had never once worked for exactly that reason. So this suite
 * injects the **real** `createResendGateway` over a stubbed `fetch` and has it
 * answer what Resend answers — a 422 on a recipient the account may not send
 * to — so the branch under test is the production status check and the
 * production error.
 */
describe('POST /support/messages, against a transport that refuses', () => {
  let harness: TestHarness;
  const attempts: RequestInit[] = [];

  beforeAll(async () => {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      attempts.push(init);
      return new Response(
        JSON.stringify({
          statusCode: 422,
          name: 'validation_error',
          message: 'The visitor@example.com address is not verified for this account.',
        }),
        { status: 422, headers: { 'content-type': 'application/json' } },
      );
    });

    harness = await createTestHarness({
      emailGateway: createResendGateway({
        apiKey: TEST_ENV.RESEND_API_KEY,
        from: TEST_ENV.EMAIL_FROM,
      }),
    });
  });

  afterAll(async () => {
    await harness.close();
    vi.unstubAllGlobals();
  });

  it('still issues a reference, and names transport rather than the input', async () => {
    const result = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      ...fromANewVisitor(),
      payload: { topic: 'something-broke', email: 'visitor@example.com', message: MESSAGE },
    });

    // 502, not 400: nothing the visitor typed is wrong, so the screen must not
    // ask them to reword a message that was fine.
    expect(result.statusCode).toBe(502);

    const body = result.json();
    expect(body.error).toBe('INTERNAL_ERROR');

    // Acceptance 6: the reference is issued before the send resolves, so a
    // failed message is still something the visitor can quote at us.
    const details = supportSendFailureDetailsSchema.parse(body.details);
    expect(details.reference).toMatch(SUPPORT_REFERENCE_PATTERN);

    // The transport was really reached, with the real headers.
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.headers).toMatchObject({ 'idempotency-key': expect.any(String) });

    // Resend's own body can echo the recipient back; it must not reach the
    // client, and neither must the address the visitor typed.
    expect(JSON.stringify(body)).not.toContain('visitor@example.com');
    expect(JSON.stringify(body)).not.toContain('not verified');
  });
});
