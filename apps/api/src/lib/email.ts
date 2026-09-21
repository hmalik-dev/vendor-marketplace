/**
 * Resend, reduced to the one thing this codebase does with it.
 *
 * The narrow port is what lets the route suites run the real handler, the real
 * service and real SQL while asserting on what *would* have been sent — the
 * same seam the auth token verifier, the Resend webhook verifier and the Stripe gateway
 * already use. Nothing here knows what an email says; that is
 * `notification-email.ts`'s job.
 *
 * Called with `fetch` rather than through the `resend` SDK. This is one POST,
 * and the SDK would put a dependency in the import graph of every API test for
 * the sake of a URL and a bearer token — the same reasoning
 * `packages/db/src/scripts/seed-e2e.ts` gives for calling the auth provider's REST API
 * directly.
 */

import { escapeHtml } from './html-escape.js';

const RESEND_API = 'https://api.resend.com/emails';

/**
 * How long one send may take before it is abandoned.
 *
 * `fetch` carries no deadline of its own, so a stalled Resend left the await
 * sitting on undici's ~300s headers timeout. That mattered because the send used
 * to run on the request path: a browser call has no deadline by design
 * (`api-client.ts`), so the customer's "Sending…" and the vendor's Accept
 * button sat busy for minutes with nothing to show. #408 moved the send off the
 * request path, and this is the other half — an abandoned send must not pin a
 * connection or a background task for five minutes either.
 *
 * Ten seconds is generous for one POST and still an order of magnitude inside
 * the 300s it replaces. A timed-out send throws, which `sendNotificationEmail`
 * already logs and swallows.
 */
export const EMAIL_SEND_TIMEOUT_MS = 10_000;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /**
   * The plain-text alternative, always sent.
   *
   * Not optional: a message with no text part is scored as spam by most
   * filters, and it is the only version a screen reader in a text-mode client
   * ever sees.
   */
  text: string;
  /**
   * Where a human hitting Reply should land, when that is not the `from`
   * address.
   *
   * Only the support form sets it (#421): that message is written *by* a
   * visitor and read by us, which inverts every other send in the product, and
   * without this the reply goes to `EMAIL_FROM` — a `noreply` box — while the
   * screen has just promised the visitor an answer.
   */
  replyTo?: string;
  /**
   * Deduplicates a retried send at Resend, so a replayed operation cannot
   * deliver twice.
   *
   * The notification row's own uuid, which exists exactly once per event — so
   * this needs no column and no table of its own. Same shape as the Stripe
   * idempotency keys at `lib/stripe.ts:370` and `admin.service.ts:268`.
   */
  idempotencyKey: string;
}

/**
 * What the provider said about a message it accepted.
 *
 * Returned rather than discarded since #439: the id is the only key a Resend
 * delivery event carries, so a send that does not hand it back leaves every
 * later `delivered`, `bounced` and `complained` with nothing to match on and
 * the record frozen at "we tried".
 */
export interface EmailSendResult {
  /**
   * Resend's own id for the accepted message.
   *
   * Nullable because acceptance is the contract and the id is not: a 200 whose
   * body is missing, malformed or reshaped by the provider still means the
   * message was taken, and throwing there would turn a delivered email into a
   * recorded failure. The delivery record then stands as `sent` with no id,
   * which is exactly true — it was sent, and no event can be matched to it.
   */
  providerMessageId: string | null;
}

export interface EmailGateway {
  /**
   * Sends one message.
   *
   * **Throws on failure**, and every caller is expected to catch. The port
   * reports the truth; deciding that a failed email must not fail a booking is
   * a policy the service layer owns, and burying it here would make it
   * unobservable.
   */
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export interface ResendOptions {
  apiKey: string;
  /** `EMAIL_FROM`, whose registry default derives from `BRAND_DOMAIN`. */
  from: string;
}

export function createResendGateway({ apiKey, from }: ResendOptions): EmailGateway {
  return {
    async send(message) {
      const response = await fetch(RESEND_API, {
        method: 'POST',
        signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS),
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          /*
           * Resend's own replay protection. The alternative — a `sent_at`
           * column read before every send — is a second source of truth that
           * can disagree with the provider's, and it still races with itself.
           */
          'idempotency-key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          // Omitted rather than sent as `undefined`: Resend rejects a null
          // `reply_to`, and every send but the support form has none.
          ...(message.replyTo === undefined ? {} : { reply_to: message.replyTo }),
        }),
      });

      if (!response.ok) {
        /*
         * The status only. A Resend error body can echo the recipient address
         * back, and this string reaches the log — `log-redaction.ts` cannot
         * redact what it cannot see the shape of.
         */
        throw new Error(`Resend refused the send (${response.status})`);
      }

      return { providerMessageId: await readMessageId(response) };
    },
  };
}

/**
 * Resend's `{ "id": "..." }`, or null when the body is not that.
 *
 * Every failure here is swallowed on purpose. The message has already been
 * accepted by the time this runs — the status said so — so a body that does
 * not parse is a gap in the *record*, not a failed send, and throwing would
 * make `sendNotificationEmail` write `failed` for an email the customer is
 * about to receive. That is worse than the missing id it would be reporting.
 */
async function readMessageId(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();

    if (typeof body === 'object' && body !== null && 'id' in body) {
      const { id } = body as { id: unknown };
      return typeof id === 'string' && id.length > 0 ? id : null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Delivers every message to one fixed address, keeping the intended recipient in
 * the subject and at the top of both bodies.
 *
 * What makes a non-production tier safe to seed with real-looking addresses:
 * the recipient the database holds is *recorded* in what is sent and never
 * *delivered to*. The original is never lost, because a tester still needs to
 * see who a message was for.
 */
export function withEmailSink(gateway: EmailGateway, sinkAddress: string): EmailGateway {
  return {
    send: (message) =>
      gateway.send({
        ...message,
        to: sinkAddress,
        // `replyTo` is kept: it is the support form's visitor, and the sunk copy
        // is only ever replied to by a tester who chose to.
        subject: `[to: ${message.to}] ${message.subject}`,
        html: `<p><strong>Intended recipient: ${escapeHtml(message.to)}</strong></p>${message.html}`,
        text: `Intended recipient: ${message.to}\n\n${message.text}`,
      }),
  };
}

/**
 * Accepts every message and delivers none: a non-production process with no
 * sink address has nowhere safe to send. The recipient stays out of the log for
 * the reason `createResendGateway` keeps it out of its errors.
 */
export function createLogOnlyGateway(log: { info(obj: object, msg: string): void }): EmailGateway {
  return {
    async send(message) {
      log.info(
        { idempotencyKey: message.idempotencyKey },
        'email not delivered outside production',
      );
      return { providerMessageId: null };
    },
  };
}

export interface EmailGatewayOptions extends ResendOptions {
  /** `DEPLOY_ENV`. Anything but `production` never reaches a real recipient. */
  deployEnv: string;
  /** `EMAIL_SINK_ADDRESS`. */
  sinkAddress?: string | undefined;
  log: Parameters<typeof createLogOnlyGateway>[0];
}

/** The gateway for a tier: Resend as-is in production, the sink or nothing elsewhere. */
export function createEmailGateway({
  deployEnv,
  sinkAddress,
  log,
  ...resend
}: EmailGatewayOptions): EmailGateway {
  if (deployEnv === 'production') {
    return createResendGateway(resend);
  }

  return sinkAddress === undefined
    ? createLogOnlyGateway(log)
    : withEmailSink(createResendGateway(resend), sinkAddress);
}
