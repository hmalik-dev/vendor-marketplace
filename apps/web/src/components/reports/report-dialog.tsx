'use client';

import {
  MAX_REPORT_DETAIL_LENGTH,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  reportReceiptSchema,
  SUPPORT_PATH,
  type ReportReason,
  type ReportSubject,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FIELD_FOCUS } from '@/lib/focus';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import { cn } from '@/lib/utils';

/**
 * `Report` — one control, four surfaces (#436).
 *
 * A vendor profile, a review, a message thread and a portfolio photo all take
 * the same dialog, because they file the same object: a case in the operations
 * queue with a subject, a reason and an optional sentence. Four dialogs would
 * be four wordings for one question and four places for the copy to drift.
 *
 * **It says what a report is and is not.** A report reaches an operator, it is
 * not a reply to the person reported, and there is no status to come back and
 * check — the same scope `/support` states about itself, for the same reason:
 * somebody who expects a conversation and gets a reference is worse off than
 * somebody who was told.
 */

export interface ReportDialogProps {
  subjectType: ReportSubject;
  subjectId: string;
  /** What the trigger says it is reporting: `this review`, `this photo`. */
  subjectNoun: string;
  /**
   * Whether the reader is signed in.
   *
   * The route is authenticated, so a signed-out reader must not be handed a
   * form that can only fail. They get the same control pointing at sign-in —
   * `40-states.md`'s rule that an error says what to do about it, applied
   * before the error rather than after it.
   */
  signedIn: boolean;
  /** `ghost` on a crowded surface, `link` where the row is already dense. */
  className?: string;
}

type Phase = 'editing' | 'sending' | 'sent';

const REASON_OPTIONS = REPORT_REASONS.map((reason) => ({
  value: reason,
  label: REPORT_REASON_LABELS[reason],
}));

const FIELD = cn(
  'h-auto w-full rounded-[10px] border border-stone-300 bg-stone-150 px-3.25 py-2.5 text-base text-stone-900',
  FIELD_FOCUS,
);

const TRIGGER = 'text-[12.5px] text-stone-600 underline underline-offset-2 hover:text-stone-900';

export function ReportDialog({
  subjectType,
  subjectId,
  subjectNoun,
  signedIn,
  className,
}: ReportDialogProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  if (!signedIn) {
    return (
      <Link href="/sign-in" className={cn(TRIGGER, className)}>
        Sign in to report {subjectNoun}
      </Link>
    );
  }

  return (
    <>
      <button type="button" className={cn(TRIGGER, className)} onClick={() => setOpen(true)}>
        Report {subjectNoun}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/*
          Mounted only while it is open, and that is load-bearing rather than
          an optimisation.

          The form calls `useApi`, which calls Clerk's `useAuth` — so a closed
          trigger that held the hook would put Clerk's context on the critical
          path of every surface carrying one, twenty times over on a portfolio
          tab. Unmounting on close is also what discards everything typed:
          a report is filed or it is not, and a half-written accusation
          restoring itself later is not a draft anybody asked for.
        */}
        {open ? (
          <ReportForm
            subjectType={subjectType}
            subjectId={subjectId}
            subjectNoun={subjectNoun}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </Dialog>
    </>
  );
}

/** The half that talks to the API. Mounted only while the dialog is open. */
function ReportForm({
  subjectType,
  subjectId,
  subjectNoun,
  onDone,
}: {
  subjectType: ReportSubject;
  subjectId: string;
  subjectNoun: string;
  onDone: () => void;
}): React.ReactElement {
  const request = useApi();
  const detailId = useId();
  const reasonId = useId();

  const [reason, setReason] = useState<ReportReason | ''>('');
  const [reasonOpen, setReasonOpen] = useState(false);
  const [detail, setDetail] = useState('');
  const [phase, setPhase] = useState<Phase>('editing');
  const [reference, setReference] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (reason === '' || phase !== 'editing') {
      return;
    }

    setPhase('sending');
    setRefusal(null);

    try {
      const receipt = await request('/reports', {
        schema: reportReceiptSchema,
        method: 'POST',
        body: {
          subjectType,
          subjectId,
          reason,
          ...(detail.trim() === '' ? {} : { detail }),
        },
      });

      setReference(receipt.reference);
      setPhase('sent');
    } catch (error) {
      /*
       * **The rate limit is a 4xx and belongs on this screen**, not on the
       * error boundary: six reports an hour is a limit a person can hit
       * honestly, and a 500 page in its place would tell them the product is
       * broken. `userFacingError` keeps the API's own sentence — "Too many
       * requests. Please try again shortly." — and supplies the fallback below
       * only for the generic shapes.
       */
      setRefusal(
        userFacingError(
          error,
          'That report did not reach us. Check your connection and try again.',
        ),
      );
      setPhase('editing');
    }
  }

  return (
    <DialogContent>
      {phase === 'sent' && reference !== null ? (
        <>
          <DialogHeader>
            <DialogTitle>Report received</DialogTitle>
            <DialogDescription>
              Our team reviews every report. We will not tell you what we decide, and there is
              nothing here to come back and check — quote{' '}
              <span className="font-mono text-stone-900">{reference}</span> if you need to ask about
              it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={onDone}>
              Done
            </Button>
          </DialogFooter>
        </>
      ) : (
        <form
          // This form owns its validation, so the browser must not run its
          // own first and cancel the submit before React sees it (#388).
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <DialogHeader>
            <DialogTitle>Report {subjectNoun}</DialogTitle>
            <DialogDescription>
              This goes to our team, not to the person you are reporting. For a problem with your
              own booking or payment, <Link href={SUPPORT_PATH}>contact support</Link> instead.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <Label htmlFor={reasonId}>What is wrong?</Label>
              <SingleSelectDropdown
                open={reasonOpen}
                onOpenChange={setReasonOpen}
                label="Reason"
                countNoun="reasons"
                options={REASON_OPTIONS}
                value={reason === '' ? null : reason}
                onChange={(next) => setReason(next as ReportReason)}
                trigger={
                  <button
                    type="button"
                    id={reasonId}
                    aria-haspopup="listbox"
                    aria-expanded={reasonOpen}
                    // A bordered field owns its indicator; see `@/lib/focus`.
                    data-focus-own
                    className={cn(
                      FIELD,
                      'mt-1.5 flex items-center justify-between gap-2 text-left',
                    )}
                  >
                    <span className={cn(reason === '' && 'text-stone-600')}>
                      {reason === '' ? 'Choose a reason' : REPORT_REASON_LABELS[reason]}
                    </span>
                  </button>
                }
              />
            </div>

            <div>
              <Label htmlFor={detailId}>Anything else? (optional)</Label>
              <Textarea
                id={detailId}
                className={FIELD}
                rows={4}
                maxLength={MAX_REPORT_DETAIL_LENGTH}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
              />
            </div>

            {refusal === null ? null : (
              <p role="alert" className="text-[12.5px] text-error-500">
                {refusal}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={reason === '' || phase === 'sending'}>
              {phase === 'sending' ? 'Sending' : 'Send report'}
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}
