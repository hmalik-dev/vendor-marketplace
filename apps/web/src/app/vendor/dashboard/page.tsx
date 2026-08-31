import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VENDOR_PAYMENTS_PATH, pageTitle, todayDateString } from '@vendor-marketplace/shared';
import { DashboardStats } from '@/components/vendor/dashboard-stats';
import { PublishChecklist } from '@/components/vendor/publish-checklist';
import { PublishedRail } from '@/components/vendor/published-rail';
import { RequestRow } from '@/components/vendor/request-row';
import { EmptyState, EmptyStateGlyph } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getOwnBookingRequests } from '@/lib/vendor-requests';
import { Banner } from '@/components/ui/banner';
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

  /*
    The working surface, hoisted so the published and unpublished compositions
    can place it differently without the list being written twice.
  */
  const requestsPane =
    waiting.length === 0 ? (
      <EmptyState
        /*
          Frame `20` draws the pane as a panel that fills the column — a dashed
          hairline at an 18px radius — rather than leaving the space blank below
          a top-aligned sentence.
        */
        panel
        icon={<EmptyStateGlyph />}
        headline={dashboard.isPublished ? 'No requests right now' : 'Nobody can find you yet'}
        /*
          Frame `20`: an empty request list is almost always an unpublished
          profile, so the state names that cause and the CTA fixes it — rather
          than shrugging at the vendor.
        */
        description={
          dashboard.isPublished
            ? 'Requests land here the moment a customer sends one. Keeping your calendar current is what puts you in their search.'
            : 'Your profile is not published, so it does not appear in search. Finish the checklist and requests can start arriving.'
        }
        action={
          dashboard.isPublished ? null : (
            /*
              `.btnS` on frame `20`, not the clay fill: the pane is a waiting
              state, not the one action the screen exists for.
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
    );

  return (
    <div className="app-shell flex">
      {/*
        The gutter is a ladder, not a constant. It was a flat `px-6` — the 1440
        value at every width — where frame `27 Vendor dashboard — 1024` draws
        `padding: 18px 22px` and frame `08` draws `22px 24px`. The steps below
        1024 follow the shared ladder #304 established on the marketing chrome,
        so the vendor pane widens with the header rather than against it.
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-5 lg:px-5.5 lg:pt-4.5 min-[90rem]:px-6 min-[90rem]:pt-5.5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          {/*
            21px at 1024, 26px at 1440 — frame `27 Vendor dashboard — 1024`
            steps the greeting down where the pane loses 220px to the sidebar
            and 300px to the right column.
          */}
          <h1 className="display-heading text-[21px] text-stone-900 min-[90rem]:text-[26px]">
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

        {/*
          The payout gate. Gold rather than red because nothing has failed —
          `40-states.md` reserves red for a failure and gold for work waiting on
          the vendor — and the sentence is the approved one from
          `31-content-voice.md`. It disappears the moment Stripe reports both
          capabilities active, so a set-up vendor never sees it. The flag rides
          on the dashboard payload rather than a second request, beside
          `publishBlockers`, which is the same class of state.
        */}
        {dashboard.stripeOnboarded ? null : (
          <Banner status="pending" title="Payouts not connected" className="mb-4">
            You can&rsquo;t take payment until payouts are connected. It takes about five minutes.{' '}
            <Link
              href={VENDOR_PAYMENTS_PATH}
              className="font-semibold text-clay-500 hover:underline"
            >
              Set up payouts &rarr;
            </Link>
          </Banner>
        )}

        <DashboardStats dashboard={dashboard} today={today} />

        {/*
          Two headings, one at a time. Frame `08` writes the serif
          `Requests waiting on you`; frame `27 Vendor dashboard — 1024` replaces
          it with a `Needs you` micro-label, because at 1024 the column is 394px
          and a 21px serif line over three request cards is most of what fits.
          Exactly one of the spans is rendered at any width, so a screen reader
          announces one heading.
        */}
        <h2 className="mb-2.5">
          <span className="text-label font-semibold tracking-label text-stone-600 uppercase min-[90rem]:hidden">
            Needs you
          </span>
          <span className="hidden font-display text-[21px] text-stone-900 min-[90rem]:inline">
            Requests waiting on you
          </span>
        </h2>

        {/*
          The requests column and, once the profile is live, the right column
          beside it. Frame `27` puts that column **inside** the pane at a 16px
          gap; frame `08`'s bordered outer rail is the unpublished composition
          and is rendered outside this pane instead.
        */}
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-5">{requestsPane}</div>
          {dashboard.isPublished ? <PublishedRail dashboard={dashboard} /> : null}
        </div>
      </div>

      {dashboard.isPublished ? null : <PublishChecklist dashboard={dashboard} />}
    </div>
  );
}
