'use client';

import { AlertDialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api-client';

export interface ConfirmActionProps {
  /** The control that opens the dialog — an overflow-menu item or a row button. */
  trigger: ReactNode;
  title: string;
  /**
   * What this will do, in the operator's terms and naming the consequence:
   * how many bookings get cancelled, how many vendors keep a tag. Never
   * "Are you sure?", which names nothing.
   */
  description: ReactNode;
  confirmLabel: string;
  /** `true` when the action is irreversible, which is what earns the red fill. */
  destructive?: boolean;
  onConfirm: () => Promise<void>;
}

/**
 * The AlertDialog every destructive console action goes through
 * (`22-admin.md`).
 *
 * `AlertDialog` rather than `Dialog`: it traps focus on the cancel action, has
 * no dismiss-by-click-outside, and is announced as an alert — which is the
 * difference between a confirmation and a modal an operator dismisses by reflex.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmActionProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await onConfirm();
      setOpen(false);
    } catch (failure) {
      /*
       * The dialog stays open on failure. Closing it would leave the operator
       * looking at an unchanged table with no explanation, which reads as the
       * action having silently done nothing.
       */
      setError(
        failure instanceof ApiClientError
          ? failure.message
          : 'That did not reach us. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
        }
      }}
    >
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-stone-900/20" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stone-300 bg-stone-0 p-6 shadow-lg">
          <AlertDialog.Title className="display-heading text-display-sm text-stone-900">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 text-base leading-prose text-stone-700">{description}</div>
          </AlertDialog.Description>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-error-500">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" size="sm" disabled={busy}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            {/*
              Not wrapped in `AlertDialog.Action`: that closes the dialog on
              click, which would dismiss it before the request answers and take
              the error message with it.
            */}
            <Button
              type="button"
              size="sm"
              variant={destructive ? 'destructive' : 'primary'}
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
