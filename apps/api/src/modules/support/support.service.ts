import { randomInt, randomUUID } from 'node:crypto';
import {
  ERROR_CODES,
  SUPPORT_REFERENCE_ALPHABET,
  SUPPORT_REFERENCE_PREFIX,
  type SupportMessageInput,
  type SupportMessageReceipt,
} from '@vendor-marketplace/shared';
import type { BookingRow } from '@vendor-marketplace/db/schema';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import type { EmailGateway } from '../../lib/email.js';
import { AppError, termsRequiredError, unauthorized, validationFailed } from '../../lib/errors.js';
import {
  heldByChargeback,
  openSupportCase,
  recordCaseSendFailure,
} from '../cases/cases.service.js';
import { findUserEmail } from '../notifications/notification-email.dao.js';
import {
  AlreadyHeldError,
  announceDisputeHold,
  disputeHoldAudience,
  liftDisputeHold,
  placeDisputeHold,
  type BookingContext,
  type DisputeHoldAudience,
} from '../payments/payments.service.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import {
  renderSupportConfirmation,
  renderSupportReport,
  type SupportBookingFields,
} from './support-email.js';

/**
 * One support message, sent as one email, **and recorded beside it** (#431).
 *
 * This file used to say there was deliberately no table: a row would be a
 * ticket, a ticket needs a status, and a status needs somewhere to read it. That
 * reasoning was right about the shape and wrong about the destination. A report
 * carrying a `bookingId` freezes a vendor's payout, and the complaint that
 * justifies the freeze lived only in an inbox while the hold lived in a column
 * no admin surface exposed — so an operator could see that money was frozen and
 * not why. The somewhere-to-read-it is `/admin/cases`, and the status is two
 * members rather than a helpdesk's workflow.
 *
 * **The email is still the delivery and the row is still not it.** The send is
 * what a human triages; the row is what the console lists. A failure to write
 * the row therefore never costs the send, and never strands the hold — see
 * `openSupportCase`, and the ordering `sendSupportMessage` states below.
 */

export interface SupportDeps {
  db: AppDatabase;
  email: EmailGateway;
  log: FastifyBaseLogger;
  /** `SUPPORT_EMAIL_TO`. Never a literal — see the registry row (#374). */
  to: string;
  /**
   * What a **booking report** needs to place #423's payout hold (#425).
   *
   * Carried on the same deps rather than threaded separately, for the reason
   * the file's own header gives about the two emails: the hold *is* part of
   * this send. A report that reached the inbox without freezing the money would
   * be the failure the whole chain exists to prevent, and a second entry point
   * for the hold is how the two would come to disagree about when it happens.
   */
  bookings: BookingContext;
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

/** The booking as the report email quotes it — the row's columns, not the sender's. */
function bookingFields(held: BookingRow, audience: DisputeHoldAudience): SupportBookingFields {
  return {
    id: held.id,
    eventDate: held.eventDate,
    totalAmountCents: held.totalAmountCents,
    vendorBusinessName: audience.vendorBusinessName,
  };
}

/**
 * Freezes the payout on the booking this report is about, or answers `null`
 * when the report is not about one.
 *
 * **Authorisation is not decided here.** `placeDisputeHold` answers 404 for a
 * booking that is not this caller's, 403 for the vendor on it, and 409 for one
 * outside the window a hold can still change anything in — the same refusals
 * the dispute route gets, because it is the same function. What this adds is
 * the one refusal that route cannot need: a booking report from a caller with
 * no session at all. `/support/messages` is deliberately public, so that case
 * is reachable here and nowhere else.
 *
 * The quoted fields are read from the row the hold returned, never from the
 * request. The vendor's name is looked up separately and is allowed to be
 * missing: a profile deleted between the booking and the report costs the email
 * a name, not the hold.
 */
async function placeReportHold(
  deps: SupportDeps,
  input: SupportMessageInput,
  auth: AuthenticatedUser | null,
  gated: boolean,
  now: Date,
): Promise<BookingRow | null> {
  if (input.bookingId === undefined) {
    return null;
  }

  if (!auth) {
    /*
     * `auth` is null for two reasons since #429, and telling somebody who is
     * demonstrably signed in to sign in is the wrong one. `/support` is
     * deliberately reachable from behind the acceptance gate — the person most
     * likely to need it is the one who cannot get through — so this is the one
     * surface where a gated caller meets a refusal and has to be told which
     * refusal it is.
     */
    throw gated ? termsRequiredError() : unauthorized('Sign in to report a problem with a booking');
  }

  try {
    return await placeDisputeHold(
      deps.bookings,
      auth,
      input.bookingId,
      input.message,
      now,
      'customer',
    );
  } catch (error) {
    /*
     * **The booking is already held — and only one kind of hold lets this send
     * through.**
     *
     * #425 refuses a second report on purpose: a duplicate complaint about a
     * dispute already open is a second email a human triages for nothing, and
     * `payouts.routes.test.ts` pins both halves of that ("refuses a second
     * report while one is open, and sends no second message"). That rule was
     * written when the customer's own report was the only thing that could set
     * `disputed`, and it stays exactly as it was for that case.
     *
     * #431 broke its premise rather than its reasoning: a chargeback sets
     * `disputed` too. Then the refusal tells somebody who filed nothing *"you
     * have already reported a problem with this booking"* and — because this
     * runs before the send — delivers their message nowhere, locking them out of
     * support for the one booking they most need to discuss. So the pass-through
     * is exactly as wide as the case this ticket broke, and no wider.
     *
     * `null` is the same answer a report with no `bookingId` gives, and means
     * the same downstream: no hold was placed here, so there is none to unwind
     * if the send fails. The case still records the booking.
     */
    if (error instanceof AlreadyHeldError && (await heldByChargeback(deps, input.bookingId))) {
      return null;
    }

    throw error;
  }
}

/**
 * The vendor behind a held booking — and the hold taken back if that read
 * cannot be made.
 *
 * **Every step between the hold and the send has to be inside an unwind.** This
 * one is a round trip on a request that has just written to the same database,
 * and a failure here used to propagate with the hold committed and no report
 * anywhere: a payout frozen by a complaint nobody received, which the
 * customer's own retry then answers *"you have already reported a problem with
 * this booking"*.
 */
async function readAudience(
  deps: SupportDeps,
  held: BookingRow | null,
  reference: string,
): Promise<DisputeHoldAudience | null> {
  if (held === null) {
    return null;
  }

  try {
    return await disputeHoldAudience(deps.bookings, held);
  } catch (error) {
    await unwindReportHold(deps, held, reference);

    throw error;
  }
}

/**
 * Puts the booking back, because the report it was placed for never went.
 *
 * Failing to unwind is logged rather than thrown: the caller is already about
 * to raise the send failure, which is the cause, and replacing it with this one
 * would tell the customer their message was fine and something else broke. What
 * the log records is the pair — the booking still on hold, and the reference of
 * the report that did not reach us — because that is a hold with no complaint
 * behind it and an operator has to be able to find it.
 */
async function unwindReportHold(
  deps: SupportDeps,
  held: BookingRow,
  reference: string,
): Promise<void> {
  /*
   * `held.updatedAt` is the row this request wrote, and the lift is conditional
   * on it still being that row. Without it the compensation matches on
   * `status = 'disputed'` alone, and an operator resolving this complaint while
   * a second one was filed behind it would leave this unwind releasing *that*
   * hold — a delivered report in the inbox and the payout it was meant to
   * freeze back in the sweep.
   */
  const failure = await liftDisputeHold(deps.bookings, held, held.updatedAt).then(
    (lifted) =>
      lifted === null ? new Error('The booking moved while the hold was withdrawn') : null,
    (error: unknown) => error,
  );

  if (failure) {
    deps.log.error(
      { reference, bookingId: held.id, err: failure },
      'A support report failed to send and its payout hold could not be withdrawn',
    );
  }
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
  /** True when the caller is signed in but held at the acceptance gate (#429). */
  gated: boolean,
  now: Date,
): Promise<SupportMessageReceipt> {
  const reference = generateSupportReference();
  const { replyTo, signedIn } = await resolveReplyTo(deps, input, auth);

  /*
   * **The hold is placed before the report is sent, and undone if the send
   * fails.** That ordering is the whole of acceptance 4, and it is the only one
   * of the two that is safe in both directions (#425).
   *
   * Sending first and holding second would put a report in the inbox saying the
   * money is frozen while a refused transition left it running — the failure
   * #423 exists to prevent, arriving with a support email asserting the
   * opposite. Holding first means a refusal throws before anything is sent, and
   * anything that fails after it is unwound by `unwindReportHold` below, so
   * neither half can stand alone. #405's two-writes-with-no-rollback shape, on money.
   */
  const held = await placeReportHold(deps, input, auth, gated, now);

  const audience = await readAudience(deps, held, reference);

  /*
   * **The row goes in here**, after every refusal that can still turn this send
   * away and before the send itself.
   *
   * Earlier would file cases for reports that were never sent — a caller with no
   * session reporting a booking, a hold the booking's own state refuses — and
   * the queue would fill with rows describing nothing. Later, after the send,
   * would leave the failure path with nothing to record the failure *on*, which
   * is the one state an operator has to chase rather than work.
   *
   * `openSupportCase` swallows its own failure by design. That is the ticket's
   * rule in one line: a row that could not be written must not lose the email or
   * strand the hold.
   */
  const supportCase = await openSupportCase(deps, {
    reference,
    topic: input.topic,
    message: input.message,
    senderUserId: auth?.id ?? null,
    senderEmail: replyTo,
    bookingId: input.bookingId ?? null,
  });

  const fields = {
    reference,
    topic: input.topic,
    message: input.message,
    replyTo,
    signedIn,
    ...(input.errorContext === undefined ? {} : { errorContext: input.errorContext }),
    ...(held === null || audience === null ? {} : { booking: bookingFields(held, audience) }),
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

    if (held) {
      await unwindReportHold(deps, held, reference);
    }

    /*
     * After the unwind, not before: the hold coming back off is what the
     * customer's next attempt depends on, and the case row is a note for an
     * operator. Both are best-effort and neither may displace the 502 below,
     * which is the failure the sender is actually owed.
     */
    if (supportCase) {
      await recordCaseSendFailure(deps, supportCase, now);
    }

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

  const confirmation = renderSupportConfirmation(fields);

  /*
   * Two independent best-effort follow-ups, run together.
   *
   * The vendor's notice comes **only now and never before the send**: one told
   * their payout is frozen by a report that was never filed has been alarmed
   * about nothing, and the hold behind that notice has already been withdrawn
   * above. The receipt's own failure is not the visitor's problem either —
   * they have the reference on screen and the report is already delivered, so
   * telling them the send failed at this point would be false. Neither depends
   * on the other, and sequencing them only lengthened the request.
   */
  await Promise.all([
    audience === null ? Promise.resolve() : announceDisputeHold(deps.bookings, audience),
    deps.email
      .send({
        to: replyTo,
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
        idempotencyKey: randomUUID(),
      })
      .catch((error: unknown) => {
        deps.log.error({ reference, err: error }, 'Support confirmation failed to send');
      }),
  ]);

  return { reference };
}
