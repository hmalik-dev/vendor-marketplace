'use client';

import {
  FULL_REFUND_CUTOFF_HOURS,
  formatPrice,
  LATE_CANCELLATION_REFUND_RATE,
} from '@vendor-marketplace/shared';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance, type StripeElementsOptions } from '@stripe/stripe-js';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { WireCheckoutIntent } from '@/lib/wire-schemas';

/**
 * Loaded once at module scope, not per render.
 *
 * `loadStripe` injects a script tag and resolves a singleton; calling it inside
 * the component would re-run on every render and hand `Elements` a new promise
 * each time, which remounts the iframe and loses whatever the customer had
 * typed into the card field.
 */
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

/** Frame `05`'s field styling, handed to Stripe's iframe as tokens. */
const APPEARANCE: Appearance = {
  variables: {
    fontFamily: '"Instrument Sans", system-ui, sans-serif',
    fontSizeBase: '13.5px',
    colorText: '#23201C',
    colorTextPlaceholder: '#6B6459',
    colorBackground: '#FFFDF9',
    colorDanger: '#B23A30',
    borderRadius: '10px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': { border: '1px solid #E4DDD1', padding: '11px 13px', boxShadow: 'none' },
    '.Input:focus': { border: '1.5px solid #B4552F', boxShadow: '0 0 0 3px rgba(180,85,47,.16)' },
    '.Input--invalid': {
      border: '1.5px solid #B23A30',
      boxShadow: '0 0 0 3px rgba(178,58,48,.18)',
    },
    '.Label': {
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: '#6B6459',
    },
  },
};

const ACCEPTED_ON = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const EVENT_DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const SHORT_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

function eventDay(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export interface CheckoutScreenProps {
  checkout: WireCheckoutIntent;
  /**
   * The request being paid for. Taken from the route rather than the payload:
   * the page already has it, and adding it to the response would put the same
   * value in two places that can disagree.
   */
  requestId: string;
}

/**
 * Frame `05`. Take payment with no ambiguity about what is being bought or what
 * happens if plans change.
 *
 * The whole screen is one client component because the card fields, the
 * declined state and the pay button are one interaction — splitting the rail
 * off would mean the summary could render before the thing it summarises.
 */
export function CheckoutScreen({ checkout, requestId }: CheckoutScreenProps): React.ReactElement {
  const options = useMemo<StripeElementsOptions>(
    () => ({ clientSecret: checkout.clientSecret ?? undefined, appearance: APPEARANCE }),
    [checkout.clientSecret],
  );

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm checkout={checkout} requestId={requestId} />
    </Elements>
  );
}

/**
 * What Stripe told us went wrong, and what the customer should do about it.
 *
 * `40-states.md` §1 requires the four questions to be answered explicitly on
 * this screen, and this is where three of them are: what happened, where the
 * money is, and what to do next. The fourth — whether the date is still theirs
 * — is a fact about the booking rather than about the failure, so it is stated
 * in the same banner but sourced from the request.
 */
interface Decline {
  message: string;
  /** Stripe's own code, shown verbatim under the field — frame `21`. */
  code: string | null;
  /** A second failure in a row changes the advice, per frame `21`. */
  attempts: number;
}

function CheckoutForm({ checkout, requestId }: CheckoutScreenProps): React.ReactElement {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [decline, setDecline] = useState<Decline | null>(null);

  const event = eventDay(checkout.eventDate);

  const pay = useCallback(
    async (submitted: React.FormEvent) => {
      submitted.preventDefault();

      if (!stripe || !elements || paying) {
        return;
      }

      setPaying(true);

      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (result.error) {
        /*
         * Inline, never a toast. A card error belongs beside the field that
         * caused it — a toast that has already faded is a customer staring at a
         * form with no idea which of five fields to change.
         */
        setDecline({
          message: result.error.message ?? 'Your bank refused the payment without giving a reason.',
          code: result.error.decline_code ?? result.error.code ?? null,
          attempts: (decline?.attempts ?? 0) + 1,
        });
        setPaying(false);
        return;
      }

      /*
       * The charge succeeded; the booking row is the webhook's to write. The
       * confirmed screen reads it and reconciles from Stripe directly if the
       * webhook has not landed yet, so arriving a moment early is a case it
       * already handles rather than a race this has to win.
       */
      router.push(`/bookings/${requestId}/confirmed`);
    },
    [decline?.attempts, elements, paying, requestId, router, stripe],
  );

  return (
    <div className="grid flex-1 gap-9.5 overflow-hidden px-10 pt-7 lg:grid-cols-[1fr_420px]">
      <div>
        <h1 className="mb-1 font-display text-[30px] leading-tight text-stone-900">
          Confirm and pay
        </h1>
        {/*
          The frame's context line, built from real facts rather than the
          frame's names: who accepted, when, and what paying now secures.
        */}
        <p className="mb-5.5 text-sm text-stone-700">
          {checkout.vendor.businessName} accepted your request
          {checkout.acceptedAt ? ` on ${ACCEPTED_ON.format(checkout.acceptedAt)}` : ''}. Paying now
          locks {SHORT_DAY.format(event)} in their calendar.
        </p>

        <form onSubmit={pay} className="flex max-w-[620px] flex-col gap-4">
          {decline ? <DeclineBanner decline={decline} event={event} /> : null}

          <PaymentElement options={{ layout: 'tabs' }} />

          {decline?.code ? (
            <p className="text-[11.5px] text-red-600">
              Declined by your bank · code <span className="font-mono">{decline.code}</span>
            </p>
          ) : null}

          {/*
            The last real objection, answered above the fold and in sentences
            rather than behind a policy link — frame `05`.
          */}
          <div className="mt-0.5 rounded-xl border border-stone-300 bg-stone-0 px-4 py-3.5">
            <h2 className="mb-1.75 text-[13px] font-semibold text-stone-900">If plans change</h2>
            <p className="text-[12.5px] leading-relaxed text-stone-700">
              Cancel more than {FULL_REFUND_CUTOFF_HOURS} hours before {SHORT_DAY.format(event)} and
              you&apos;re refunded in full. Inside {FULL_REFUND_CUTOFF_HOURS} hours,{' '}
              {LATE_CANCELLATION_REFUND_RATE === 0.5
                ? 'half'
                : `${LATE_CANCELLATION_REFUND_RATE * 100}%`}{' '}
              is refunded and {checkout.vendor.businessName} keeps the rest for the held date.
            </p>
          </div>

          <SummaryActions checkout={checkout} paying={paying} event={event} decline={decline} />
        </form>
      </div>

      <SummaryRail checkout={checkout} event={event} />
    </div>
  );
}

function DeclineBanner({ decline, event }: { decline: Decline; event: Date }): React.ReactElement {
  return (
    <div
      role="alert"
      className="flex max-w-[620px] items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5"
    >
      <span aria-hidden="true" className="mt-0.25 size-4.5 flex-none rounded-full bg-red-600" />
      <div>
        {/*
          The money position first, in the heading, because it is the question
          the customer is actually asking — `40-states.md` §1.
        */}
        <p className="mb-1 text-[13.5px] font-semibold text-stone-900">
          Your card was declined — you haven&apos;t been charged
        </p>
        <p className="text-[12.5px] leading-relaxed text-stone-700">
          {decline.message} Try the same card again, use another card, or call your bank.{' '}
          <strong className="font-semibold">
            {SHORT_DAY.format(event)} stays held for you for 24 hours.
          </strong>
        </p>
        {decline.attempts >= 2 ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-stone-600">
            It has declined twice — don&apos;t try a third time, because repeated attempts can
            extend the hold. Message the vendor and they can extend the date instead.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The pay button and its reassurance, which live in the rail on the frame. */
function SummaryActions({
  checkout,
  paying,
  event,
  decline,
}: {
  checkout: WireCheckoutIntent;
  paying: boolean;
  event: Date;
  decline: Decline | null;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2.5">
      {/*
        The button names the amount *and* the outcome. "Pay" alone tells the
        customer what the button does to them rather than what they get.
      */}
      <Button type="submit" variant="primary" disabled={paying} className="justify-center py-3.5">
        {paying ? (
          <>
            <Spinner />
            Paying…
          </>
        ) : (
          `${decline ? 'Try this payment again' : `Pay ${formatPrice(checkout.amountCents)}`} — confirm ${SHORT_DAY.format(event)}`
        )}
      </Button>
      <p className="flex items-center justify-center gap-1.75 text-[11.5px] text-stone-600">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-sage-500" />
        Held by Stripe until the event is complete
      </p>
    </div>
  );
}

function SummaryRail({
  checkout,
  event,
}: {
  checkout: WireCheckoutIntent;
  event: Date;
}): React.ReactElement {
  return (
    <aside aria-label="Your booking" className="pb-5">
      <div className="overflow-hidden rounded-[18px] bg-stone-0 shadow-[0_4px_18px_rgba(35,32,28,.09)]">
        <div className="flex items-center gap-3 border-b border-stone-200 px-4.5 py-4">
          <Avatar size="lg" name={checkout.vendor.businessName} src={checkout.vendor.avatarUrl} />
          <div className="min-w-0">
            <p className="font-display text-[18px] text-stone-900">
              {checkout.vendor.businessName}
            </p>
          </div>
        </div>

        <dl className="flex flex-col gap-2 border-b border-stone-200 px-4.5 py-3.5 text-[13px] text-stone-700">
          <Row label="Date" value={EVENT_DAY.format(event)} />
          {checkout.eventLocation ? <Row label="Venue" value={checkout.eventLocation} /> : null}
          {checkout.guestCount !== null ? (
            <Row label="Guests" value={String(checkout.guestCount)} />
          ) : null}
        </dl>

        <div className="flex flex-col gap-2.25 border-b border-stone-200 px-4.5 py-3.5">
          <div className="flex justify-between text-[13.5px] text-stone-700">
            <span>Package</span>
            <span>{formatPrice(checkout.amountCents)}</span>
          </div>
          {/*
            Stated, not omitted. "None" beside a fee line is a trust signal;
            an absent line is just an absent line, and the customer cannot tell
            it apart from one that was hidden.
          */}
          <div className="flex justify-between text-[13.5px] text-sage-600">
            <span>Service fee</span>
            <span className="font-semibold">
              {checkout.customerFeeCents === 0 ? 'None' : formatPrice(checkout.customerFeeCents)}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-stone-200 pt-2.25">
            <span className="text-sm font-semibold text-stone-900">Total today</span>
            <span className="font-display text-[30px] text-stone-900">
              {formatPrice(checkout.amountCents + checkout.customerFeeCents)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
