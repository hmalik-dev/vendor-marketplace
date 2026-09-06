/**
 * Resend, reduced to the one thing this codebase does with it.
 *
 * The narrow port is what lets the route suites run the real handler, the real
 * service and real SQL while asserting on what *would* have been sent — the
 * same seam the Clerk token verifier, the svix verifier and the Stripe gateway
 * already use. Nothing here knows what an email says; that is
 * `notification-email.ts`'s job.
 *
 * Called with `fetch` rather than through the `resend` SDK. This is one POST,
 * and the SDK would put a dependency in the import graph of every API test for
 * the sake of a URL and a bearer token — the same reasoning
 * `packages/db/src/scripts/seed-e2e.ts` gives for calling Clerk's REST API
 * directly.
 */

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

export interface EmailGateway {
  /**
   * Sends one message.
   *
   * **Throws on failure**, and every caller is expected to catch. The port
   * reports the truth; deciding that a failed email must not fail a booking is
   * a policy the service layer owns, and burying it here would make it
   * unobservable.
   */
  send(message: EmailMessage): Promise<void>;
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
    },
  };
}
