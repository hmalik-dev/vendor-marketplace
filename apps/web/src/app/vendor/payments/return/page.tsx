import { pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { requireRole } from '@/lib/current-user';
import { getOwnVendorProfile, getPayoutStatus } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Payments') };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';
const PAYMENTS_PATH = '/vendor/payments';
const DASHBOARD_PATH = '/vendor/dashboard';

/** The whole point of this page is to read state that just changed. */
export const dynamic = 'force-dynamic';

/**
 * Where Stripe returns the vendor after hosted onboarding.
 *
 * Returning here proves only that they left Stripe's form, never that they
 * finished it, and the webhook that settles the question races the redirect.
 * So this page reads the flag once and answers honestly in both directions —
 * it does not poll, and it does not claim success it cannot see.
 */
export default async function VendorPaymentsReturnPage(): Promise<React.ReactElement> {
  await requireRole('vendor');

  const profile = await getOwnVendorProfile();
  if (!profile) {
    redirect(PROFILE_EDIT_PATH);
  }

  const status = await getPayoutStatus();

  if (status?.stripeOnboarded) {
    return (
      <div className="w-full max-w-[620px] px-4 pt-5.5 pb-12 sm:px-6 lg:px-0 lg:pl-6">
        <h1 className="text-display-sm text-stone-900">You&rsquo;re set up</h1>
        <p className="mt-2.5 text-base leading-prose text-stone-700">
          Payouts are connected, so you can accept bookings now. Stripe holds each payment until
          the event is complete, then pays it out to you.
        </p>
        <Banner status="settled" title="Payouts connected" className="mt-5">
          Nothing else to do here. Your next booking can be accepted straight from the dashboard.
        </Banner>
        <div className="mt-6">
          <Button asChild variant="primary" size="lg">
            <Link href={DASHBOARD_PATH}>Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[620px] px-4 pt-5.5 pb-12 sm:px-6 lg:px-0 lg:pl-6">
      <h1 className="text-display-sm text-stone-900">Stripe is still checking</h1>
      <p className="mt-2.5 text-base leading-prose text-stone-700">
        Stripe has your details and is verifying them. This usually takes a minute or two, and
        sometimes longer if a document needs a look.
      </p>
      {/*
        Steel, not red: nothing failed. `40-states.md` reserves red for a
        failure and gold for something waiting on the vendor — this is waiting
        on Stripe, and there is no action to take.
      */}
      <Banner status="informational" title="Nothing is wrong" className="mt-5">
        You don&rsquo;t need to do anything. Refresh this page in a minute, or carry on and check
        back from the dashboard.
      </Banner>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button asChild variant="secondary" size="lg">
          <Link href={PAYMENTS_PATH}>Check again</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={DASHBOARD_PATH}>Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
