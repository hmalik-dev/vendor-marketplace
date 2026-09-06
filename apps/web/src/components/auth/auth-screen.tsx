import { BRAND_NAME } from '@vendor-marketplace/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { StockPhoto } from '@/components/ui/stock-photo';

/**
 * Which side of the marketplace the marketing panel is speaking to. `both` is
 * the landing state — no role chosen yet, so the panel addresses both sides at
 * once and labels which line belongs to whom.
 */
export type AuthPanelRole = 'both' | 'customer' | 'vendor';

/**
 * The scrim's mid stop, given as a distance from the *end* of the gradient line
 * rather than as a percentage of it.
 *
 * `21-sign-up.md` is explicit after D30: the scrim is specified in pixels from
 * the bottom, not in percentages, and any new panel height re-derives the stop.
 * That is the lesson frame `12b` cost — the same 55% over a 700px panel puts
 * α 0.613 under the headline where a 900px panel puts 0.672, and eleven of the
 * three panels' twenty-nine line boxes failed AA. This panel is `min-h-dvh`, so
 * a percentage would move the ink under the copy on every viewport height.
 *
 * Frame `12` draws the stop at 55% of a 600x900 panel. At 200deg the gradient
 * line is `600·|sin 200°| + 900·|cos 200°|` = 1050.9px, so that stop sits
 * 472.9px from its end. `calc(100% - 472.9px)` is the same stop at any height:
 * 55.0% at 900px, and 45.2% at 700px — the value D30 re-cut `12b` to.
 */
export const SCRIM_MID_STOP_FROM_END_PX = 472.9;

/**
 * The one wash all three panels draw, differing only in the hue of its lower
 * two stops. The top stop is shared: D30 gives every panel frame `12`'s `.14`
 * and `.86`, so the coverage under a given line of copy is a property of the
 * panel rather than of which role is selected.
 */
function scrim(mid: string, bottom: string): string {
  return `linear-gradient(200deg, rgba(35,32,28,.14) 0%, ${mid} calc(100% - ${SCRIM_MID_STOP_FROM_END_PX}px), ${bottom} 100%)`;
}

/**
 * One list, two markers. A panel addressed to a single side leads each line
 * with a pale dot; the `both` panel replaces the dot with the name of the side,
 * because an unlabelled list of three mixed promises reads as vague rather than
 * as a split.
 *
 * A panel has exactly one of the two, so they are a union rather than two
 * optional fields — which is what lets the render reach for the marker it has
 * without a fallback that can never be taken.
 */
type GuaranteeMarkers =
  | {
      /** Each guarantee prefixed by the side it belongs to. */
      sideLabels: readonly [string, string, string];
      /** Tailwind text colour per side label, paired with `sideLabels`. */
      sideLabelClasses: readonly [string, string, string];
      dotClass?: never;
    }
  | {
      sideLabels?: never;
      sideLabelClasses?: never;
      /**
       * Frame `12b` draws the customer's dot in `sage-200` and the vendor's a
       * step lighter, in `sage-175` — the vendor panel is the greener ground of
       * the two, and the paler dot holds against it.
       */
      dotClass: string;
    };

type AuthPanel = {
  /** The photograph behind the wash — the product's own content. */
  photo: string;
  /**
   * The 200deg wash that lets the proof copy sit legibly over a photograph.
   * Each panel keeps the same structure and shifts hue: warm for the customer,
   * green for the vendor, matching the accent on the selected role card.
   */
  wash: string;
  /** The headline's first two lines, then the italic line that closes it. */
  headline: readonly [string, string, string];
  /** Tailwind class for that closing line — pale gold or pale sage on ink. */
  accentClass: string;
  body: string;
  /**
   * Mechanism, not metrics: a new marketplace has no vendor count, no "events
   * booked" and no average rating worth publishing, and the last thing a
   * hesitant sign-up reads is the worst possible place for a placeholder
   * number. Each of these is true on day one. The stats band returns when the
   * numbers are real — condition in design/design-plan/98-post-mvp.md.
   */
  guarantees: readonly [string, string, string];
} & GuaranteeMarkers;

/**
 * The two panels are the same promise inverted: a customer is told they will
 * **see** the price and the open dates, a vendor that they **set** them. That
 * symmetry is the product, so neither panel invents its own angle.
 *
 * The vendor panel makes **no claim about fees, in either direction** — vendors
 * do pay something and the model is not settled, so "Paid out after the event"
 * describes the payment mechanism instead, which holds under any model. The
 * customer's "no service fee on top" is true of the customer's half of the
 * transaction and is deliberately not mirrored or negated across.
 * See design/design-plan/21-sign-up.md.
 */
export const AUTH_PANELS: Record<AuthPanelRole, AuthPanel> = {
  /*
   * The default. It does not pick a side, so it says what the product is and
   * then splits the promise explicitly — booking, vending, and the one line
   * true of both. The wash goes neutral ink rather than clay or green, because
   * tinting it either way would answer the question the form is still asking.
   */
  both: {
    photo: '/stock/auth.jpg',
    wash: scrim('rgba(45,40,32,.62)', 'rgba(30,28,24,.86)'),
    headline: ['Clear prices.', 'Open calendars.', 'No back-and-forth.'],
    accentClass: 'text-gold-150',
    body: 'Event vendors and the people who hire them — with the price and the date settled before anyone picks up the phone.',
    guarantees: [
      "See what a vendor charges and when they're free",
      'Publish your prices and own your calendar',
      'Payment held until the event is complete',
    ],
    sideLabels: ['Booking', 'Vending', 'Both'],
    sideLabelClasses: ['text-gold-200', 'text-sage-175', 'text-stone-0/82'],
  },
  customer: {
    photo: '/stock/auth-customer.jpg',
    wash: scrim('rgba(58,31,18,.62)', 'rgba(35,32,28,.86)'),
    // The premise is published pricing *and* published availability — both
    // halves. The word "transparent" never appears; the two lines demonstrate
    // it and the italic third hands the decision back to the visitor.
    headline: ['See the price.', 'See the open dates.', 'Then decide.'],
    accentClass: 'text-gold-150',
    body: "Every vendor publishes what they charge and when they're free — before you talk to anyone, and without asking for a quote.",
    guarantees: [
      'Live calendars — if a date shows open, it is',
      'Payment held until the event is complete',
      'Published prices, and no service fee on top',
    ],
    dotClass: 'bg-sage-200',
  },
  vendor: {
    photo: '/stock/auth-vendor.jpg',
    wash: scrim('rgba(28,34,24,.62)', 'rgba(28,32,24,.86)'),
    headline: ['Set your prices.', 'Set your dates.', 'Get booked.'],
    accentClass: 'text-sage-150',
    body: 'Inquiries arrive already knowing what you charge and that your date is free — so you spend your evenings working, not writing quotes.',
    // The vendor's pain is unpaid quoting and calendar chaos, not price
    // discovery, so each line answers one of those. None of them claims volume
    // — that's a platform-scale promise the app cannot keep on day one.
    guarantees: [
      'You publish your own packages and prices',
      "Your calendar decides which dates you're offered",
      'Paid out after the event — no chasing invoices',
    ],
    dotClass: 'bg-sage-175',
  },
};

export interface AuthScreenProps {
  /** Serif headline: "Let's get you set up", "Welcome back". */
  headline: string;
  /** The one line under it. */
  subhead: string;
  /**
   * Which marketing panel to show beside the form. Defaults to `both`: nothing
   * has been chosen yet, and a panel that picks a side before the visitor does
   * is answering its own question.
   */
  panel?: AuthPanelRole;
  children: ReactNode;
}

/**
 * The split screen behind both authentication routes.
 *
 * A card floating in a field of cream wastes half the viewport, so the
 * marketing panel uses the width honestly. Below 1280 the photograph drops and
 * the auth column centres — see design/design-plan/21-sign-up.md.
 */
export function AuthScreen({
  headline,
  subhead,
  panel = 'both',
  children,
}: AuthScreenProps): React.ReactElement {
  const chosen = AUTH_PANELS[panel];
  const { photo, wash, headline: proof, accentClass, body, guarantees } = chosen;

  return (
    // The attribute is what globals.css keys the chrome-suppression rule off.
    <div data-auth-screen className="relative flex min-h-dvh overflow-hidden">
      {/*
        A single soft clay disc bleeding off the corner, as in the frame.

        It hangs on the screen rather than inside the scrolling column, and the
        screen clips it. Positioned in the column it extended 120px past the
        bottom of the scroll box, so the role-selection state — which is barely
        half a viewport of content — still showed a scrollbar and could be
        dragged down into empty cream.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-30 -left-27 size-85 rounded-full bg-clay-400/5"
      />

      {/*
        `my-auto` on the panel rather than `justify-center` on the column: a
        centred flex child taller than its container is clipped at the top
        instead of being scrolled to, and a sliced headline is a bug. The
        column still scrolls when the form genuinely outgrows the viewport —
        it just no longer scrolls for a decoration.
      */}
      <div className="relative flex flex-1 flex-col items-center overflow-y-auto bg-stone-50 px-6 py-10 sm:px-10 xl:px-15">
        <div className="relative my-auto w-full max-w-115">
          <div className="mb-6.5 flex justify-center">
            {/*
              The mark is the way out. Sign-in and sign-up have no header and no
              back link, so someone who arrived here by accident — or changed
              their mind — had nothing to press but the browser's own button. A
              wordmark that goes home is the convention every other page on the
              site already follows; here it was the only thing on screen that
              looked like a link and was not one.
            */}
            <Link href="/" aria-label={`${BRAND_NAME} home`} className="rounded-md">
              <Logo size={LOGO_SIZES.authPanel} />
            </Link>
          </div>

          <h1 className="text-center font-display text-[32px] leading-[1.15] text-stone-900">
            {headline}
          </h1>
          {/* Frame `12` draws this line at 14px — `text-cta`, not `text-md`. */}
          <p className="mt-1.5 mb-5.5 text-center text-cta text-stone-700">{subhead}</p>

          {children}
        </div>
      </div>

      {/*
        The photograph is the product's content, so it gets real width — but it
        carries no information, so it leaves entirely below 1280 rather than
        letterboxing into a strip. Keying the wrapper on the panel remounts the
        photograph on a role change, so the new one loads rather than being
        cross-faded out of a stale layer.
      */}
      <div key={panel} className="relative hidden w-150 shrink-0 overflow-hidden xl:block">
        <StockPhoto src={photo} sizes="600px" priority className="absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: wash }} />

        {/* Frame `12` draws `46px 48px`, not a uniform 48. */}
        <div className="absolute inset-x-0 bottom-0 px-12 py-11.5">
          <p className="font-display text-[38px] leading-[1.15] text-stone-0">
            {proof[0]}
            <br />
            {proof[1]}
            <br />
            <span className={`${accentClass} italic`}>{proof[2]}</span>
          </p>
          {/* 415px is the frame's measure; the scale's nearest step, 400, wraps
              the body a word early against the 38px headline above it. */}
          <p className="mt-3 max-w-[415px] text-md leading-relaxed text-stone-0/82">{body}</p>

          <ul
            className={`mt-6.5 flex flex-col border-t border-stone-0/22 pt-5 ${
              chosen.sideLabels ? 'max-w-105 gap-3' : 'max-w-100 gap-2.75'
            }`}
          >
            {guarantees.map((guarantee, index) => (
              <li
                key={guarantee}
                className={`flex items-start ${chosen.sideLabels ? 'gap-2.75' : 'gap-2.5'}`}
              >
                {chosen.sideLabels ? (
                  <span
                    className={`w-16 flex-none pt-0.75 text-[9.5px] font-bold tracking-[.09em] uppercase ${chosen.sideLabelClasses[index]}`}
                  >
                    {chosen.sideLabels[index]}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-1.75 shrink-0 rounded-full ${chosen.dotClass}`}
                  />
                )}
                <span className="text-[13.5px] leading-normal text-stone-0/90">{guarantee}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
