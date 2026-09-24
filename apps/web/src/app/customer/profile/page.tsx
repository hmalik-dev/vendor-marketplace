import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BUDGET_TIER_LABELS,
  completionRate,
  pageTitle,
  type BudgetTier,
} from '@vendor-marketplace/shared';
import { BookingsSidebar } from '@/components/bookings/bookings-sidebar';
import { getOwnConversationBand } from '@/lib/messaging-data';
import { CustomerHistory, CustomerReviews } from '@/components/customer/customer-history';
import { CustomerProfileForm } from '@/components/customer/customer-profile-form';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toEntries } from '@/lib/booking-entries';
import { getOwnBookingRequests, getOwnBookings, getOwnCustomerReviews } from '@/lib/customer-data';
import { requireRole } from '@/lib/current-user';
import { isNavigationSignal } from '@/lib/navigation-signal';
import { reportSwallowedError } from '@/lib/report-error';

export const metadata: Metadata = {
  title: pageTitle('Your profile'),
  robots: { index: false, follow: false },
};

const TABS = ['profile', 'active', 'past', 'reviews'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  profile: 'Profile',
  active: 'Active',
  past: 'Past',
  reviews: 'Reviews about you',
};

function isTab(value: string | undefined): value is Tab {
  return (TABS as readonly string[]).includes(value ?? '');
}

/**
 * A required read that reports failure as `null`. The history tabs draw an error
 * with a retry for it, never the empty state: a customer with a paid booking must
 * not read that it is gone. 401 and `TERMS_REQUIRED` redirect inside the read, and
 * those signals pass through untouched.
 */
async function readOrNull<T>(context: string, read: () => Promise<T[]>): Promise<T[] | null> {
  try {
    return await read();
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }
    reportSwallowedError(`customer profile: loading ${context} failed`, error);

    return null;
  }
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

/**
 * The customer's own profile, history and reviews.
 *
 * `/bookings` and the bookings hub are **#22b**, deliberately not built here —
 * this page owns the customer record and the history *data*, and the hub will
 * mount the same pieces in its sidebar when it lands.
 *
 * The tab lives in `?tab=` rather than component state so it is linkable and
 * survives a reload, matching how the vendor profile does it.
 */
export default async function CustomerProfilePage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const [user, query] = await Promise.all([requireRole('customer'), searchParams]);
  const tab: Tab = isTab(query.tab) ? query.tab : 'profile';

  const [requests, bookings, reviews, band] = await Promise.all([
    readOrNull('booking requests', () => getOwnBookingRequests({ required: true })),
    readOrNull('bookings', () => getOwnBookings({ required: true })),
    readOrNull('reviews', () => getOwnCustomerReviews({ required: true })),
    /*
      For the sidebar's unread dot, which is shared with `/bookings` and must not
      say different things on the two pages that draw it. `getOwnConversationBand`
      fails soft to an empty band, so an unreachable messaging API costs the dot rather
      than this page.
    */
    getOwnConversationBand(),
  ]);

  /*
   * The hub's own count, from the hub's own flattening — not `requests.length +
   * bookings.length`. Every accepted request that was paid for exists in *both*
   * lists, so the sum double-counted it: the badge read 9 here and 7 on
   * `/bookings`, in the one navigation element the two pages share. `toEntries`
   * is what drops the paid request in favour of its booking, and it is the only
   * place that rule may live.
   */
  const bookingCount =
    requests === null || bookings === null ? null : toEntries(requests, bookings).length;

  const settledRate = completionRate(user.completedBookingsCount, user.cancelledBookingsCount);
  const budget = user.budgetTier ? BUDGET_TIER_LABELS[user.budgetTier as BudgetTier] : null;
  const isNewMember = user.totalBookingsCount === 0;
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  return (
    /*
      The same shell as `/bookings`, so the sidebar's own "My profile" link
      does not navigate the sidebar away from under the reader.
    */
    <div className="flex min-h-[calc(100dvh-var(--header-height))]">
      <BookingsSidebar
        bookingCount={bookingCount}
        hasUnreadMessages={band.hasUnread}
        current="profile"
      />
      <div className="min-w-0 flex-1 px-6 pt-6.5 pb-12 xl:px-10">
        <div className="flex items-center gap-4">
          {/* Initials from a full name only, the header's rule: a placeholder first name alone is not the person's. */}
          <Avatar name={user.lastName.trim() ? fullName : ''} src={user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-[33px] leading-[1.1] text-stone-900">
              {user.firstName ? fullName : 'Your profile'}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-stone-700">
              {/*
              A customer with nothing booked gets a badge rather than a row of
              zeroes: "0 events, 0% completed" reads as a bad record instead of
              an absent one.
            */}
              {isNewMember ? (
                <span className="rounded-md bg-stone-150 px-2.5 py-1 text-xs font-semibold text-stone-700">
                  New member
                </span>
              ) : (
                <>
                  <span>
                    {user.totalBookingsCount}{' '}
                    {user.totalBookingsCount === 1 ? 'booking' : 'bookings'}
                  </span>
                  {settledRate === null ? null : (
                    <span>{Math.round(settledRate * 100)}% completed</span>
                  )}
                </>
              )}
              {budget ? (
                <span title={budget.range}>
                  {budget.glyph} · {budget.label}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <nav aria-label="Profile sections" className="mt-6 border-b border-stone-300">
          <ul className="flex gap-1">
            {TABS.map((name) => (
              <li key={name}>
                <Link
                  href={`/customer/profile?tab=${name}`}
                  aria-current={name === tab ? 'page' : undefined}
                  className={cn(
                    'inline-block border-b-2 px-3.5 py-2.5 text-base font-medium transition-colors',
                    name === tab
                      ? 'border-clay-400 font-semibold text-stone-900'
                      : 'border-transparent text-stone-600 hover:text-stone-900',
                  )}
                >
                  {TAB_LABELS[name]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="pt-6">
          {tab === 'profile' ? <CustomerProfileForm user={user} /> : null}
          {tab === 'active' ? (
            <CustomerHistory requests={requests} bookings={bookings} scope="active" />
          ) : null}
          {tab === 'past' ? (
            <CustomerHistory requests={requests} bookings={bookings} scope="past" />
          ) : null}
          {tab === 'reviews' ? <CustomerReviews reviews={reviews} /> : null}
        </div>
      </div>
    </div>
  );
}
