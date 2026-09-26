'use client';

import { stripeOnboardingLinkSchema, SUPPORT_PATH } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';

/** A transient failure is worth a retry; a 409 is Stripe refusing this account, which a retry cannot change (VEN-782). */
type Failure = 'transient' | 'refused';

/**
 * Opens where the vendor manages their payout account on Stripe: the Express
 * dashboard, where payouts and tax forms live (VEN-725), or Stripe's hosted
 * update form for an account without one (VEN-782). A button that reads as a
 * link: the destination is a single-use link the API mints on the click, so it
 * cannot be rendered into the markup. The transient failure sentence is the
 * same one the connect button uses.
 */
export interface StripeDashboardLinkProps {
  /** What the control reads at rest; frame `49`'s account card says `Manage in Stripe`. */
  label?: string;
}

export function StripeDashboardLink({
  label = 'Open your Stripe dashboard',
}: StripeDashboardLinkProps = {}): React.ReactElement {
  const request = useApi();
  const [isOpening, setIsOpening] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  // Back from Stripe restores the page frozen, still busy: `pageshow` is the signal.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent): void {
      if (event.persisted) {
        setIsOpening(false);
      }
    }

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  async function open(): Promise<void> {
    setFailure(null);
    setIsOpening(true);

    try {
      const { url } = await request('/vendor/stripe/dashboard-link', {
        method: 'POST',
        schema: stripeOnboardingLinkSchema,
      });

      window.location.assign(url);
    } catch (error) {
      setFailure(
        error instanceof ApiClientError && error.statusCode === 409 ? 'refused' : 'transient',
      );
      setIsOpening(false);
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" loading={isOpening} onClick={open}>
        {isOpening ? 'Opening Stripe…' : label}
      </Button>
      {failure === 'transient' ? (
        <span role="alert" className="block text-sm text-error-500">
          We could not reach Stripe. Try again.
        </span>
      ) : null}
      {failure === 'refused' ? (
        <span role="alert" className="block text-sm text-error-500">
          Stripe cannot open this payout account.{' '}
          <Link href={SUPPORT_PATH} className="underline">
            Contact support
          </Link>{' '}
          to change your payout details.
        </span>
      ) : null}
    </>
  );
}
