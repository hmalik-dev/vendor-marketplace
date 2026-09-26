'use client';

import {
  BOOKING_REPORT_CATEGORIES_BY_SIDE,
  BOOKING_REPORT_CATEGORY_LABELS,
  BOOKING_REPORT_CATEGORY_NEEDS_DETAIL,
  MAX_SUPPORT_MESSAGE_LENGTH,
  SUPPORT_TOPIC_WITH_BOOKING,
  supportMessageReceiptSchema,
  type BookingReportCategory,
  type BookingSide,
} from '@vendor-marketplace/shared';
import { useId, useRef, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FIELD_FOCUS } from '@/lib/focus';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import { cn } from '@/lib/utils';

/**
 * `Report a problem` from a booking — frames `51b Report a problem — customer`,
 * `— vendor` and `51b Report sent` (VEN-770).
 *
 * It sends through `/support/messages` with the booking attached, the one
 * support intake: a customer's report there still places the payout hold, and
 * a vendor's reaches the same inbox with no hold. The side is the server's to
 * decide from the booking row; `side` here only picks which list to draw.
 */
export interface BookingReportDialogProps {
  bookingId: string;
  side: BookingSide;
  /** The other party, as the dialog names them: the vendor's business or the customer. */
  counterpartName: string;
  /** `YYYY-MM-DD`. */
  eventDate: string;
  /** Drawn above the trigger until the report is sent. */
  children?: React.ReactNode;
  /** The box around `children` and the trigger; the sent banner draws its own. */
  className?: string;
}

const DIALOG_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const SENT_BODY: Record<BookingSide, string> = {
  customer:
    'An admin will look at it and reply by email. Your payment stays held while the case is open.',
  vendor: 'An admin will look at it and reply by email.',
};

export function BookingReportDialog({
  bookingId,
  side,
  counterpartName,
  eventDate,
  children,
  className,
}: BookingReportDialogProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const sentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (sent) {
    return (
      <div ref={sentRef} tabIndex={-1} className="outline-none">
        <Banner status="settled" title="Report sent">
          {SENT_BODY[side]}
        </Banner>
      </div>
    );
  }

  return (
    <div className={className}>
      {children}
      <button
        ref={triggerRef}
        type="button"
        className="mt-2 inline-block rounded-md text-[12.5px] font-semibold text-clay-500 hover:underline"
        onClick={() => setOpen(true)}
      >
        Report a problem
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Mounted only while open, as `ReportDialog` does: nothing typed outlives a cancel. */}
        {open ? (
          <BookingReportForm
            bookingId={bookingId}
            side={side}
            description={describe(side, counterpartName, eventDate)}
            onCancel={() => setOpen(false)}
            onSent={() => {
              setSent(true);
              setOpen(false);
            }}
            onCloseAutoFocus={(event) => {
              /*
               * Radix returns focus only to a `DialogTrigger`, and this trigger
               * is a plain button. After a send it is gone, so focus goes to the
               * banner that replaced it.
               */
              event.preventDefault();
              (sentRef.current ?? triggerRef.current)?.focus();
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function describe(side: BookingSide, counterpartName: string, eventDate: string): string {
  const about = `About your booking with ${counterpartName} on ${DIALOG_DATE.format(
    new Date(`${eventDate}T00:00:00Z`),
  )}.`;

  return side === 'customer' ? `${about} An admin reads every report.` : about;
}

type Phase = 'editing' | 'sending';

const FIELD = cn(
  'h-auto w-full rounded-[10px] border border-input bg-stone-0 px-3.25 py-2.5 text-base text-stone-900',
  FIELD_FOCUS,
);

function BookingReportForm({
  bookingId,
  side,
  description,
  onCancel,
  onSent,
  onCloseAutoFocus,
}: {
  bookingId: string;
  side: BookingSide;
  description: string;
  onCancel: () => void;
  onSent: () => void;
  onCloseAutoFocus: (event: Event) => void;
}): React.ReactElement {
  const request = useApi();
  const detailId = useId();
  const detailErrorId = useId();

  const [category, setCategory] = useState<BookingReportCategory | null>(null);
  const [detail, setDetail] = useState('');
  const [detailMissing, setDetailMissing] = useState(false);
  const [phase, setPhase] = useState<Phase>('editing');
  const [refusal, setRefusal] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (category === null || phase !== 'editing') {
      return;
    }

    const typed = detail.trim();

    if (category === BOOKING_REPORT_CATEGORY_NEEDS_DETAIL && typed === '') {
      setDetailMissing(true);
      return;
    }

    setPhase('sending');
    setRefusal(null);

    try {
      await request('/support/messages', {
        schema: supportMessageReceiptSchema,
        method: 'POST',
        body: {
          topic: SUPPORT_TOPIC_WITH_BOOKING,
          bookingId,
          bookingCategory: category,
          // A named category says what happened on its own; the detail adds to it.
          message: typed === '' ? BOOKING_REPORT_CATEGORY_LABELS[category] : typed,
        },
      });

      onSent();
    } catch (error) {
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
    <DialogContent className="sm:max-w-[480px]" onCloseAutoFocus={onCloseAutoFocus}>
      <form
        // This form owns its validation (#388).
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="sr-only">What went wrong?</legend>
          {BOOKING_REPORT_CATEGORIES_BY_SIDE[side].map((option) => (
            <label
              key={option}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-[10px] border bg-stone-0 px-3 py-2.5 text-[13px] text-stone-900 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-clay-500',
                category === option ? 'border-[1.5px] border-clay-500' : 'border-stone-200',
              )}
            >
              <input
                type="radio"
                name="booking-report-category"
                value={option}
                checked={category === option}
                onChange={() => {
                  setCategory(option);
                  setDetailMissing(false);
                }}
                className="size-4 accent-clay-500"
              />
              {BOOKING_REPORT_CATEGORY_LABELS[option]}
            </label>
          ))}
        </fieldset>

        <div className="mt-3.5">
          <Label htmlFor={detailId}>What happened</Label>
          <Textarea
            id={detailId}
            className={cn(FIELD, 'mt-1.5')}
            rows={3}
            maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
            value={detail}
            aria-invalid={detailMissing || undefined}
            aria-describedby={detailMissing ? detailErrorId : undefined}
            onChange={(event) => {
              setDetail(event.target.value);
              setDetailMissing(false);
            }}
          />
          {detailMissing ? (
            <p id={detailErrorId} className="mt-1.5 text-[12.5px] text-error-500">
              Tell us what happened.
            </p>
          ) : null}
        </div>

        {refusal === null ? null : (
          <p role="alert" className="mt-3 text-[12.5px] text-error-500">
            {refusal}
          </p>
        )}

        <DialogFooter className="mt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={category === null || phase === 'sending'}>
            {phase === 'sending' ? 'Sending' : 'Send report'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
