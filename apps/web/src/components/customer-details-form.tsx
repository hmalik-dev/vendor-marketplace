'use client';

import { MAX_NAME_LENGTH, personalNameInputSchema } from '@vendor-marketplace/shared';
import { useId, useState } from 'react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RETURN_PATH_PARAM } from '@/lib/return-path';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import { wireUserSchema } from '@/lib/wire-schemas';

export interface CustomerDetailsFormProps {
  /** Where `/after-sign-in` would otherwise have sent this customer. */
  returnTo: string | null;
}

const LABEL = 'text-sm font-semibold text-stone-700';

/**
 * The mandatory name step (VEN-642), built directly against
 * `accept-terms-screen.tsx`'s composition — the same `max-w-[700px]` panel,
 * heading and button/helper-text treatment — since no design frame exists for
 * it (VEN-643, canceled, ruled not a blocker). No "One last step" eyebrow: it
 * is not the last step for every path through sign-up, so it claims none.
 */
export function CustomerDetailsForm({ returnTo }: CustomerDetailsFormProps): React.ReactElement {
  const call = useApi();
  const fieldId = useId();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    const parsed = personalNameInputSchema.safeParse({ firstName, lastName });

    if (!parsed.success) {
      setProblem('Enter your first and last name.');
      return;
    }

    setSaving(true);
    setProblem(null);

    try {
      await call('/users/me', {
        method: 'PUT',
        body: parsed.data,
        schema: wireUserSchema,
      });

      /*
       * Back through `/after-sign-in` rather than straight to `returnTo`, the
       * same reason `accept-terms-screen.tsx` does it: that handler is the one
       * place that knows where this customer starts and re-validates the
       * destination before sending anybody to it. A full load, for the reason
       * `accept-terms-screen.tsx` gives: the header's avatar would otherwise
       * keep the placeholder it drew before the name existed.
       */
      window.location.replace(
        returnTo
          ? `/after-sign-in?${RETURN_PATH_PARAM}=${encodeURIComponent(returnTo)}`
          : '/after-sign-in',
      );
    } catch (error) {
      setProblem(userFacingError(error, "That didn't save — try again."));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[700px] px-6 py-13">
      <h1 className="display-heading text-display-md text-stone-900">What should we call you?</h1>
      <p className="mt-2 text-sm leading-prose text-stone-600">
        Vendors see this name once you request a booking.
      </p>

      {problem ? (
        <Banner status="failed" title="That did not save" className="mt-5">
          {problem}
        </Banner>
      ) : null}

      {/* `noValidate`: this form owns its own submit (#388). */}
      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${fieldId}-first`} className={LABEL}>
              First name
            </label>
            <Input
              id={`${fieldId}-first`}
              autoComplete="given-name"
              maxLength={MAX_NAME_LENGTH}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${fieldId}-last`} className={LABEL}>
              Last name
            </label>
            <Input
              id={`${fieldId}-last`}
              autoComplete="family-name"
              maxLength={MAX_NAME_LENGTH}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-5">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={saving}
            loading={saving}
            className="disabled:bg-clay-300 disabled:opacity-100"
          >
            {saving ? 'Saving…' : 'Continue'}
          </Button>
          {/* A mandatory step is not a trap (VEN-701): the way out is here, not only in the header menu. */}
          <SignOutButton>
            <Button type="button" variant="ghost" size="lg">
              Sign out
            </Button>
          </SignOutButton>
        </div>
      </form>
    </div>
  );
}
