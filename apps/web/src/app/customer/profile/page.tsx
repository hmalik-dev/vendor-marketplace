import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BUDGET_TIER_LABELS,
  completionRate,
  pageTitle,
  type BudgetTier,
} from '@vendor-marketplace/shared';
import { CustomerReviews } from '@/components/customer/customer-history';
import { CustomerProfileForm } from '@/components/customer/customer-profile-form';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getOwnCustomerReviews } from '@/lib/customer-data';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Your profile'),
  robots: { index: false, follow: false },
};

const TABS = ['profile', 'reviews'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  profile: 'Profile',
  reviews: 'Reviews about you',
};

function isTab(value: string | undefined): value is Tab {
  return (TABS as readonly string[]).includes(value ?? '');
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

/**
 * The customer's own profile, history and reviews.
 *
 * Bookings live on `/bookings`; this page owns the customer record and the
 * reviews about them, so it has no booking tabs of its own (VEN-706).
 *
 * The tab lives in `?tab=` rather than component state so it is linkable and
 * survives a reload, matching how the vendor profile does it.
 */
export default async function CustomerProfilePage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const [user, query] = await Promise.all([requireRole('customer'), searchParams]);
  const tab: Tab = isTab(query.tab) ? query.tab : 'profile';

  const reviews = await getOwnCustomerReviews();

  const settledRate = completionRate(user.completedBookingsCount, user.cancelledBookingsCount);
  const budget = user.budgetTier ? BUDGET_TIER_LABELS[user.budgetTier as BudgetTier] : null;
  const isNewMember = user.totalBookingsCount === 0;
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <div className="flex min-h-[calc(100dvh-var(--header-height))]">
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
          {tab === 'reviews' ? <CustomerReviews reviews={reviews} /> : null}
        </div>
      </div>
    </div>
  );
}
