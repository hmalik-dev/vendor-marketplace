'use client';

import { useRouter } from 'next/navigation';
import { formatPrice, payoutReleaseAt } from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';
import { wireAdminCaseDetailSchema, wireBookingViewSchema } from '@/lib/wire-schemas';
import type { WireAdminCaseDetail } from '@/lib/wire-schemas';

/**
 * The sweep date, named.
 *
 * `Tue 8 Sep` — the weekday is what makes it a date an operator can hold a
 * conversation about rather than a number they would have to look up. UTC,
 * like every other stamp on this console.
 */
const SWEEP_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * The thing operators get wrong, drawn into Pattern C's `ConfirmAction`.
 *
 * Both positions carry a caution and they are **not the same sentence**, which
 * is deliberate: the refund one is about money that only moves on the customer
 * position, and putting it on the vendor position would describe a refund that
 * is not happening. What both share is the half that catches people either
 * way — the bank's dispute is open regardless of which way the platform rules,
 * and an operator who releases a payout and assumes the chargeback went with it
 * has made the same mistake in the other direction.
 */
const CUSTOMER_CAUTION =
  "Refunds settle to the customer's bank in 5–10 days. Stripe's dispute stays open until the bank closes it — refunding does not withdraw it.";
const VENDOR_CAUTION =
  "Stripe's dispute stays open until the bank closes it. Releasing the payout is the platform's ruling, not the network's — if the bank later finds for the customer, the money comes back out of the platform.";

/**
 * "Cancel" on this screen is a verb about money, so the escape names the state
 * it returns you to instead.
 *
 * The same rule that gave the customer's own booking dialog "Keep booking"
 * rather than "Cancel" (`31-content-voice.md`).
 */
const KEEP_OPEN = 'Keep the case open';

export interface CaseResolutionProps {
  supportCase: WireAdminCaseDetail;
}

/**
 * The two-position control, and the one plain close beside it (#431), drawn to
 * Pattern C of the admin delta (#454).
 *
 * **Both money positions call `PUT /admin/bookings/:bookingId/dispute`**, which
 * is the route `resolveDispute` already had. Nothing here is a second money
 * path: the ruling lifts the hold or refunds the card exactly as it did before,
 * and closing the case is part of that one call rather than a follow-up this
 * component fires — two requests would leave a browser tab closed mid-way as the
 * thing standing between a vendor and their payout.
 *
 * Each goes through `ConfirmAction` **naming the consequence in money**, per
 * `22-admin.md`. "Are you sure?" names nothing; "$1,200 goes back to the
 * customer and the booking is cancelled" is the sentence an operator is actually
 * deciding on. Pattern C adds what the delta found missing: **what the other
 * party gets**, the payout sweep **by name**, and the field that will be written.
 */
export function CaseResolution({ supportCase }: CaseResolutionProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const booking = supportCase.booking;

  async function rule(outcome: 'vendor' | 'customer'): Promise<void> {
    if (!booking) {
      return;
    }

    await call(`/admin/bookings/${booking.id}/dispute`, {
      method: 'PUT',
      body: { outcome },
      schema: wireBookingViewSchema,
    });
    router.refresh();
  }

  async function close(): Promise<void> {
    await call(`/admin/cases/${supportCase.id}/resolve`, {
      method: 'PUT',
      schema: wireAdminCaseDetailSchema,
    });
    router.refresh();
  }

  if (supportCase.status === 'resolved') {
    return (
      <p className="text-sm text-stone-600">
        Resolved{supportCase.resolvedByName ? ` by ${supportCase.resolvedByName}` : ''}. A resolved
        case cannot be reopened — file a new one if the story has changed.
      </p>
    );
  }

  /*
   * A case whose booking is no longer `disputed` has no hold left to move, so
   * the two money positions would only ever be refused with the 409 the service
   * raises. Offering a control that exists to be rejected is what `22-admin.md`
   * calls furniture; the plain close is the honest affordance.
   */
  if (!booking || booking.status !== 'disputed') {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="text-sm text-stone-700">
          {booking
            ? 'This booking is not on hold, so there is no payout to move. Closing the case records that it was dealt with.'
            : 'Nothing is on hold. Closing the case records that it was dealt with.'}
        </p>
        <ConfirmAction
          trigger={
            <Button type="button" size="sm" variant="secondary">
              Mark resolved
            </Button>
          }
          title="Mark this case resolved"
          description="It leaves the open queue and the oldest-open figure stops counting it. Nothing moves."
          confirmLabel="Mark resolved"
          cancelLabel={KEEP_OPEN}
          onConfirm={close}
        />
      </div>
    );
  }

  const payout = formatPrice(booking.vendorPayoutCents);
  const total = formatPrice(booking.totalAmountCents);
  const fee = formatPrice(booking.platformFeeCents);
  /*
   * The counterparty's zero, formatted rather than typed as `$0.00`. It is the
   * figure the delta insists on — "and what did the vendor get?" is the second
   * question an operator is asked afterwards — and reading it out of
   * `formatPrice` keeps it in the same currency and shape as the amount beside
   * it, which is what makes the two comparable at a glance.
   */
  const nothing = formatPrice(0);

  /*
   * The date the money actually moves, named rather than described.
   *
   * `payoutReleaseAt` is D35's rule: `PAYOUT_RELEASE_HOURS` after the start of
   * the event day. Once that instant has passed the sweep takes the booking on
   * its next tick, which is minutes rather than days away — so the date to tell
   * an operator is the later of the two, and "the next sweep" is honest for
   * both branches. The frame draws exactly this: *"pays out to Kessler & Co. on
   * the next sweep, **Tue 8 Sep**"*.
   */
  const releaseAt = payoutReleaseAt(booking.eventDate);
  const sweep = SWEEP_DATE.format(
    releaseAt && releaseAt.getTime() > Date.now() ? releaseAt : new Date(),
  );

  /*
   * Pattern C's resolve control: **two positions, side by side, equal weight**.
   *
   * Neither is `primary`. The operator's job here is to judge, and a filled clay
   * button on one side would be the product voting on somebody else's money —
   * which is why the delta draws this differently from every other pair of
   * console actions. Only the destructive edge is marked, and it is *outlined*
   * red rather than filled: a filled red button in a corner is a mis-click
   * waiting. The fill arrives at the confirm, which is the last thing before the
   * money moves and the one place it is earned.
   */
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col rounded-xl border border-stone-300 bg-stone-50 p-3.5">
        <p className="text-base font-semibold text-stone-900">Resolve for the vendor</p>
        <p className="mt-1.5 flex-1 text-sm leading-prose text-stone-700">
          The hold lifts. <span className="font-mono">{payout}</span> pays out to{' '}
          {booking.vendorName} on the next sweep, <strong className="font-semibold">{sweep}</strong>
          . {booking.customerName} is refunded <span className="font-mono">{nothing}</span> and is
          told why in writing.
        </p>
        <div className="mt-3">
          <ConfirmAction
            trigger={
              <Button type="button" size="sm" variant="secondary" className="w-full">
                Resolve for the vendor
              </Button>
            }
            title={`Release ${payout} to ${booking.vendorName}?`}
            description={
              <>
                <p>
                  The payout hold comes off and <strong className="font-semibold">{payout}</strong>{' '}
                  goes to {booking.vendorName} on the next sweep,{' '}
                  <strong className="font-semibold">{sweep}</strong>. The booking stands, so{' '}
                  <span className="font-mono">cancelled_by</span> is not written.
                </p>
                <p className="mt-2">
                  {booking.customerName} is refunded{' '}
                  <strong className="font-semibold">{nothing}</strong> and is told the report was
                  not upheld. Case <span className="font-mono">{supportCase.reference}</span> closes
                  as <em>resolved for the vendor</em>. This can&apos;t be undone here.
                </p>
              </>
            }
            caution={VENDOR_CAUTION}
            confirmLabel="Release the payout"
            cancelLabel={KEEP_OPEN}
            onConfirm={() => rule('vendor')}
          />
        </div>
      </div>

      <div className="flex flex-col rounded-xl border border-error-200 bg-stone-0 p-3.5">
        <p className="text-base font-semibold text-stone-900">Resolve for the customer</p>
        <p className="mt-1.5 flex-1 text-sm leading-prose text-stone-700">
          <span className="font-mono">{total}</span> is refunded to {booking.customerName} and the
          booking is cancelled. {booking.vendorName} receives{' '}
          <span className="font-mono">{nothing}</span>; the <span className="font-mono">{fee}</span>{' '}
          platform fee is returned too.
        </p>
        <div className="mt-3">
          <ConfirmAction
            trigger={
              /*
               * Outlined red, never filled — the frame's `btnD`. The `Button`
               * primitive's `destructive` variant is a red *fill*, which this
               * position must not carry while it sits beside its equal.
               */
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full border-error-200 text-error-500 hover:bg-error-50"
              >
                Refund and cancel
              </Button>
            }
            title={`Refund ${total} and cancel this booking?`}
            /*
             * `destructive` on the *confirm*, where the red fill is earned: the
             * refund is a real card movement and the cancellation cannot be
             * undone from this console.
             */
            destructive
            description={
              <>
                <p>
                  {booking.customerName} is refunded{' '}
                  <strong className="font-semibold">{total}</strong>, including the{' '}
                  <strong className="font-semibold">{fee}</strong> platform fee. The booking is
                  cancelled with <span className="font-mono">cancelled_by = admin</span>.
                </p>
                <p className="mt-2">
                  {booking.vendorName} receives <strong className="font-semibold">{nothing}</strong>{' '}
                  for this booking. The payout hold is released as cancelled rather than paid, so
                  nothing reaches them on the <strong className="font-semibold">{sweep}</strong>{' '}
                  sweep or any later one, and they are notified with the reason.
                </p>
                <p className="mt-2">
                  Case <span className="font-mono">{supportCase.reference}</span> closes as{' '}
                  <em>resolved for the customer</em>. This can&apos;t be undone here.
                </p>
              </>
            }
            caution={CUSTOMER_CAUTION}
            confirmLabel="Refund and cancel"
            cancelLabel={KEEP_OPEN}
            onConfirm={() => rule('customer')}
          />
        </div>
      </div>

      <p className="text-sm text-stone-600 sm:col-span-2">
        Neither position can be undone from this screen. A resolved case reopens only by a new case
        on the same booking.
      </p>
    </div>
  );
}
