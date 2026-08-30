import { VENDOR_PAYMENTS_PATH, pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { VendorSurface } from '@/components/vendor-surface';
import { requireRole } from '@/lib/current-user';
import { getPayoutStatus } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Payments') };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';
const DASHBOARD_PATH = '/vendor/dashboard';

/** The whole point of this page is to read state that just changed. */
export const dynamic = 'force-dynamic';

/**
 * Where Stripe returns the vendor after hosted onboarding.
 *
 * Returning here proves only that they left Stripe's form, never that they
 * finished it, and the webhook that settles the question races the redirect. So
 * this page reads the flag once and answers honestly in both directions — it
 * does not poll, and it does not claim a success it cannot see.
 */
export default async function VendorPaymentsReturnPage(): Promise<React.ReactElement> {
  const [, status] = await Promise.all([requireRole('vendor'), getPayoutStatus()]);

  if (!status) {
    redirect(PROFILE_EDIT_PATH);
  }

  const isOnboarded = status.stripeOnboarded;

  return (
    <VendorSurface
      eyebrow="Payments"
      heading={isOnboarded ? 'You’re set up' : 'Stripe is still checking'}
      description={
        isOnboarded
          ? 'Payouts are connected, so you can accept bookings now. Stripe holds each payment until the event is complete, then pays it out to you.'
          : 'Stripe has your details and is verifying them. This usually takes a minute or two, and sometimes longer if a document needs a look.'
      }
    >
      <div className="max-w-[620px]">
        {isOnboarded ? (
          <Banner status="settled" title="Payouts connected">
            Nothing else to do here. Your next booking can be accepted straight from the dashboard.
          </Banner>
        ) : (
          /*
            Steel, not red: nothing failed. `40-states.md` reserves red for a
            failure and gold for something waiting on the vendor — this is
            waiting on Stripe, and there is no action to take.
          */
          <Banner status="informational" title="Nothing is wrong">
            You don&rsquo;t need to do anything. Check again in a minute, or carry on and come back
            from the dashboard.
          </Banner>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {isOnboarded ? (
            <Button asChild variant="primary" size="lg">
              <Link href={DASHBOARD_PATH}>Back to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="secondary" size="lg">
                <Link href={VENDOR_PAYMENTS_PATH}>Check again</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={DASHBOARD_PATH}>Back to dashboard</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </VendorSurface>
  );
}
