import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatPrice,
  uuidSchema,
  type BookingCancelledBy,
  type PayoutModel,
} from '@vendor-marketplace/shared';
import {
  Absent,
  AdminCard,
  DetailView,
  IdentityCard,
  KeyValue,
  KeyValueList,
  ScopeChip,
} from '@/components/admin/admin-detail';
import { NotificationsCard } from '@/components/admin/notifications-card';
import { StatusPill } from '@/components/ui/status-pill';
import { getAdminBookingDetail } from '@/lib/admin-data';
import {
  BOOKING_PRESENTATION,
  PAYOUT_FAILING_LABEL,
  PAYOUT_PRESENTATION,
  PAYOUT_STRANDED_LABEL,
  formatEventDate,
} from '@/lib/booking-entries';
import { cn } from '@/lib/utils';

/** Every value is a request-time read; nothing here is cached. */
export const dynamic = 'force-dynamic';

/** 24-hour and UTC, like every stamp in the console (#454). */
const STAMP = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

const PAYOUT_MODEL_LABELS: Record<PayoutModel, string> = {
  separate: 'Separate transfer, released after the event',
  destination: 'Destination charge, split at payment',
};

const CANCELLED_BY_LABELS: Record<BookingCancelledBy, string> = {
  customer: 'The customer',
  admin: 'An admin',
};

function Stamp({ at }: { at: Date }): React.ReactElement {
  return <>{STAMP.format(at)} UTC</>;
}

/** Money right-aligned and tabular; a sub-total sits indented from the total's edge. */
function Money({ cents, sub = false }: { cents: number; sub?: boolean }): React.ReactElement {
  return (
    <span className={cn('block text-right tabular-nums', sub && 'pr-6 text-stone-700')}>
      {formatPrice(cents)}
    </span>
  );
}

/**
 * `/admin/bookings/[bookingId]`, composed to Pattern B (VEN-399).
 *
 * **One card, not five: the money story reads top to bottom in event order** —
 * total, fee, payout, paid, completed, released, attempts, refund, cancellation,
 * dispute. A row that does not apply is omitted rather than dashed, so the
 * card's length is the story's length. Read-only: the dispute and payout-retry
 * levers live where they already are. Below it, what either party was told
 * about the booking (VEN-400).
 */
export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}): Promise<React.ReactElement> {
  const { bookingId } = await params;

  // `params` is untrusted input: an id that cannot name a booking is a 404, not a 400 page.
  if (!uuidSchema.safeParse(bookingId).success) {
    notFound();
  }

  const booking = await getAdminBookingDetail(bookingId);

  if (!booking) {
    notFound();
  }

  const { vendor, customer } = booking;
  const presentation = BOOKING_PRESENTATION[booking.status];
  const payout = booking.payoutStranded
    ? { label: PAYOUT_STRANDED_LABEL, tone: 'failed' as const }
    : PAYOUT_PRESENTATION[booking.payoutStatus];
  const heading = `${vendor.businessName} · ${formatEventDate(booking.eventDate)}`;

  return (
    <DetailView
      header={{
        crumb: { label: 'Bookings', href: '/admin/bookings' },
        current: heading,
        heading,
        pills: (
          <>
            <StatusPill tone={presentation.tone}>{presentation.label}</StatusPill>
            <StatusPill tone={payout.tone}>{payout.label}</StatusPill>
          </>
        ),
        stat: (
          <>
            booking <span className="font-mono text-helper">{booking.id}</span> · created{' '}
            <Stamp at={booking.createdAt} />
          </>
        ),
      }}
      record={
        <>
          <AdminCard
            readOnly
            title="Money"
            note={<ScopeChip>Read-only — each row a stored value</ScopeChip>}
          >
            <KeyValueList>
              <KeyValue label="Total" kind="mono">
                <Money cents={booking.totalAmountCents} />
              </KeyValue>
              <KeyValue label="Platform fee" kind="mono">
                <Money cents={booking.platformFeeCents} sub />
              </KeyValue>
              <KeyValue label="Vendor payout" kind="mono">
                <Money cents={booking.vendorPayoutCents} sub />
              </KeyValue>
              <KeyValue label="Payout model">{PAYOUT_MODEL_LABELS[booking.payoutModel]}</KeyValue>
              {booking.stripePaymentIntentId ? (
                <KeyValue label="Payment intent" kind="mono">
                  {booking.stripePaymentIntentId}
                </KeyValue>
              ) : null}
              {booking.paidAt ? (
                <KeyValue label="Paid" kind="mono">
                  <Stamp at={booking.paidAt} />
                </KeyValue>
              ) : null}
              {booking.completedAt ? (
                <KeyValue label="Completed" kind="mono">
                  <Stamp at={booking.completedAt} />
                </KeyValue>
              ) : null}
              <KeyValue label="Payout">
                {payout.label}
                {vendor.payoutHold &&
                booking.payoutStatus !== 'released' &&
                booking.payoutStatus !== 'not-owed' ? (
                  <span className="text-gold-600"> · vendor&apos;s payouts held by an admin</span>
                ) : null}
                {booking.payoutFailing && !booking.payoutStranded ? (
                  <span className="ml-2 align-middle">
                    <StatusPill tone="failed">{PAYOUT_FAILING_LABEL}</StatusPill>
                  </span>
                ) : null}
              </KeyValue>
              {booking.payoutReleasedAt ? (
                <KeyValue label="Payout released" kind="mono">
                  <Stamp at={booking.payoutReleasedAt} />
                </KeyValue>
              ) : null}
              {booking.stripeTransferId ? (
                <KeyValue label="Transfer" kind="mono">
                  {booking.stripeTransferId}
                </KeyValue>
              ) : null}
              {booking.payoutAttempts > 0 ? (
                <KeyValue label="Payout attempts">
                  {booking.payoutAttempts}
                  {booking.payoutFailureReason ? (
                    <span className="block font-mono text-meta text-error-500">
                      {booking.payoutFailureReason}
                    </span>
                  ) : null}
                </KeyValue>
              ) : null}
              {booking.refundAmountCents !== null ? (
                <KeyValue label="Refunded" kind="mono">
                  <Money cents={booking.refundAmountCents} />
                </KeyValue>
              ) : null}
              {booking.externalRefundCents > 0 ? (
                <KeyValue label="Refunded outside the app" kind="mono">
                  <Money cents={booking.externalRefundCents} />
                </KeyValue>
              ) : null}
              {booking.cancelledAt ? (
                <KeyValue label="Cancelled" kind="mono">
                  <Stamp at={booking.cancelledAt} />
                </KeyValue>
              ) : null}
              {booking.cancellationReason ? (
                <KeyValue label="Cancellation reason">{booking.cancellationReason}</KeyValue>
              ) : null}
              {booking.cancelledBy ? (
                <KeyValue label="Cancelled by">{CANCELLED_BY_LABELS[booking.cancelledBy]}</KeyValue>
              ) : null}
              {booking.disputeReason ? (
                <KeyValue label="Dispute reason">{booking.disputeReason}</KeyValue>
              ) : null}
            </KeyValueList>
          </AdminCard>
          <NotificationsCard
            {...booking.notifications}
            empty="Nothing has been sent to either party about this booking."
          />
        </>
      }
      aside={
        <>
          <IdentityCard
            name={vendor.businessName}
            subtitle={formatEventDate(booking.eventDate)}
            fields={[
              { label: 'Customer', value: customer.name },
              { label: 'Contact', value: customer.email },
              { label: 'Venue', value: booking.eventLocation ?? <Absent /> },
              { label: 'Request', value: booking.requestId, mono: true },
            ]}
          />

          {/* Links, not data, so outside the read-only Identity card (Pattern B rule 4). */}
          <AdminCard title="Records">
            <ul className="flex flex-col gap-1.5 px-4 py-3 text-sm">
              <li>
                <Link
                  href={`/admin/vendors/${vendor.id}`}
                  className="text-clay-600 hover:underline"
                >
                  Vendor · {vendor.businessName}
                </Link>
              </li>
              <li>
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="text-clay-600 hover:underline"
                >
                  Customer · {customer.name}
                </Link>
              </li>
            </ul>
          </AdminCard>

          <p className="rounded-panel bg-steel-50 px-3.5 py-3 text-helper leading-[1.55] text-steel-600">
            <strong className="font-semibold">Nothing here changes money.</strong> A dispute is
            ruled and a stuck payout retried from their own controls, and each lands in Activity.
          </p>
        </>
      }
    />
  );
}
