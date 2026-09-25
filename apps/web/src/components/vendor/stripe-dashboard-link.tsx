'use client';

import { stripeOnboardingLinkSchema } from '@vendor-marketplace/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';

/**
 * Opens the vendor's Stripe Express dashboard, where payouts and tax forms
 * live (VEN-725). A button that reads as a link: the destination is a
 * single-use link the API mints on the click, so it cannot be rendered into
 * the markup. The failure sentence is the same one the connect button uses.
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
  const [failed, setFailed] = useState(false);

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
    setFailed(false);
    setIsOpening(true);

    try {
      const { url } = await request('/vendor/stripe/dashboard-link', {
        method: 'POST',
        schema: stripeOnboardingLinkSchema,
      });

      window.location.assign(url);
    } catch {
      setFailed(true);
      setIsOpening(false);
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" loading={isOpening} onClick={open}>
        {isOpening ? 'Opening Stripe…' : label}
      </Button>
      {failed ? (
        <span role="alert" className="block text-sm text-error-500">
          We could not reach Stripe. Try again.
        </span>
      ) : null}
    </>
  );
}
