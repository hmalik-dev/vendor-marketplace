'use client';

import { AlertDialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { REQUEST_DID_NOT_ARRIVE, userFacingError } from '@/lib/user-facing-error';

export interface ConfirmActionProps {
  /**
   * The control that opens the dialog — a row button.
   *
   * Omitted when the dialog is opened from an **overflow menu** instead. Radix
   * unmounts a menu's content when the menu closes, so a dialog rendered as a
   * menu item's child is torn down by the very click meant to open it. The menu
   * therefore sets `open` on a dialog rendered as its sibling, and this prop is
   * what distinguishes the two mounts.
   */
  trigger?: ReactNode;
  /** Set to drive the dialog from outside — see `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Where focus goes when the dialog closes.
   *
   * Radix restores focus on close to whatever was focused when the dialog
   * opened. For a dialog opened from an **overflow menu** that element is a menu
   * item which has already unmounted, so the restore lands on `document.body` —
   * a keyboard operator who cancels is dropped at the top of the document, about
   * twenty tab stops from their row. Calling `focus()` from `onOpenChange` does
   * not fix it: that runs *before* Radix's own restore, which then overwrites
   * it. `onCloseAutoFocus` is the documented seam, and preventing its default is
   * what stops the overwrite.
   */
  restoreFocus?: () => void;
  title: string;
  /**
   * What this will do, in the operator's terms and naming the consequence:
   * how many bookings get cancelled, how many vendors keep a tag. Never
   * "Are you sure?", which names nothing.
   */
  description: ReactNode;
  confirmLabel: string;
  /**
   * What dismissing returns you to, where "Cancel" would be ambiguous.
   *
   * Drawn by Pattern C of the admin delta (#454): the case-detail confirms
   * dismiss with **Keep the case open**, because "Cancel" on a screen about
   * refunding a booking is a verb about money and reads as the action rather
   * than the escape from it. The same rule already gave the customer's booking
   * dialog "Keep booking". Defaults to `Cancel`, which is right everywhere the
   * word is unambiguous.
   */
  cancelLabel?: string;
  /**
   * The thing operators get wrong, in a gold panel below the description.
   *
   * `40-states.md`: gold is waiting on someone, and every caution drawn here is
   * about something still in flight after the press — a refund that takes days
   * to settle, a bank dispute that a refund does not withdraw. It is separated
   * from the description because a confirm that **restates** rather than
   * summarises has two jobs, and running them into one paragraph is how the
   * second one stops being read.
   */
  caution?: ReactNode;
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
  open: controlledOpen,
  onOpenChange,
  restoreFocus,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  caution,
  destructive = false,
  onConfirm,
}: ConfirmActionProps): React.ReactElement {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(next: boolean): void {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

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
       *
       * `userFacingError`, not `failure.message`. These actions call Stripe, so
       * they are the paths most likely to 500 — and a 5xx body is written about
       * the server, not the reader: it can carry a stack fragment or an SDK
       * complaining about an API key. That helper suppresses those and passes
       * the API's own 4xx sentences through.
       */
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
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
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-stone-900/20" />
        <AlertDialog.Content
          onCloseAutoFocus={(event) => {
            if (!restoreFocus) {
              return;
            }

            event.preventDefault();
            restoreFocus();
          }}
          className="fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stone-300 bg-stone-0 p-6 shadow-lg"
        >
          <AlertDialog.Title className="display-heading text-display-sm text-stone-900">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 text-base leading-prose text-stone-700">{description}</div>
          </AlertDialog.Description>

          {caution ? (
            <div className="mt-3.5 rounded-lg bg-gold-50 px-3 py-2.5 text-sm leading-prose text-stone-700">
              {caution}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-sm text-error-500">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" size="sm" disabled={busy}>
                {cancelLabel}
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
