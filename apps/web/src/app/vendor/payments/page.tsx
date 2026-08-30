import { BRAND_NAME, pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Banner } from '@/components/ui/banner';
import { VendorSurface } from '@/components/vendor-surface';
import { ConnectPayoutsForm } from '@/components/vendor/connect-payouts-form';
import { requireRole } from '@/lib/current-user';
import { getPayoutStatus } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Payments') };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

/** Payout state changes underneath this page via webhook; never serve it stale. */
export const dynamic = 'force-dynamic';

interface VendorPaymentsPageProps {
  searchParams: Promise<{ resume?: string }>;
}

export default async function VendorPaymentsPage({
  searchParams,
}: VendorPaymentsPageProps): Promise<React.ReactElement> {
  /*
   * All three are independent, so they go out together rather than in a chain.
   * There is deliberately no separate profile read: `/vendor/stripe/status`
   * answers 404 when there is no vendor profile, which `getPayoutStatus` maps to
   * `null` — so the redirect below is the same guard the other vendor surfaces
   * make with a second round trip.
   */
  const [, status, params] = await Promise.all([
    requireRole('vendor'),
    getPayoutStatus(),
    searchParams,
  ]);

  if (!status) {
    redirect(PROFILE_EDIT_PATH);
  }

  const hasStarted = Boolean(status.stripeAccountId);
  // Stripe sends the vendor here when the link it gave them expired or was
  // already used. Saying so is the difference between "this is broken" and
  // "press it again": the link ran out, not the setup.
  const linkExpired = params.resume === '1';

  return (
    <VendorSurface
      eyebrow="Payments"
      heading={status.stripeOnboarded ? 'Payouts connected' : 'Get paid for your bookings'}
      description={
        status.stripeOnboarded
          ? `${BRAND_NAME} takes payment from the customer and passes it to you through Stripe.`
          : `${BRAND_NAME} takes payment from the customer and passes it to you through Stripe. Connecting your bank account is what lets you accept a booking.`
      }
    >
      <div className="max-w-[620px]">
        {status.stripeOnboarded ? (
          <Banner status="settled" title="Payouts connected">
            Stripe holds each payment until the event is complete, then pays it out to you. There is
            nothing else to do here.
          </Banner>
        ) : (
          <>
            {/*
              One banner, which is the component's own contract — and on the
              `?resume=1` path the expired link is the newer, more specific
              thing to say, so it takes the slot rather than stacking above the
              gate. Steel there because nothing failed and nothing is waiting on
              the vendor except pressing the button again; gold otherwise,
              because the setup is waiting on them. Never red: `40-states.md`.
            */}
            {linkExpired ? (
              <Banner status="informational" title="That link had expired">
                Stripe links only last a few minutes. Start again and you will pick up where you
                left off.
              </Banner>
            ) : (
              <Banner status="pending" title="Payouts not connected">
                You can&rsquo;t take payment until payouts are connected. It takes about five
                minutes.
              </Banner>
            )}

            <div className="mt-6">
              <ConnectPayoutsForm isResuming={hasStarted} />
            </div>

            <p className="mt-3.5 text-sm leading-prose text-stone-600">
              Stripe asks for your bank details and enough identification to pay you legally.{' '}
              {BRAND_NAME} never sees them.
            </p>
          </>
        )}
      </div>
    </VendorSurface>
  );
}
