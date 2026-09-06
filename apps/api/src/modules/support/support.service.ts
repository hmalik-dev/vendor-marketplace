import { randomInt, randomUUID } from 'node:crypto';
import {
  ERROR_CODES,
  SUPPORT_REFERENCE_ALPHABET,
  SUPPORT_REFERENCE_PREFIX,
  type SupportMessageInput,
  type SupportMessageReceipt,
} from '@vendor-marketplace/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import type { EmailGateway } from '../../lib/email.js';
import { AppError, unauthorized, validationFailed } from '../../lib/errors.js';
import { findUserEmail } from '../notifications/notification-email.dao.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import { renderSupportConfirmation, renderSupportReport } from './support-email.js';

/**
 * One support message, sent as one email, with nothing stored.
 *
 * There is deliberately no table here. A row would be a ticket, a ticket needs
 * a status, and a status needs somewhere to read it — which is the helpdesk
 * this feature is scoped explicitly not to be. The reference below is the
 * message's handle, and the only durable copies of a message are the two
 * inboxes it lands in.
 */

export interface SupportDeps {
  db: AppDatabase;
  email: EmailGateway;
  log: FastifyBaseLogger;
  /** `SUPPORT_EMAIL_TO`. Never a literal — see the registry row (#374). */
  to: string;
}

/**
 * `ORL-4K7Q-P2`.
 *
 * `randomInt` rather than `Math.random`: this is the only handle a visitor has
 * on a message, and two people submitting in the same millisecond must not be
 * handed the same one. Six characters from a 30-character alphabet is ~729
 * million values, which is far more collision headroom than a form that sends
 * an email to a human inbox will ever need.
 */
export function generateSupportReference(): string {
  const pick = (count: number): string =>
    Array.from(
      { length: count },
      () => SUPPORT_REFERENCE_ALPHABET[randomInt(SUPPORT_REFERENCE_ALPHABET.length)] as string,
    ).join('');

  return `${SUPPORT_REFERENCE_PREFIX}-${pick(4)}-${pick(2)}`;
}

/**
 * Where the answer goes.
 *
 * A signed-in visitor's address is read off their account row and a supplied
 * one is ignored — the design states that as "changing where replies go means
 * changing the account", and it is also what stops the form being a way to
 * put an arbitrary reply-to on a message that looks like it came from a real
 * account.
 */
async function resolveReplyTo(
  deps: SupportDeps,
  input: SupportMessageInput,
  auth: AuthenticatedUser | null,
): Promise<{ replyTo: string; signedIn: boolean }> {
  if (!auth) {
    if (input.email === undefined) {
      throw validationFailed('Enter the email address we should reply to', { field: 'email' });
    }

    return { replyTo: input.email, signedIn: false };
  }

  const account = await findUserEmail(deps.db, auth.id);

  if (!account) {
    /*
     * The session resolved to a user row that has since been soft-deleted.
     * There is no address to answer, and falling back to a typed one would
     * silently turn a signed-in send into an unverified one.
     */
    throw unauthorized();
  }

  return { replyTo: account.email, signedIn: true };
}

/**
 * Sends the message and hands back its reference.
 *
 * **The reference is issued before the send is attempted**, and the failure
 * path carries it back in `details`. That ordering is the whole reason state 6
 * of frame `29` can offer the visitor something to quote: a message the mail
 * service rejected is still a message we logged, and telling them "it failed,
 * and here is nothing" is the dead end the design exists to close.
 */
export async function sendSupportMessage(
  deps: SupportDeps,
  input: SupportMessageInput,
  auth: AuthenticatedUser | null,
): Promise<SupportMessageReceipt> {
  const reference = generateSupportReference();
  const { replyTo, signedIn } = await resolveReplyTo(deps, input, auth);

  const fields = {
    reference,
    topic: input.topic,
    message: input.message,
    replyTo,
    signedIn,
    ...(input.errorContext === undefined ? {} : { errorContext: input.errorContext }),
  };

  const report = renderSupportReport(fields);

  try {
    await deps.email.send({
      to: deps.to,
      subject: report.subject,
      html: report.html,
      text: report.text,
      replyTo,
      idempotencyKey: randomUUID(),
    });
  } catch (error) {
    /*
     * The reference and the failure, never the address: `log-redaction.ts`
     * has no shape to strip an email out of a free-form message, and the
     * transport's own error can echo the recipient back.
     */
    deps.log.error({ reference, topic: input.topic, err: error }, 'Support message failed to send');

    throw new AppError(
      502,
      ERROR_CODES.INTERNAL_ERROR,
      'The mail service rejected the message',
      /*
       * `details`, so the screen can show the reference it promised. The
       * *message* above never reaches a reader — a 5xx body is written about
       * the server, and `userFacingError` drops it for exactly that reason —
       * so the copy for this state lives on the screen, where the design put
       * it.
       */
      { reference } satisfies SupportMessageReceipt,
    );
  }

  /*
   * The receipt, and its failure is not the visitor's problem: they already
   * have the reference on screen, the report is already delivered, and telling
   * them the send failed at this point would be false.
   */
  const confirmation = renderSupportConfirmation(fields);

  try {
    await deps.email.send({
      to: replyTo,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
      idempotencyKey: randomUUID(),
    });
  } catch (error) {
    deps.log.error({ reference, err: error }, 'Support confirmation failed to send');
  }

  return { reference };
}
