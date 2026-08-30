'use client';

import { stripeOnboardingLinkSchema } from '@vendor-marketplace/shared';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';

interface ConnectPayoutsFormProps {
  /** True once the vendor has an account but has not finished onboarding. */
  isResuming: boolean;
}

/**
 * The one control on the payments screen.
 *
 * A button rather than a link: the destination does not exist until the API has
 * minted it, and it stops existing five minutes later, so it cannot be
 * prefetched, bookmarked, or rendered into the markup. `useApi` rather than a
 * Server Action because that is how every other vendor mutation in this app
 * calls the API, and one flow is not worth a second mechanism.
 */
export function ConnectPayoutsForm({ isResuming }: ConnectPayoutsFormProps): React.ReactElement {
  const request = useApi();
  const [isOpening, setIsOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  async function openStripe(): Promise<void> {
    setFailed(false);
    setIsOpening(true);

    try {
      const { url } = await request('/vendor/stripe/connect', {
        method: 'POST',
        schema: stripeOnboardingLinkSchema,
      });

      // `assign`, not `replace`: Back should return the vendor to this page.
      window.location.assign(url);
    } catch {
      /*
       * The upstream message is the API's own words, which `40-states.md` does
       * not allow onto a screen. Nothing was created that a retry would
       * duplicate, so the sentence says exactly that and offers the same button.
       */
      setFailed(true);
      setIsOpening(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3.5">
      {failed ? (
        <Banner status="failed" title="Stripe did not answer">
          We could not reach Stripe just then. Nothing has changed &mdash; try again.
        </Banner>
      ) : null}
      {/*
        The element loader, per frame `26`: this one control is busy and its
        label says what it is doing. Leaving for Stripe is slow and visible, and
        a button that still looks idle invites a second click. It stays busy
        through the redirect rather than resetting, because the page is going
        away.
      */}
      <Button type="button" variant="primary" size="lg" loading={isOpening} onClick={openStripe}>
        {isOpening ? 'Opening Stripe…' : isResuming ? 'Continue setup' : 'Set up payouts'}
      </Button>
    </div>
  );
}
