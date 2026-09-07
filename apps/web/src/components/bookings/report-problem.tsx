import Link from 'next/link';
import { payoutReleaseAt, SUPPORT_PATH, toDateString } from '@vendor-marketplace/shared';
import { reportWindowFor, type ReportSubject, type ReportWindow } from '@/lib/booking-report';
import { formatPayoutDate } from '@/lib/payout-date';
import { supportBookingLink } from '@/lib/support-link';

export interface ReportProblemProps {
  booking: ReportSubject & { id: string };
  /** How the vendor is named in the sentences below. */
  vendorName: string;
}

/** What each window says, and what it offers. `null` renders nothing at all. */
interface ReportState {
  body: string;
  action?: { label: string; href: string };
}

/**
 * `Report a problem` — the customer's way into #423's payout hold (#425).
 *
 * Before this existed nothing in the app let a customer raise anything about a
 * booking, and nothing anywhere wrote `disputed`: the status the whole
 * hold-until-the-event design turns on was reachable only from an API call the
 * product never made. This is the control that reaches it, on the one screen
 * that belongs to the person it protects.
 *
 * **Four states, and only one of them is a control.** `40-states.md` prefers a
 * blocker the reader cannot cross to a control that answers with a refusal, and
 * this is the case that rule is for: outside the window the API refuses the
 * hold, so offering the button would spend a click to be told no. Each of the
 * other three says what to do instead.
 *
 * The open state names the **date** the window closes, read from
 * `payoutReleaseAt`. A date, never a duration: D16 bans a screen restating an
 * interval the code derives, and it is that rule rather than a style preference
 * — the release window has moved once already.
 *
 * A server component. There is nothing interactive here — the control is a
 * link — and the window is then decided on the server's clock, which is the one
 * `placeDisputeHold` decides it on.
 */
export function ReportProblem({
  booking,
  vendorName,
}: ReportProblemProps): React.ReactElement | null {
  const state = stateFor(reportWindowFor(booking), booking, vendorName);

  if (state === null) {
    return null;
  }

  return (
    <div className="rounded-[10px] bg-stone-50 px-3.5 py-3">
      <p className="text-[12.5px] leading-[1.55] text-stone-700">{state.body}</p>
      {state.action ? (
        <Link
          href={state.action.href}
          className="mt-2 inline-block rounded-md text-[12.5px] font-semibold text-clay-500 hover:underline"
        >
          {state.action.label}
        </Link>
      ) : null}
    </div>
  );
}

function stateFor(
  window: ReportWindow,
  booking: ReportProblemProps['booking'],
  vendorName: string,
): ReportState | null {
  switch (window) {
    case 'open': {
      const closes = payoutReleaseAt(booking.eventDate);

      return {
        body:
          `Something go wrong on the day? Tell us what happened and we'll hold ${vendorName}'s ` +
          (closes === null
            ? 'payment while we look into it.'
            : `payment while we look into it — up until ${formatPayoutDate(closes, toDateString(new Date()))}, when it goes out.`),
        action: { label: 'Report a problem', href: supportBookingLink(booking.id) },
      };
    }

    case 'reported':
      return {
        body:
          `You've reported a problem with this booking. ${vendorName}'s payment is on hold while ` +
          "we look into it, and we'll reply by email.",
      };

    case 'before-event':
      return {
        body:
          'Reporting a problem opens after the event. Until then, cancelling is what changes a ' +
          'booking — the refund is shown above before you confirm.',
      };

    case 'released':
      return {
        body:
          `${vendorName} has been paid for this booking, so we can't hold the payment any more. ` +
          'Get in touch and a person will look into it.',
        action: { label: 'Contact support', href: SUPPORT_PATH },
      };

    /* Cancelled: there is no booking left to report, and nothing to say. */
    case 'closed':
      return null;
  }
}
