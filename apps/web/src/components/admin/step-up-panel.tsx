'use client';

import {
  STEP_UP_CODE_LENGTH,
  adminStepUpResultSchema,
  adminStepUpVerifySchema,
} from '@vendor-marketplace/shared';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi } from '@/lib/use-api';
import { REQUEST_DID_NOT_ARRIVE, userFacingError } from '@/lib/user-facing-error';

export interface StepUpPanelProps {
  /** Runs once the code is accepted — the confirm the admin was interrupted in. */
  onVerified: () => Promise<void>;
  /** The sentence that says why a code is asked for; defaults to the irreversible-action one. */
  lead?: string;
  /** Adds a Cancel control that backs out of the action without running it. */
  onCancel?: () => void;
}

const IRREVERSIBLE_LEAD = "This can't be undone. Confirm it's you first.";

/**
 * The second step of an irreversible console action (VEN-500): the API refused
 * with `STEP_UP_REQUIRED`, so the admin asks for a code, types it, and the
 * action they pressed is retried.
 *
 * Rendered by `ConfirmAction` only when that refusal arrives, so every
 * destructive control gets it and none has to know it exists. The code goes to
 * the address on the admin's own account; nothing here says which.
 */
export function StepUpPanel({
  onVerified,
  lead = IRREVERSIBLE_LEAD,
  onCancel,
}: StepUpPanelProps): React.ReactElement {
  const call = useApi();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeId = useId();
  const codeValid = adminStepUpVerifySchema.safeParse({ code }).success;

  async function run(work: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await work();
    } catch (failure) {
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-lg bg-gold-50 px-3 py-2.5">
      <p className="text-sm leading-prose text-stone-700">
        {lead} We email a six-digit code to the address on your account.
      </p>
      {sent ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={codeId} className="text-sm font-medium text-stone-900">
            Six-digit code
          </label>
          <Input
            id={codeId}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={STEP_UP_CODE_LENGTH}
            value={code}
            disabled={busy}
            onChange={(event) => setCode(event.target.value.trim())}
            className="text-sm"
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-error-500">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await call('/admin/step-up/challenge', {
                method: 'POST',
                schema: adminStepUpResultSchema,
              });
              setSent(true);
            })
          }
        >
          {sent ? 'Send a new code' : 'Email me a code'}
        </Button>
        {sent ? (
          <Button
            type="button"
            size="sm"
            disabled={busy || !codeValid}
            onClick={() =>
              void run(async () => {
                await call('/admin/step-up/verify', {
                  method: 'POST',
                  body: { code },
                  schema: adminStepUpResultSchema,
                });
                await onVerified();
              })
            }
          >
            Confirm code
          </Button>
        ) : null}
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
