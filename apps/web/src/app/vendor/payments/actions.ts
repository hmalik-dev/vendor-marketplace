'use server';

import { redirect } from 'next/navigation';
import { startPayoutOnboarding } from '@/lib/vendor-data';
import { isNavigationSignal } from '@/lib/navigation-signal';

/**
 * Sends the vendor into Stripe's hosted onboarding.
 *
 * A Server Action rather than a client fetch, so the Clerk token stays on the
 * server: the browser only ever sees the redirect. The link is minted on every
 * submit because Stripe expires one five minutes after issuing it and refuses a
 * second visit, so there is nothing here worth caching.
 */
export async function connectPayoutsAction(): Promise<{ error: string } | never> {
  let url: string;

  try {
    ({ url } = await startPayoutOnboarding());
  } catch (error) {
    // `redirect` signals by throwing, so a session redirect must not be caught
    // and reported as a failure the vendor can retry.
    if (isNavigationSignal(error)) {
      throw error;
    }

    return {
      error: 'We could not reach Stripe just then. Nothing has changed — try again.',
    };
  }

  redirect(url);
}
