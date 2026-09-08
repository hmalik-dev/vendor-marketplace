import { isLegacyDestinationPayout, toDateString } from '@vendor-marketplace/shared';
import { queueNotificationEmail } from '../notifications/notification-email.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import { cancelBookingAndFreeDate } from '../payments/payments.dao.js';
import type { BookingContext } from '../payments/payments.service.js';
import { declineOpenRequests, findConfirmedBookingsToUnwind } from './admin.dao.js';

/**
 * Everything an admin operation needs — which is exactly a `BookingContext`.
 *
 * An alias rather than a second declaration of the same five fields. The two
 * were already interchangeable in fact: `admin.routes.ts` passes this straight
 * into `resolveDispute(context: BookingContext, ...)`, which only typechecks
 * because they are structurally identical. Two identical declarations only
 * agree until one of them grows a field.
 *
 * The name is kept because it is what the admin plugin's own routes read as,
 * and `bookingContextFor` is already the one place either is assembled.
 */
export type AdminContext = BookingContext;

/**
 * Runs a notification, and never lets it undo the work it announces.
 *
 * Every notification write behind this follows work that has already
 * committed — the unwind below has issued refunds through Stripe and cancelled
 * the bookings, `approveSuggestion`'s tag transaction has closed and the
 * suggestion is no longer `pending`. A throw at that point answered 500 on an
 * operation the operator cannot repeat: the retry re-enters a partly applied
 * ban, or finds a suggestion it can no longer resolve. Same rule as
 * `bestEffortAnnouncement` in the booking-request service and `bestEffortNotice`
 * in payments; #408 added it there and left these two, which is exactly how a
 * rule becomes a special case.
 *
 * The message became a parameter with #434, which gave this a second kind of
 * caller: the audit write follows the identical rule for a sharper reason, and
 * a second copy of this body — which is what it started as — would have been
 * the same drift again, one ticket later. It is the **last** parameter so the
 * two notification callers keep the shape they already had.
 *
 * #451 gave it a third kind: an outbound call to Clerk, after the retirement
 * it follows has committed. So this is no longer only about notifications —
 * it is about any work that follows a committed operation the caller cannot
 * repeat. That caller needs to **report** the failure rather than only log it,
 * which is why the answer is a boolean; the four callers that only log ignore
 * it, exactly as they did when it returned nothing.
 */
export async function bestEffortNotice(
  context: AdminContext,
  subject: Record<string, string>,
  work: () => Promise<void>,
  message: string,
): Promise<boolean> {
  try {
    await work();
    return true;
  } catch (error) {
    context.log.error({ ...subject, err: error }, message);
    return false;
  }
}

/**
 * The words one unwind uses, so the two callers share the mechanism rather than
 * the prose.
 *
 * Everything that varies between a suspension and a deletion is here and
 * nothing else is: the money, the ordering, the idempotency and the failure
 * handling are the same problem in both cases, and were a second implementation
 * of them until #433.
 */
export interface AccountUnwindCopy {
  /**
   * Names the operation in the two error logs a stuck refund produces, so a log
   * search can still tell a suspension's leftovers from a deletion's.
   */
  readonly operation: string;
  /**
   * Who decided this, which is what licenses the **full** refund below.
   *
   * The refund is deliberately full rather than D3's cancellation tiers, and
   * the argument for that is `operator`-shaped: the platform is removing a
   * party from a transaction the other side did nothing wrong in, so charging
   * them a penalty for our moderation decision would be indefensible.
   *
   * That argument inverts when the account holder is the one leaving. A
   * customer holding a confirmed booking twelve hours out gets D3's late tier
   * if they press Cancel, and would get **everything back, across every future
   * booking at once, with the vendors paid nothing**, if deleting their account
   * ran this loop unchanged — a better refund for walking away than for asking.
   * So an `account-holder` unwind refuses to price the bookings that account
   * paid for, and leaves them for a human. See `unwindAccountBookings`.
   */
  readonly initiatedBy: 'operator' | 'account-holder';
  /**
   * Namespaces the refund's Stripe idempotency key.
   *
   * Distinct per caller on purpose: a vendor who is banned and then deletes
   * their account is two decisions about the same booking, and sharing a key
   * would make the second one silently return the first one's result.
   */
  readonly refundKeyPrefix: string;
  /** Written to `bookings.cancellation_reason`. */
  readonly cancellationReason: string;
  readonly customerRefunded: string;
  readonly customerUnpaid: string;
  readonly vendorRefunded: string;
  readonly vendorUnpaid: string;
}

/**
 * Builds the five sentences from the one word that differs between them.
 *
 * They were five literals per caller, ten in all, identical but for
 * `suspended` / `closed`. That is the shape this file exists to refuse: the
 * comments below record the notification copy being got wrong twice already —
 * one string told a vendor their payment had been refunded when they had not
 * paid — and ten strings maintained for one word of variation is eight more
 * places for the next correction to miss.
 */
function unwindCopy(
  operation: string,
  refundKeyPrefix: string,
  /** What happened to the account, in the word both parties are told. */
  state: 'suspended' | 'closed',
  initiatedBy: AccountUnwindCopy['initiatedBy'],
): AccountUnwindCopy {
  return {
    operation,
    initiatedBy,
    refundKeyPrefix,
    cancellationReason: `The other party's account was ${state}`,
    customerRefunded: `The other party's account was ${state}. Your payment has been refunded in full.`,
    customerUnpaid: `The other party's account was ${state}. Nothing was charged for this booking.`,
    vendorRefunded: `The customer's account was ${state} and the booking was cancelled. Their payment has been refunded, and your share of it has been reversed out of your Stripe balance.`,
    vendorUnpaid: `The customer's account was ${state} and the booking was cancelled. Nothing had been charged for it.`,
  };
}

export interface AccountUnwindResult {
  requestsDeclined: number;
  bookingsCancelled: number;
  refundsIssued: number;
  refundsFailed: number;
  /**
   * Confirmed bookings this unwind deliberately did not touch, because pricing
   * them is a decision nobody has made yet. Always `0` for an operator unwind.
   */
  bookingsLeftForReview: number;
}

/**
 * Leaves the marketplace in a state where nobody is waiting on an account that
 * can no longer answer.
 *
 * Open requests are declined, future confirmed bookings are cancelled and
 * refunded **in full**, and both counterparties are told. Extracted from
 * `setUserBanned` by #433, which needed the identical unwind for a deleted
 * Clerk identity: a customer can no more be left holding a booking against an
 * account that was deleted than against one that was suspended, and the two
 * cannot be allowed to drift apart.
 *
 * The refund is deliberately full rather than D3's cancellation tiers. Those
 * tiers price a *customer's* change of mind. Here the platform is removing a
 * party from a transaction the other side did nothing wrong in, so charging
 * them a cancellation penalty would be indefensible.
 *
 * Order is the same one `cancelBooking` argues for and for the same reason: the
 * money moves before the row does. A refund that succeeded against a booking
 * that then failed to update is recoverable; a cancelled booking whose refund
 * never happened tells someone their money is coming back when it is not.
 *
 * **It never throws.** Both callers have already decided the account is going,
 * and a refund Stripe refuses must not abandon the rest of the unwind — it is
 * counted into `refundsFailed`, logged, and left for a human.
 */
export async function unwindAccountBookings(
  context: AdminContext,
  targetId: string,
  vendorProfileId: string | null,
  now: Date,
  copy: AccountUnwindCopy,
): Promise<AccountUnwindResult> {
  const today = toDateString(now);
  const affected = await findConfirmedBookingsToUnwind(
    context.db,
    targetId,
    vendorProfileId,
    today,
  );

  let refundsIssued = 0;
  let bookingsCancelled = 0;
  let refundsFailed = 0;
  let bookingsLeftForReview = 0;

  for (const booking of affected) {
    /*
     * The account holder is walking away from a booking **they** paid for, so
     * this loop's full refund is the wrong price: D3 tiers a customer's
     * cancellation, and refunding everything for closing an account would hand
     * out a better outcome for leaving than for asking — on every future
     * booking at once, with `vendor_payout_cents` zeroed so the vendors are
     * paid nothing, and nothing linking a deleted identity to a new sign-up.
     *
     * **D39 ruled it, and ruled it a third way: closure is refused, not
     * priced.** An account holding a future confirmed booking cannot be closed
     * — the customer cancels through D3's existing tiers first — so no new
     * money path is created at all. #438 builds that refusal.
     *
     * This branch is therefore the **backstop, not the policy**. A Clerk
     * account deletion is reactive: by the time `user.deleted` arrives the
     * identity is already gone and there is nothing left to refuse, so any
     * closure that walks around the product's own route still lands here. The
     * booking is left exactly as it stands — confirmed, paid, the vendor's
     * payout intact — and reported for a human, which is the one response that
     * decides nothing.
     *
     * The other side of the same event is not affected: a booking where the
     * deleted account is the **vendor** is refunded in full below, which is the
     * case this ticket exists for and where the argument holds unaltered.
     *
     * **Which side of the payout release this sits on, stated rather than
     * assumed.** Entirely before it, and structurally so rather than by
     * arrangement: `findConfirmedBookingsToUnwind` bounds on
     * `event_date > today`, and D35 releases a payout 72 hours *after* the
     * event, so every row this loop can see has `payout_released_at` null, no
     * transfer, and nothing for D31's `reverse_transfer` to claw back. A
     * released booking is unreachable here.
     *
     * The one row that carries a release date with a future event is the
     * pre-#423 destination charge, which `0028`'s backfill marked released
     * regardless of its event date — and `isLegacyDestinationPayout` below
     * reads exactly `payout_released_at` and `stripe_transfer_id` to divert it
     * to a human. So the refusal to price holds on both sides of the line: the
     * post-release side is empty, and the legacy rows that look like it are
     * handed to an operator either way. Nothing here infers a price from
     * release state, and nothing needs to.
     */
    if (copy.initiatedBy === 'account-holder' && booking.customerId === targetId) {
      context.log.error(
        { bookingId: booking.id, operation: copy.operation },
        'Left a confirmed booking on a closed customer account: refunding it is an unpriced decision',
      );
      bookingsLeftForReview += 1;
      continue;
    }

    /*
     * What actually came back, for the row to record (#415). `null` while no
     * refund has moved, which is both the unpaid booking and the one whose
     * refund the loop below is about to fail on.
     */
    let refundedCents: number | null = null;

    /*
     * A pre-#423 destination charge is refused here for the same reason
     * `refundAndUnwind` refuses it: Stripe split that charge as the card
     * succeeded, so the vendor already holds their share, and this path's
     * refund no longer carries `reverse_transfer` — it would return the
     * customer's money and claw back nothing.
     *
     * The old comment here reasoned that "a ban cannot reach a booking that has
     * been transferred" because it only unwinds *future* events. That is true
     * of the new model and false of the old one: `0028`'s backfill marks every
     * legacy row released regardless of its event date, so a legacy booking for
     * an event next month is exactly the row this loop selects.
     */
    if (isLegacyDestinationPayout(booking)) {
      context.log.error(
        { bookingId: booking.id, operation: copy.operation },
        'Skipped a legacy destination-charge booking during an account unwind; it needs an operator refund',
      );
      refundsFailed += 1;
      continue;
    }

    if (booking.stripePaymentIntentId) {
      try {
        /*
         * Asked before told, for the same reason the customer's cancellation
         * asks: a key Stripe has forgotten is no guard at all, and an unwind
         * re-issued a day after one that failed to cancel its bookings would
         * otherwise refund every one of them twice (D31).
         */
        const alreadyRefunded = await context.stripe.findRefund(booking.stripePaymentIntentId);

        if (!alreadyRefunded) {
          const refund = await context.stripe.createRefund({
            paymentIntentId: booking.stripePaymentIntentId,
            amountCents: booking.totalAmountCents,
            /*
             * One refund per booking, however many times the account is
             * unwound. The caller's own precondition check is a read and not a
             * lock, so two concurrent calls both reach this loop; without a key
             * they would both refund.
             *
             * Versioned with the request: Stripe refuses a key replayed with
             * different parameters. D31 changed them once, and #423 changed
             * them again — the refund now carries neither `reverse_transfer`
             * nor `refund_application_fee`, because the charge is a plain one
             * into the platform balance. A ban re-issued within 24 hours of one
             * attempted under the old params would otherwise be refused with an
             * `idempotency_error` rather than refunded.
             *
             * There is deliberately no transfer reversal on this path. It only
             * ever unwinds bookings whose event date is still ahead
             * (`findConfirmedBookingsToUnwind`), and a payout is not released
             * until well after the event — so this loop cannot reach a booking
             * that has been transferred, and the money is all still Orla's to
             * give back.
             */
            idempotencyKey: `${copy.refundKeyPrefix}:${booking.id}`,
          });

          refundedCents = refund.amountCents;
        } else {
          /*
           * Read off the money that moved, not off the amount this call asked
           * for. They agree on every first attempt and part company on the one
           * that matters: a booking the customer had already half-refunded
           * through their own cancellation, whose row never moved, is found
           * here — and recording `totalAmountCents` for it would tell them
           * they got everything back when half of it never left Stripe.
           */
          refundedCents = alreadyRefunded.amountCents;
        }

        refundsIssued += 1;
      } catch (error) {
        /*
         * One failed refund must not abandon the rest of the unwind. The
         * account still goes, the remaining bookings are still unwound, and
         * this one is logged loudly because the money did not move and only a
         * human can finish it.
         */
        context.log.error(
          { bookingId: booking.id, operation: copy.operation, err: error },
          'Refund failed while unwinding an account',
        );
        /*
         * Counted, not only logged (#400). The `continue` is right — a booking
         * whose money did not come back must not be cancelled underneath the
         * customer, and one failure must not abandon the rest — but it leaves a
         * **confirmed** booking on an account nobody can reach, with neither
         * party told, and the result used to have no field to say so. The
         * operator saw a clean success and a log line nobody was reading.
         */
        refundsFailed += 1;
        continue;
      }
    }

    const cancelled = await cancelBookingAndFreeDate(context.db, booking.id, {
      cancelledAt: now,
      cancellationReason: copy.cancellationReason,
      /*
       * The column, not the sentence above it (#415). Both parties' screens
       * have to distinguish a platform unwind from a customer's own
       * cancellation, and reading that off `cancellation_reason` would make
       * this string load-bearing copy.
       *
       * `admin` covers a deletion too. `BOOKING_CANCELLED_BY` has exactly two
       * members — the customer, or the platform — and a vendor's self-deletion
       * is the platform acting, not the customer changing their mind.
       */
      cancelledBy: 'admin',
      refundAmountCents: refundedCents,
      /*
       * The unwind refunds in **full**, so the vendor keeps nothing and the
       * payout sweep must never pay this booking out. Stating it rather than
       * leaving `vendor_payout_cents` at the figure settled at payment is what
       * stops the row staying releasable after the money went back.
       */
      vendorPayoutCents: 0,
      disputeReason: null,
    });

    if (!cancelled) {
      continue;
    }

    bookingsCancelled += 1;

    const recipients = [booking.customerId, booking.vendorUserId].filter(
      (id): id is string => typeof id === 'string' && id !== targetId,
    );

    /*
     * The body is per recipient, and per whether money actually moved.
     *
     * One string went to both sides claiming "your payment has been refunded in
     * full" — to the vendor, who did not pay but was about to be paid, and on
     * an unpaid booking, where no refund happened at all. Both are the product
     * telling somebody something untrue about their money.
     *
     * The vendor's line says *reversed*, not "no payout will follow" (D31). A
     * transfer already paid out is clawed back rather than withheld, and a
     * vendor whose balance is about to go negative learns it here.
     */
    const refunded = booking.stripePaymentIntentId !== null;

    for (const recipient of recipients) {
      await bestEffortNotice(
        context,
        { bookingId: booking.id, recipient },
        async () => {
          const body =
            recipient === booking.customerId
              ? refunded
                ? copy.customerRefunded
                : copy.customerUnpaid
              : refunded
                ? copy.vendorRefunded
                : copy.vendorUnpaid;

          const stored = await insertNotification(context.db, {
            userId: recipient,
            type: 'booking_cancelled',
            title: 'A booking was cancelled',
            body,
            data: { bookingId: booking.id },
          });

          if (stored) {
            context.hub.publish(recipient, {
              type: 'new_notification',
              notification: {
                id: stored.id,
                type: stored.type,
                title: stored.title,
                body: stored.body,
                href: '/bookings',
                isRead: false,
                createdAt: stored.createdAt,
              },
            });

            /*
             * Per recipient, which is the point. One shared string here once told a
             * vendor their payment had been refunded — they had not paid, and on an
             * unpaid booking nothing was refunded at all. The email carries the
             * body written for *this* reader, so both parties read the same refund
             * figure and neither reads the other's.
             */
            queueNotificationEmail(
              context.mail,
              stored,
              recipient === booking.customerId ? 'customer' : 'vendor',
            );
          }
        },
        'The operation succeeded but its notification could not be recorded',
      );
    }
  }

  const requestsDeclined = await declineOpenRequests(context.db, targetId, vendorProfileId, now);

  return {
    requestsDeclined,
    bookingsCancelled,
    refundsIssued,
    refundsFailed,
    bookingsLeftForReview,
  };
}

/** An operator suspended the account. */
export const SUSPENSION_UNWIND = unwindCopy('ban', 'ban-refund:direct', 'suspended', 'operator');

/**
 * The account holder deleted their identity (#433).
 *
 * "Closed" rather than "suspended", because it is neither a moderation decision
 * nor one anybody can appeal or reverse — and the counterparty is owed the true
 * reason their booking ended.
 */
export const DELETION_UNWIND = unwindCopy(
  'deletion',
  'delete-refund:direct',
  'closed',
  'account-holder',
);

/**
 * An operator closed the account on its holder's request (#438).
 *
 * `account-holder`, though an operator typed it. The word names **whose
 * decision** the closure is, not whose hands were on the keyboard, and that is
 * what licenses or refuses the full refund above: the person leaving is the one
 * who paid, so pricing their own future bookings is the unpriced decision D39
 * refuses to make.
 *
 * On this path the branch it selects should never fire at all — `closeAccount`
 * refuses the closure with a 409 while any future confirmed booking exists. It
 * matters for the row that slips between that read and this loop: a booking
 * confirmed in the gap is then **left standing and reported**, rather than
 * refunded in full by a route whose whole premise is that it refunds nothing.
 *
 * Its own `refundKeyPrefix` for the reason the field exists: a vendor who is
 * banned and then closed is two decisions about the same booking, and a shared
 * key would make the second silently return the first one's result.
 */
export const CLOSURE_UNWIND = unwindCopy(
  'closure',
  'close-refund:direct',
  'closed',
  'account-holder',
);
