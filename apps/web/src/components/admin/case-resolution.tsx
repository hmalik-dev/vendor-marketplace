'use client';

import { useRouter } from 'next/navigation';
import { formatPrice } from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';
import { wireAdminCaseDetailSchema, wireBookingViewSchema } from '@/lib/wire-schemas';
import type { WireAdminCaseDetail } from '@/lib/wire-schemas';

export interface CaseResolutionProps {
  supportCase: WireAdminCaseDetail;
}

/**
 * The two-position control, and the one plain close beside it (#431).
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
 * deciding on.
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
          onConfirm={close}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <ConfirmAction
        trigger={
          <Button type="button" size="sm">
            Resolve for the vendor
          </Button>
        }
        title="Resolve for the vendor"
        description={
          <>
            The hold comes off and {formatPrice(booking.vendorPayoutCents)} is released to{' '}
            {booking.vendorName} on the next payout sweep. The customer is told the report was not
            upheld. Nothing is refunded.
          </>
        }
        confirmLabel="Resolve for the vendor"
        onConfirm={() => rule('vendor')}
      />
      <ConfirmAction
        trigger={
          <Button type="button" size="sm" variant="destructive">
            Resolve for the customer
          </Button>
        }
        title="Resolve for the customer"
        /*
         * `destructive`, and it earns the red: the refund is a real card
         * movement and the cancellation cannot be undone from this console.
         */
        destructive
        description={
          <>
            {formatPrice(booking.totalAmountCents)} goes back to {booking.customerName} in full, and
            the booking is cancelled. {booking.vendorName} keeps nothing, and the cancellation is
            recorded as the platform&apos;s rather than the customer&apos;s. This cannot be undone
            here.
          </>
        }
        confirmLabel="Refund and cancel"
        onConfirm={() => rule('customer')}
      />
    </div>
  );
}
