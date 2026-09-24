import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPrice, uuidSchema } from '@vendor-marketplace/shared';
import {
  Absent,
  AdminCard,
  CardEmpty,
  CardTable,
  DetailView,
  IdentityCard,
  KeyValue,
  KeyValueList,
  ScopeChip,
  type CardTableColumn,
} from '@/components/admin/admin-detail';
import { NotificationsCard } from '@/components/admin/notifications-card';
import { StatusPill } from '@/components/ui/status-pill';
import { getAdminCustomerDetail } from '@/lib/admin-data';
import { BOOKING_PRESENTATION, formatEventDate } from '@/lib/booking-entries';
import type { WireAdminCustomerDetail } from '@/lib/wire-schemas';

/** Every card is a request-time read; nothing here is cached. */
export const dynamic = 'force-dynamic';

type Review = WireAdminCustomerDetail['reviews']['written']['items'][number];

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

const DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const LINK = 'text-clay-600 hover:underline';

/** `latest N shown` when the card lists a slice of what it counts. */
function sliceNote(total: number, shown: number): string | undefined {
  return total > shown ? `latest ${shown} shown` : undefined;
}

/**
 * A review's columns, one direction or the other.
 *
 * `is_public = false` is two different facts, as on `/admin/reviews`: an
 * admin hid a customer's review of a vendor, while a vendor chose to keep a
 * note about a customer private. The pill says which.
 */
function reviewColumns(direction: 'written' | 'received'): CardTableColumn<Review>[] {
  return [
    {
      key: 'date',
      header: 'Written',
      width: '110px',
      cell: (review) => <span className="font-mono text-meta">{DAY.format(review.createdAt)}</span>,
    },
    {
      key: 'vendor',
      header: direction === 'written' ? 'Of vendor' : 'By vendor',
      width: '1fr',
      cell: (review) => (
        <Link href={`/admin/vendors/${review.vendorId}`} className={LINK}>
          {review.vendorName}
        </Link>
      ),
    },
    { key: 'rating', header: 'Rating', width: '60px', cell: (review) => `${review.rating}/5` },
    {
      key: 'review',
      header: 'Review',
      width: '1.6fr',
      cell: (review) => (
        <span className="flex flex-col items-start gap-1">
          {review.isPublic ? null : (
            <StatusPill tone="inert">{direction === 'written' ? 'Hidden' : 'Private'}</StatusPill>
          )}
          {review.title ? <span className="font-semibold">{review.title}</span> : null}
          <span>{review.content}</span>
        </span>
      ),
    },
    {
      key: 'booking',
      header: 'Booking',
      width: '70px',
      align: 'end',
      cell: (review) => (
        <Link href={`/admin/bookings/${review.bookingId}`} className={LINK}>
          View
        </Link>
      ),
    },
  ];
}

function ReviewsCard({
  title,
  direction,
  reviews,
  empty,
}: {
  title: string;
  direction: 'written' | 'received';
  reviews: WireAdminCustomerDetail['reviews']['written'];
  empty: string;
}): React.ReactElement {
  const note = sliceNote(reviews.total, reviews.items.length);

  return (
    <AdminCard
      title={`${title} · ${reviews.total}`}
      note={note ? <span className="text-stone-600">{note}</span> : undefined}
    >
      {reviews.items.length === 0 ? (
        <CardEmpty>{empty}</CardEmpty>
      ) : (
        <CardTable
          label={title}
          rows={reviews.items}
          rowKey={(review) => review.id}
          columns={reviewColumns(direction)}
        />
      )}
    </AdminCard>
  );
}

/**
 * `/admin/customers/[userId]`, composed to Pattern B (VEN-400).
 *
 * The account first — ban and closure as the instants they happened — then
 * what they booked, what they said about vendors, what vendors said about
 * them, and what the platform told them. A closed account renders the same
 * record, read-only, with its closure date: that is how the customer list's
 * `Closed` view reaches it. Nothing here changes state; the data-rights
 * record, where closure and export live, is linked from the right column.
 */
export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<React.ReactElement> {
  const { userId } = await params;

  // `params` is untrusted input: an id that cannot name a customer is a 404, not a 400 page.
  if (!uuidSchema.safeParse(userId).success) {
    notFound();
  }

  const detail = await getAdminCustomerDetail(userId);

  if (!detail) {
    notFound();
  }

  const { customer, bookings, reviews, notifications } = detail;
  const heading = customer.name || customer.email;
  const place = [customer.city, customer.state].filter(Boolean).join(', ');
  const bookingsNote = sliceNote(bookings.total, bookings.items.length);

  return (
    <DetailView
      header={{
        crumb: { label: 'Customers', href: '/admin/customers' },
        current: heading,
        heading,
        pills: customer.deletedAt ? (
          <StatusPill tone="inert">Closed</StatusPill>
        ) : customer.isBanned ? (
          <StatusPill tone="needsYou">Flagged</StatusPill>
        ) : null,
        stat: (
          <>
            customer <span className="font-mono text-helper">{customer.id}</span> · {bookings.total}{' '}
            {bookings.total === 1 ? 'booking' : 'bookings'} · joined{' '}
            {DAY.format(customer.createdAt)}
          </>
        ),
      }}
      record={
        <>
          <AdminCard
            readOnly
            title="Account"
            note={<ScopeChip>Read-only — each row a stored value</ScopeChip>}
          >
            <KeyValueList>
              <KeyValue label="Email">
                {customer.email}
                {customer.pendingEmail ? (
                  <span className="mt-1 flex items-center gap-1.5">
                    <StatusPill tone="failed">Email out of date</StatusPill>
                    <span className="text-stone-600">{customer.pendingEmail}</span>
                  </span>
                ) : null}
              </KeyValue>
              <KeyValue label="Phone" kind={customer.phone ? 'mono' : 'text'}>
                {customer.phone ?? <Absent />}
              </KeyValue>
              <KeyValue label="Location">{place || <Absent />}</KeyValue>
              <KeyValue label="Joined" kind="mono">
                {STAMP.format(customer.createdAt)} UTC
              </KeyValue>
              <KeyValue label="Suspended" kind={customer.bannedAt ? 'mono' : 'text'}>
                {customer.bannedAt ? (
                  `${STAMP.format(customer.bannedAt)} UTC`
                ) : customer.isBanned ? (
                  'Yes'
                ) : (
                  <Absent>No</Absent>
                )}
              </KeyValue>
              <KeyValue label="Closed" kind={customer.deletedAt ? 'mono' : 'text'}>
                {customer.deletedAt ? (
                  `${STAMP.format(customer.deletedAt)} UTC`
                ) : (
                  <Absent>No</Absent>
                )}
              </KeyValue>
            </KeyValueList>
          </AdminCard>

          <AdminCard
            title={`Bookings · ${bookings.total}`}
            note={bookingsNote ? <span className="text-stone-600">{bookingsNote}</span> : undefined}
          >
            {bookings.items.length === 0 ? (
              <CardEmpty>No bookings yet.</CardEmpty>
            ) : (
              <CardTable
                label="Bookings"
                rows={bookings.items}
                rowKey={(booking) => booking.id}
                columns={[
                  {
                    key: 'date',
                    header: 'Event date',
                    width: '170px',
                    cell: (booking) => (
                      <Link href={`/admin/bookings/${booking.id}`} className={LINK}>
                        {formatEventDate(booking.eventDate)}
                      </Link>
                    ),
                  },
                  {
                    key: 'vendor',
                    header: 'Vendor',
                    width: '1fr',
                    cell: (booking) => (
                      <Link href={`/admin/vendors/${booking.vendorId}`} className={LINK}>
                        {booking.vendorName}
                      </Link>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    width: '120px',
                    cell: (booking) => (
                      <StatusPill tone={BOOKING_PRESENTATION[booking.status].tone}>
                        {BOOKING_PRESENTATION[booking.status].label}
                      </StatusPill>
                    ),
                  },
                  {
                    key: 'total',
                    header: 'Total',
                    width: '100px',
                    align: 'end',
                    cell: (booking) => (
                      <span className="font-mono text-meta">
                        {formatPrice(booking.totalAmountCents)}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </AdminCard>

          <ReviewsCard
            title="Reviews written"
            direction="written"
            reviews={reviews.written}
            empty="This customer has not reviewed a vendor."
          />
          <ReviewsCard
            title="Reviews received"
            direction="received"
            reviews={reviews.received}
            empty="No vendor has reviewed this customer."
          />

          <NotificationsCard {...notifications} empty="Nothing has been sent to this customer." />
        </>
      }
      aside={
        <>
          <IdentityCard
            name={heading}
            subtitle={place || <Absent />}
            fields={[
              { label: 'Contact', value: customer.email },
              { label: 'Account', value: customer.id, mono: true },
              { label: 'Joined', value: DAY.format(customer.createdAt) },
            ]}
          />

          {/* Links, not data, so outside the read-only Identity card (Pattern B rule 4). */}
          <AdminCard title="Records">
            <ul className="flex flex-col gap-1.5 px-4 py-3 text-sm">
              <li>
                <Link href={`/admin/users/${customer.id}`} className={LINK}>
                  Data rights · export and closure
                </Link>
              </li>
              <li>
                <Link href={`/admin/activity?subject=${customer.id}`} className={LINK}>
                  Activity · what admins did to this account
                </Link>
              </li>
            </ul>
          </AdminCard>

          <p className="rounded-panel bg-steel-50 px-3.5 py-3 text-helper leading-[1.55] text-steel-600">
            <strong className="font-semibold">Nothing here changes the account.</strong> Export and
            closure live on the data-rights record, and each lands in Activity.
          </p>
        </>
      }
    />
  );
}
