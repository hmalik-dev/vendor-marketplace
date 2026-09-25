'use client';

import { MAX_NAME_LENGTH, personalNameInputSchema } from '@vendor-marketplace/shared';
import { useId, useRef, useState } from 'react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { FirstRunShell } from '@/components/first-run-shell';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RETURN_PATH_PARAM } from '@/lib/return-path';
import { useApi } from '@/lib/use-api';
import { wireUserSchema } from '@/lib/wire-schemas';

export interface CustomerDetailsFormProps {
  /** Where `/after-sign-in` would otherwise have sent this customer. */
  returnTo: string | null;
}

type Field = 'firstName' | 'lastName';

const FIELD_DEFS: readonly { key: Field; label: string; autoComplete: string }[] = [
  { key: 'firstName', label: 'First name', autoComplete: 'given-name' },
  { key: 'lastName', label: 'Last name', autoComplete: 'family-name' },
];

/** Frame `41b`'s copy: the last-name line reads "too" because the first may already be fine. */
const FIELD_ERRORS: Record<Field, string> = {
  firstName: 'We need your first name.',
  lastName: 'We need your last name too.',
};

/** Frame `41`'s `.lbl`: the micro-label above each input. */
const LABEL = 'text-label font-semibold tracking-label text-stone-600 uppercase';

/**
 * Frame `41`'s input over the primitive: 10px radius on the filled `stone-0`
 * ground, and `41b`'s two states — the 1.5px red edge with its 18% ring, and
 * the saving fill, which stays legible rather than taking the primitive's
 * half-opacity wash.
 */
const INPUT_CLASS =
  'rounded-[10px] bg-stone-0 aria-invalid:border-[1.5px] aria-invalid:ring-destructive/18 disabled:bg-stone-100 disabled:text-stone-600 disabled:opacity-100';

/**
 * The mandatory name step (VEN-642), frame `41` and its states `41b` in
 * `design/delta-customer-name-collection/`, drawn in the same `FirstRunShell`
 * as the welcome screen (VEN-744). No "One last step" eyebrow: it is not the
 * last step for every path through sign-up, so it claims none.
 */
export function CustomerDetailsForm({ returnTo }: CustomerDetailsFormProps): React.ReactElement {
  const call = useApi();
  const fieldId = useId();
  const inputs = useRef<Record<Field, HTMLInputElement | null>>({
    firstName: null,
    lastName: null,
  });

  const [values, setValues] = useState<Record<Field, string>>({ firstName: '', lastName: '' });
  const [invalid, setInvalid] = useState<Record<Field, boolean>>({
    firstName: false,
    lastName: false,
  });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  function isInvalid(field: Field, value: string): boolean {
    return !personalNameInputSchema.shape[field].safeParse(value).success;
  }

  function change(field: Field, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));

    /* An error clears the moment the field is fixed, not at the next blur. */
    if (invalid[field]) {
      setInvalid((current) => ({ ...current, [field]: isInvalid(field, value) }));
    }
  }

  function blur(field: Field): void {
    setInvalid((current) => ({ ...current, [field]: isInvalid(field, values[field]) }));
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    const parsed = personalNameInputSchema.safeParse(values);

    if (!parsed.success) {
      /* A field never touched is checked here, so an empty submit names both. */
      setInvalid({
        firstName: isInvalid('firstName', values.firstName),
        lastName: isInvalid('lastName', values.lastName),
      });
      const first = FIELD_DEFS.find(({ key }) => isInvalid(key, values[key]));
      inputs.current[first?.key ?? 'firstName']?.focus();
      return;
    }

    setSaving(true);
    setFailed(false);

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
    } catch {
      /* The typed values stay in state, so the retry sends what the person already wrote. */
      setFailed(true);
      setSaving(false);
    }
  }

  let submitLabel = 'Continue';
  if (saving) {
    submitLabel = 'Saving';
  } else if (failed) {
    submitLabel = 'Try again';
  }

  return (
    <FirstRunShell
      heading="What should we call you?"
      sub="Vendors see this name once you request a booking."
    >
      {/* `noValidate`: this form owns its own submit (#388). */}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {failed ? (
          <Banner status="failed" title="We couldn't save your name">
            What you typed is still here. Try again.
          </Banner>
        ) : null}

        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          {FIELD_DEFS.map(({ key, label, autoComplete }) => {
            const inputId = `${fieldId}-${key}`;
            const errorId = `${inputId}-error`;

            return (
              <div key={key} className="flex flex-col gap-1.5">
                <label htmlFor={inputId} className={LABEL}>
                  {label}
                </label>
                <Input
                  ref={(node) => {
                    inputs.current[key] = node;
                  }}
                  id={inputId}
                  autoComplete={autoComplete}
                  autoFocus={key === 'firstName'}
                  maxLength={MAX_NAME_LENGTH}
                  value={values[key]}
                  disabled={saving}
                  aria-invalid={invalid[key] || undefined}
                  aria-describedby={invalid[key] ? errorId : undefined}
                  className={INPUT_CLASS}
                  onChange={(event) => change(key, event.target.value)}
                  onBlur={() => blur(key)}
                />
                {invalid[key] ? (
                  <p id={errorId} className="text-helper text-error-500">
                    {FIELD_ERRORS[key]}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={saving}
          loading={saving}
          className="w-full rounded-[10px] py-[13px] disabled:bg-clay-500"
        >
          {submitLabel}
        </Button>

        {/* A mandatory step is not a trap (VEN-701): the way out is here, not only in the header menu. */}
        <SignOutButton>
          <button
            type="button"
            disabled={saving}
            className="mx-auto block text-action font-semibold text-clay-500 hover:text-clay-600 hover:underline disabled:opacity-50"
          >
            Sign out
          </button>
        </SignOutButton>
      </form>
    </FirstRunShell>
  );
}
