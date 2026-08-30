'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { connectPayoutsAction } from '@/app/vendor/payments/actions';

interface ConnectPayoutsFormProps {
  /** True once the vendor has an account but has not finished onboarding. */
  isResuming: boolean;
}

/**
 * The element loader, per frame `26`: this one control is busy, and the label
 * says what it is doing. Leaving the app for Stripe is a slow, visible thing, and
 * a button that stays idle-looking during it invites a second click.
 */
function SubmitButton({ isResuming }: ConnectPayoutsFormProps): React.ReactElement {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" size="lg" loading={pending}>
      {pending ? 'Opening Stripe…' : isResuming ? 'Continue setup' : 'Set up payouts'}
    </Button>
  );
}

/**
 * The one control on the payments screen. A form posting to a Server Action
 * rather than a link, because the destination does not exist until the API has
 * minted it — and it stops existing five minutes later, so it cannot be
 * prefetched, bookmarked, or rendered into the markup.
 */
export function ConnectPayoutsForm({ isResuming }: ConnectPayoutsFormProps): React.ReactElement {
  const [state, formAction] = useActionState<{ error: string } | null>(
    async () => connectPayoutsAction(),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-3.5">
      {state?.error ? (
        <Banner status="failed" title="Stripe did not answer">
          {state.error}
        </Banner>
      ) : null}
      <SubmitButton isResuming={isResuming} />
    </form>
  );
}
