'use client';

import {
  FULL_REFUND_CUTOFF_HOURS,
  formatDurationHours,
  formatPrice,
  LATE_CANCELLATION_REFUND_RATE,
} from '@vendor-marketplace/shared';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance, type StripeElementsOptions } from '@stripe/stripe-js';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { publicEnv } from '@/config/public-env';
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
 *
 * The key comes through `publicEnv`, not `?? ''`. Stripe.js rejects an empty
 * key, so that fallback rendered a checkout with no card field and a Pay button
 * that did nothing — the server had already opened a real PaymentIntent by
 * then. The web build now validates the `stripe` capability, so a deploy cannot
 * reach here without one.
 */
const stripePromise = loadStripe(publicEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'));

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
    // Frame `05`'s `.lbl`: 10.5px at .05em, the same micro-label the rest of
    // the app wears. `--text-label` and `--tracking-label` are the tokens; they
    // are restated as literals because Stripe's iframe is a different document
    // and cannot read this one's custom properties.
    '.Label': {
      fontSize: '10.5px',
      fontWeight: '600',
      letterSpacing: '.05em',
      textTransform: 'uppercase',
      color: '#6B6459',
    },
  },
};

/**
 * The card form's id, so the pay button can sit in the summary rail and still
 * submit it. Module scope rather than `useId`: the button and the form are in
 * one component tree with one form on the screen, and a generated id would have
 * to be threaded through the rail to reach the button anyway.
 */
const PAY_FORM_ID = 'checkout-payment-form';

/**
 * Frame `05`'s `.dot`: 7px, not Tailwind's 6px `size-1.5`.
 *
 * Exported because this screen's header draws the same marker beside "Secure
 * checkout · encrypted by Stripe", and it is one measurement off one frame
 * line — a second literal there is a second thing to find when the frame moves.
 */
export const SAGE_DOT = 'size-[7px] rounded-full bg-sage-400';

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
        {/*
          `display-heading`, not `font-display`: this is the frames' tracked
          `.h2` role, and that class is where its `-.01em` lives — restating the
          number locally is the workaround `display-type.test.ts` forbids. 26px
          is the size frame `05` draws and the in-app ceiling `04-laws.md` sets;
          `leading-tight` had been setting 37.5px on a 30px face, where the
          frame sets no line-height at all.
        */}
        <h1 className="mb-1 display-heading text-display-md text-stone-900">Confirm and pay</h1>
        {/*
          The frame's context line, built from real facts rather than the
          frame's names: who accepted, when, and what paying now secures.
        */}
        <p className="mb-5.5 text-cta text-stone-700">
          {checkout.vendor.businessName} accepted your request
          {checkout.acceptedAt ? ` on ${ACCEPTED_ON.format(checkout.acceptedAt)}` : ''}. Paying now
          locks {SHORT_DAY.format(event)} in their calendar.
        </p>

        {/* This screen refuses in its own voice; the browser must not do it first. */}
        <form
          id={PAY_FORM_ID}
          onSubmit={pay}
          noValidate
          className="flex max-w-[620px] flex-col gap-4"
        >
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
          <div className="mt-0.5 rounded-panel border border-stone-300 bg-stone-0 px-4 py-3.5">
            <h2 className="mb-1.75 text-action font-semibold text-stone-900">If plans change</h2>
            {/*
              `leading-prose` is 1.6, the ratio the frames set on body copy.
              `01-foundations.md` names `relaxed` (1.625) as explicitly not it.
            */}
            <p className="text-sm leading-prose text-stone-700">
              Cancel more than {FULL_REFUND_CUTOFF_HOURS} hours before {SHORT_DAY.format(event)} and
              you&apos;re refunded in full. Inside {FULL_REFUND_CUTOFF_HOURS} hours,{' '}
              {LATE_CANCELLATION_REFUND_RATE === 0.5
                ? 'half'
                : `${LATE_CANCELLATION_REFUND_RATE * 100}%`}{' '}
              is refunded and {checkout.vendor.businessName} keeps the rest for the held date.
            </p>
          </div>
        </form>
      </div>

      <SummaryRail
        checkout={checkout}
        event={event}
        actions={
          <SummaryActions
            checkout={checkout}
            paying={paying}
            ready={Boolean(stripe && elements)}
            event={event}
            decline={decline}
          />
        }
      />
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

/**
 * The pay block: the button and its reassurance, the summary card's fourth and
 * last section (frame `05` lines 919–921).
 *
 * It is rendered in the rail and submits the form in the *other* column, which
 * is what the `form` attribute is for — a submit button need only name its
 * form, not be inside it. Keeping the button in the form meant the primary
 * action landed at a bottom edge of 917px on a 900px viewport: below the fold,
 * against `04-laws.md`'s requirement that it be visible without scrolling.
 */
function SummaryActions({
  checkout,
  paying,
  ready,
  event,
  decline,
}: {
  checkout: WireCheckoutIntent;
  paying: boolean;
  /** Stripe.js has loaded and the Elements group has mounted. */
  ready: boolean;
  event: Date;
  decline: Decline | null;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2.5 px-4.5 py-3.5">
      {/*
        The button names the amount *and* the outcome. "Pay" alone tells the
        customer what the button does to them rather than what they get.
      */}
      {/*
        Disabled until Stripe.js is up, not only while a charge is in flight.
        `pay` returns early on a null `stripe`, so an enabled button before then
        is one the customer clicks and nothing happens — no spinner, no error,
        no charge.

        `40-states.md`: a primary blocked by something takes the `clay-300`
        disabled fill and stays visible. The `Button` primitive's own
        `disabled:opacity-50` is a wash over `clay-400` rather than that token,
        and measured 2.10:1 against its label — overridden here rather than in
        the primitive, which every other disabled control in the app shares.
      */}
      <Button
        type="submit"
        form={PAY_FORM_ID}
        variant="primary"
        disabled={paying || !ready}
        className="justify-center py-3.5 text-[14.5px] disabled:bg-clay-300 disabled:opacity-100"
      >
        {paying ? (
          <>
            <Spinner />
            Paying…
          </>
        ) : (
          `${decline ? 'Try this payment again' : `Pay ${formatPrice(checkout.amountCents)}`} — confirm ${SHORT_DAY.format(event)}`
        )}
      </Button>
      <p className="flex items-center justify-center gap-1.75 text-helper text-stone-600">
        <span aria-hidden="true" className={SAGE_DOT} />
        Held by Stripe until the event is complete
      </p>
    </div>
  );
}

function SummaryRail({
  checkout,
  event,
  actions,
}: {
  checkout: WireCheckoutIntent;
  event: Date;
  /** The pay block — the card's fourth section. See `SummaryActions`. */
  actions: React.ReactNode;
}): React.ReactElement {
  const servicePackage = checkout.servicePackage;

  return (
    <aside aria-label="Your booking" className="pb-5">
      <div className="overflow-hidden rounded-2xl bg-stone-0 shadow-sm">
        <div className="flex items-center gap-3 border-b border-stone-200 px-4.5 py-4">
          {/*
            A 54px rounded square, not a circle: frame `05` line 906 draws the
            thing being bought rather than a person.
          */}
          <Avatar
            size="thumb"
            shape="panel"
            name={checkout.vendor.businessName}
            src={checkout.vendor.avatarUrl}
          />
          <div className="min-w-0">
            <p className="font-display text-[18px] text-stone-900">
              {checkout.vendor.businessName}
            </p>
            {/*
              Frame line 907: `<package> · <duration>`. A custom request has no
              package to name and a package need not declare a duration, so
              each half is dropped rather than rendered empty — the line itself
              disappears only when there is no package at all.
            */}
            {servicePackage ? (
              <p className="mt-0.5 truncate text-meta text-stone-600">
                {servicePackage.durationHours === null
                  ? servicePackage.name
                  : `${servicePackage.name} · ${formatDurationHours(servicePackage.durationHours)}`}
              </p>
            ) : null}
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
            <span className="text-cta font-semibold text-stone-900">Total today</span>
            <span className="font-display text-[30px] text-stone-900">
              {formatPrice(checkout.amountCents + checkout.customerFeeCents)}
            </span>
          </div>
        </div>

        {actions}
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
