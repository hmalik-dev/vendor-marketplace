import { isLiveStripeKey } from '@vendor-marketplace/shared/env';
import { AdminCard } from './admin-detail';

export const STRIPE_DASHBOARD_COPY =
  'Refunds, credits and fee changes not offered here are made in Stripe. A refund made there shows here and holds the payout. Nothing else made there shows up here.';

/**
 * The payment's page in the Stripe Dashboard, in the mode the web's own key is
 * in. The key's prefix decides it, as it does for the checkout's test strip: a
 * live key is only accepted beside `DEPLOY_ENV=production` (`assertWebEnv`), so
 * every other environment opens the test-mode Dashboard.
 */
export function stripeDashboardPaymentUrl(
  paymentIntentId: string,
  publishableKey: string | undefined,
): string {
  const mode = publishableKey && isLiveStripeKey(publishableKey) ? '' : 'test/';

  return `https://dashboard.stripe.com/${mode}payments/${encodeURIComponent(paymentIntentId)}`;
}

/**
 * D42: the console moves no money outside its own levers, so a refund, credit
 * or fee change it does not offer is made in Stripe (VEN-601). Only a refund
 * comes back, through `charge.refunded` (VEN-469); nothing else is reconciled.
 * A link, so it sits in its own card and never inside a read-only one
 * (Pattern B rule 4).
 */
export function StripeDashboardCard({
  paymentIntentId,
}: {
  paymentIntentId: string;
}): React.ReactElement {
  return (
    <AdminCard title="Stripe">
      <div className="px-4 py-3 text-sm">
        <a
          href={stripeDashboardPaymentUrl(
            paymentIntentId,
            process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="text-clay-600 hover:underline"
        >
          Open the payment in the Stripe Dashboard
        </a>
        <p className="mt-2 text-helper leading-prose text-stone-600">{STRIPE_DASHBOARD_COPY}</p>
      </div>
    </AdminCard>
  );
}
