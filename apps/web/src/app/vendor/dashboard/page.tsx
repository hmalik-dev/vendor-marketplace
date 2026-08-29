import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pageTitle, todayDateString } from '@vendor-marketplace/shared';
import { DashboardStats } from '@/components/vendor/dashboard-stats';
import { PublishChecklist } from '@/components/vendor/publish-checklist';
import { RequestRow } from '@/components/vendor/request-row';
import { EmptyState, EmptyStateGlyph } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getOwnBookingRequests } from '@/lib/vendor-requests';
import { getOwnVendorProfile, getVendorDashboard } from '@/lib/vendor-data';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Your business'),
  robots: { index: false, follow: false },
};

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

/**
 * Frame `08` — every incoming request, actionable without navigating away.
 *
 * **The title states the number**, because the count is what drives the
 * vendor's next action. Frame `08` also renders a median reply time beside it;
 * that is the one deliberate deviation from this frame and it is recorded in
 * `16-vendor-dashboard.md` and `98-post-mvp.md`. The median needs message
 * history a new vendor does not have, so on their own dashboard it could only
 * be invented, and "keep it under 4h to stay ranked" promises a ranking signal
 * that does not exist. Nothing replaces it.
 */
export default async function VendorDashboardPage(): Promise<React.ReactElement> {
  const [user, profile] = await Promise.all([requireRole('vendor'), getOwnVendorProfile()]);

  // A vendor with no profile has nothing to manage, so sign-up leads straight
  // into creating one rather than to an empty dashboard.
  if (!profile) {
    redirect(PROFILE_EDIT_PATH);
  }

  const [dashboard, requests] = await Promise.all([getVendorDashboard(), getOwnBookingRequests()]);

  if (!dashboard) {
    redirect(PROFILE_EDIT_PATH);
  }

  const today = todayDateString();
  /*
   * One query behind both the title and the list, so the number in the heading
   * and the number of rows can never disagree — the count is derived from the
   * rows themselves rather than fetched separately.
   */
  const waiting = requests.filter((request) => request.status === 'pending');
  /*
   * The person's name, not the business's — frame `08` greets "Maya", and a
   * dashboard that addresses a vendor by their trading name reads like a
   * mailshot. Falls back to the business when the account has no name, which
   * Clerk's email sign-up genuinely allows.
   */
  const greeting = user.firstName.trim() || profile.businessName;

  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-5.5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="display-heading text-[26px] text-stone-900">
            {waiting.length === 0
              ? `${greeting}, nothing is waiting on you`
              : `${greeting}, you have ${waiting.length} new ${
                  waiting.length === 1 ? 'request' : 'requests'
                }`}
          </h1>
          <Link
            href={`/vendors/${profile.slug}`}
            className="text-sm font-semibold text-clay-500 hover:underline"
          >
            View my public profile
          </Link>
        </div>

        <DashboardStats dashboard={dashboard} today={today} />

        <h2 className="mb-2.5 font-display text-[21px] text-stone-900">Requests waiting on you</h2>

        <div className="min-h-0 flex-1 overflow-y-auto pb-5">
          {waiting.length === 0 ? (
            <EmptyState
              /*
                Frame `20` draws the pane as a panel that fills the column —
                a dashed hairline at an 18px radius — rather than leaving the
                space blank below a top-aligned sentence.
              */
              panel
              icon={<EmptyStateGlyph />}
              headline={dashboard.isPublished ? 'No requests right now' : 'Nobody can find you yet'}
              /*
                Frame `20`: an empty request list is almost always an
                unpublished profile, so the state names that cause and the CTA
                fixes it — rather than shrugging at the vendor.
              */
              description={
                dashboard.isPublished
                  ? 'Requests land here the moment a customer sends one. Keeping your calendar current is what puts you in their search.'
                  : 'Your profile is not published, so it does not appear in search. Finish the checklist and requests can start arriving.'
              }
              action={
                dashboard.isPublished ? null : (
                  /*
                    `.btnS` on frame `20`, not the clay fill: the pane is a
                    waiting state, not the one action the screen exists for.
                  */
                  <Button asChild variant="secondary">
                    <Link href={PROFILE_EDIT_PATH}>Finish your profile</Link>
                  </Button>
                )
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {waiting.map((request, index) => (
                <RequestRow key={request.id} request={request} isFirst={index === 0} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <PublishChecklist dashboard={dashboard} today={today} />
    </div>
  );
}
