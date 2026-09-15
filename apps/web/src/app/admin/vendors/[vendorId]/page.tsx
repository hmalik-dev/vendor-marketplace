import {
  ADMIN_VENDOR_STATUS_LABELS,
  formatPrice,
  uuidSchema,
  type AdminAvailabilityLockStatus,
} from '@vendor-marketplace/shared';
import { notFound } from 'next/navigation';
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
} from '@/components/admin/admin-detail';
import {
  PackageActiveControl,
  PortfolioRemoveControl,
  VendorDetailActions,
} from '@/components/admin/vendor-detail-actions';
import { VENDOR_STATUS_TONES } from '@/components/admin/vendor-status';
import { FallbackImage } from '@/components/ui/fallback-image';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { displayRating } from '@/lib/admin-params';
import { getAdminVendorDetail } from '@/lib/admin-data';
import { formatEventDate } from '@/lib/booking-entries';
import { PRICE_TYPE_LABELS } from '@/lib/package-labels';
import type { WireAdminVendorDetail } from '@/lib/wire-schemas';

/** Every card is a request-time read; nothing here is cached. */
export const dynamic = 'force-dynamic';

type Lock = WireAdminVendorDetail['locks'][number];

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

/** `40-states.md`: sage is settled, gold is waiting on someone, stone is inert. */
const LOCK_PRESENTATION: Record<AdminAvailabilityLockStatus, { label: string; tone: StatusTone }> =
  {
    booked: { label: 'Booked', tone: 'confirmed' },
    pending: { label: 'Pending', tone: 'pending' },
    blocked: { label: 'Blocked', tone: 'inert' },
  };

function HeldBy({ lock }: { lock: Lock }): React.ReactElement {
  if (lock.status === 'blocked') {
    return <>{lock.note ? `Set by vendor · “${lock.note}”` : 'Set by vendor'}</>;
  }

  /*
   * A booked date nothing stands on is the stale lock this card exists to show:
   * the calendar refuses it, and no booking would be lost by freeing it. Red,
   * because the state is wrong rather than waiting.
   */
  if (lock.holders.length === 0) {
    return <span className="text-error-500">No live booking holds this date</span>;
  }

  return (
    <span className="flex flex-col gap-0.5">
      {lock.holders.map((holder) => (
        <span key={holder.id}>
          {holder.kind === 'booking'
            ? `Booking · ${holder.customerName} · ${holder.status}`
            : `Request · ${holder.customerName} · ${
                holder.expiresAt ? `expires ${STAMP.format(holder.expiresAt)} UTC` : holder.status
              }`}
          <span className="block font-mono text-meta text-stone-600">{holder.id}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * `/admin/vendors/[vendorId]`, composed to Pattern B (VEN-380).
 *
 * **Card order is question order**, as the delta's frame draws it: Stripe and
 * payouts, then what they sell, what they show, what their calendar owes, and
 * what the platform told them. Identity and the one Actions card sit right.
 *
 * The two per-item levers — a package's activation and a photo's removal — sit
 * on the item, because the frame draws `Remove` on each image and a package
 * list with its switches moved into the aside would name each one twice.
 */
export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}): Promise<React.ReactElement> {
  const { vendorId } = await params;

  // `params` is untrusted input: an id that cannot name a vendor is a 404, not a 400 page.
  if (!uuidSchema.safeParse(vendorId).success) {
    notFound();
  }

  const detail = await getAdminVendorDetail(vendorId);

  if (!detail) {
    notFound();
  }

  const { vendor, packages, portfolio, locks, notifications } = detail;
  const retired = vendor.status === 'retired';
  const activePackages = packages.filter((pkg) => pkg.isActive).length;
  const rating = displayRating(vendor);
  const place = [vendor.city, vendor.state].filter(Boolean).join(', ');

  return (
    <DetailView
      header={{
        crumb: { label: 'Vendors', href: '/admin/vendors' },
        current: vendor.businessName,
        heading: vendor.businessName,
        pills: (
          <StatusPill tone={VENDOR_STATUS_TONES[vendor.status]}>
            {ADMIN_VENDOR_STATUS_LABELS[vendor.status]}
          </StatusPill>
        ),
        stat: (
          <>
            vendor <span className="font-mono text-helper">{vendor.id}</span> ·{' '}
            {vendor.bookingsCount} {vendor.bookingsCount === 1 ? 'booking' : 'bookings'} · joined{' '}
            {DAY.format(vendor.createdAt)}
          </>
        ),
      }}
      record={
        <>
          <AdminCard
            readOnly
            title="Stripe"
            note={<ScopeChip>Read-only — mirrored from Stripe</ScopeChip>}
          >
            <KeyValueList>
              <KeyValue label="Account" kind={vendor.stripeAccountId ? 'mono' : 'text'}>
                {vendor.stripeAccountId ?? <Absent>Never connected</Absent>}
              </KeyValue>
              <KeyValue label="Onboarded">
                {vendor.stripeOnboarded ? 'Yes · payouts can be sent' : 'No'}
              </KeyValue>
              <KeyValue
                label="Disabled reason"
                kind={vendor.stripeDisabledReason ? 'mono' : 'text'}
              >
                {vendor.stripeDisabledReason ?? <Absent />}
              </KeyValue>
              <KeyValue label="Outstanding">
                {vendor.stripeRequirementsDue.length === 0 ? (
                  <Absent>Nothing due</Absent>
                ) : (
                  <>
                    <span className="text-gold-600">
                      {vendor.stripeRequirementsDue.length}{' '}
                      {vendor.stripeRequirementsDue.length === 1 ? 'requirement' : 'requirements'}{' '}
                      due
                    </span>
                    <span className="mt-1 flex flex-col gap-0.5 font-mono text-meta">
                      {vendor.stripeRequirementsDue.map((requirement) => (
                        <span key={requirement}>{requirement}</span>
                      ))}
                    </span>
                  </>
                )}
              </KeyValue>
              <KeyValue label="Payouts">
                {vendor.payoutHold ? (
                  <span className="text-gold-600">Held by an operator</span>
                ) : (
                  'Released by the sweep'
                )}
              </KeyValue>
            </KeyValueList>
          </AdminCard>

          <AdminCard
            title={`Packages · ${packages.length}`}
            note={<span className="text-stone-600">{activePackages} active</span>}
          >
            {packages.length === 0 ? (
              <CardEmpty>No packages yet. Customers can still request a custom quote.</CardEmpty>
            ) : (
              <CardTable
                label="Packages"
                rows={packages}
                rowKey={(pkg) => pkg.id}
                muted={(pkg) => !pkg.isActive}
                columns={[
                  { key: 'name', header: 'Name', width: 'minmax(0,1fr)', cell: (pkg) => pkg.name },
                  {
                    key: 'price',
                    header: 'Price',
                    width: '150px',
                    align: 'end',
                    cell: (pkg) => (
                      <span className="font-mono text-meta">
                        {formatPrice(pkg.priceCents)}
                        <span className="block font-sans text-helper text-stone-600">
                          {PRICE_TYPE_LABELS[pkg.priceType]}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: 'active',
                    header: 'Active',
                    width: '90px',
                    align: 'end',
                    cell: (pkg) =>
                      pkg.moderationHold ? (
                        <StatusPill tone="needsYou">Held</StatusPill>
                      ) : (
                        <StatusPill tone={pkg.isActive ? 'confirmed' : 'inert'}>
                          {pkg.isActive ? 'Yes' : 'No'}
                        </StatusPill>
                      ),
                  },
                  ...(retired
                    ? []
                    : [
                        {
                          key: 'lever',
                          header: '',
                          width: '104px',
                          align: 'end' as const,
                          cell: (pkg: (typeof packages)[number]) => (
                            <PackageActiveControl pkg={pkg} businessName={vendor.businessName} />
                          ),
                        },
                      ]),
                ]}
              />
            )}
          </AdminCard>

          <AdminCard
            title={`Portfolio · ${portfolio.length} ${portfolio.length === 1 ? 'image' : 'images'}`}
            note={<span className="text-stone-600">Cover first · remove is per-image</span>}
          >
            {portfolio.length === 0 ? (
              <CardEmpty>No photos yet.</CardEmpty>
            ) : (
              <ul aria-label="Portfolio photos" className="flex gap-2 overflow-x-auto px-4 py-3">
                {portfolio.map((item, index) => (
                  <li key={item.id} className="relative h-[63px] w-[104px] shrink-0">
                    <FallbackImage
                      src={item.thumbnailUrl ?? item.imageUrl}
                      alt={item.caption ?? `Portfolio photo ${index + 1}`}
                      className="h-full w-full overflow-hidden rounded-lg"
                      imageClassName="h-full w-full bg-stone-200 object-cover"
                      fallbackClassName="h-full w-full"
                    />
                    {index === 0 ? (
                      <span className="absolute top-1.5 left-1.5 rounded-[4px] bg-stone-900/60 px-1.5 py-0.5 text-[9px] font-bold tracking-label text-stone-0 uppercase">
                        Cover
                      </span>
                    ) : null}
                    {retired ? null : <PortfolioRemoveControl item={item} position={index + 1} />}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard
            readOnly
            title={`Availability locks · ${locks.length}`}
            note={<span className="text-stone-600">What holds each date</span>}
          >
            {locks.length === 0 ? (
              <CardEmpty>
                No dates are held from yesterday through the calendar’s horizon.
              </CardEmpty>
            ) : (
              <CardTable
                label="Availability locks"
                rows={locks}
                rowKey={(lock) => lock.date}
                columns={[
                  {
                    key: 'date',
                    header: 'Date',
                    width: '140px',
                    cell: (lock) => (
                      <span className="font-mono text-meta">{formatEventDate(lock.date)}</span>
                    ),
                  },
                  {
                    key: 'hold',
                    header: 'Hold',
                    width: '1fr',
                    cell: (lock) => (
                      <StatusPill tone={LOCK_PRESENTATION[lock.status].tone}>
                        {LOCK_PRESENTATION[lock.status].label}
                      </StatusPill>
                    ),
                  },
                  {
                    key: 'holder',
                    header: 'Held by',
                    width: '1.6fr',
                    cell: (lock) => <HeldBy lock={lock} />,
                  },
                ]}
              />
            )}
          </AdminCard>

          <AdminCard
            readOnly
            title={`Notifications sent · ${notifications.total}`}
            note={
              <span className="text-stone-600">
                {notifications.unread} unread
                {notifications.total > notifications.items.length
                  ? ` · latest ${notifications.items.length} shown`
                  : ''}
              </span>
            }
          >
            {notifications.items.length === 0 ? (
              <CardEmpty>Nothing has been sent to this vendor.</CardEmpty>
            ) : (
              <CardTable
                label="Notifications sent"
                rows={notifications.items}
                rowKey={(item) => item.id}
                columns={[
                  {
                    key: 'sent',
                    header: 'Sent',
                    width: '160px',
                    cell: (item) => (
                      <span className="font-mono text-meta">
                        {STAMP.format(item.createdAt)} UTC
                      </span>
                    ),
                  },
                  {
                    key: 'title',
                    header: 'Notification',
                    width: 'minmax(0,1fr)',
                    cell: (item) => (
                      <>
                        {item.title}
                        <span className="block font-mono text-helper text-stone-600">
                          {item.type}
                        </span>
                      </>
                    ),
                  },
                  {
                    key: 'read',
                    header: 'Read',
                    width: '90px',
                    align: 'end',
                    cell: (item) =>
                      item.readAt ? (
                        <StatusPill tone="quoted">Read</StatusPill>
                      ) : (
                        <StatusPill tone="inert">Unread</StatusPill>
                      ),
                  },
                ]}
              />
            )}
          </AdminCard>
        </>
      }
      aside={
        <>
          <IdentityCard
            name={vendor.businessName}
            subtitle={[vendor.categoryName, place].filter(Boolean).join(' · ') || <Absent />}
            fields={[
              { label: 'Contact', value: vendor.email },
              { label: 'Owner', value: vendor.ownerName },
              { label: 'Account', value: vendor.userId, mono: true },
              { label: 'Slug', value: vendor.slug, mono: true },
              { label: 'Joined', value: DAY.format(vendor.createdAt) },
              {
                label: 'Rating',
                value: rating
                  ? `${rating} · ${vendor.reviewCount} ${vendor.reviewCount === 1 ? 'review' : 'reviews'}`
                  : 'No reviews yet',
              },
              {
                label: 'Replies',
                value:
                  vendor.responseTimeHours === null ? (
                    <Absent />
                  ) : (
                    `Within ${vendor.responseTimeHours} ${vendor.responseTimeHours === 1 ? 'hour' : 'hours'}`
                  ),
              },
              {
                label: 'Radius',
                value:
                  vendor.serviceRadiusKm === null ? (
                    <Absent />
                  ) : (
                    `${vendor.serviceRadiusKm} km${vendor.travelsBeyondRadius ? ' · travels beyond' : ''}`
                  ),
              },
            ]}
          />

          <AdminCard title="Actions">
            <VendorDetailActions vendor={vendor} />
          </AdminCard>

          <p className="rounded-panel bg-steel-50 px-3.5 py-3 text-helper leading-[1.55] text-steel-600">
            <strong className="font-semibold">Every state change is logged.</strong> Actor, action
            and this vendor&apos;s id land in Activity.
          </p>
        </>
      }
    />
  );
}
