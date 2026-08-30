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

interface AuthPanel {
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
   * Present only on the `both` panel. Each guarantee is prefixed by the side it
   * belongs to, which is what keeps a panel addressed to everyone from reading
   * as addressed to no one — and doubles as a preview of the choice sitting
   * right below it in the form column.
   */
  sideLabels?: readonly [string, string, string];
  /** Tailwind text colour per side label, paired with `sideLabels`. */
  sideLabelClasses?: readonly [string, string, string];
  /**
   * Mechanism, not metrics: a new marketplace has no vendor count, no "events
   * booked" and no average rating worth publishing, and the last thing a
   * hesitant sign-up reads is the worst possible place for a placeholder
   * number. Each of these is true on day one. The stats band returns when the
   * numbers are real — condition in design/design-plan/98-post-mvp.md.
   */
  guarantees: readonly [string, string, string];
}

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
const PANELS: Record<AuthPanelRole, AuthPanel> = {
  /*
   * The default. It does not pick a side, so it says what the product is and
   * then splits the promise explicitly — booking, vending, and the one line
   * true of both. The wash goes neutral ink rather than clay or green, because
   * tinting it either way would answer the question the form is still asking.
   */
  both: {
    photo: '/stock/auth.jpg',
    wash: 'linear-gradient(200deg, rgba(35,32,28,.14) 0%, rgba(45,40,32,.62) 55%, rgba(30,28,24,.86) 100%)',
    headline: ['Clear prices.', 'Open calendars.', 'No back-and-forth.'],
    accentClass: 'text-gold-200',
    body: 'Event vendors and the people who hire them — with the price and the date settled before anyone picks up the phone.',
    guarantees: [
      "See what a vendor charges and when they're free",
      'Publish your prices and own your calendar',
      'Payment held until the event is complete',
    ],
    sideLabels: ['Booking', 'Vending', 'Both'],
    sideLabelClasses: ['text-gold-200', 'text-sage-200', 'text-stone-0/55'],
  },
  customer: {
    photo: '/stock/auth-customer.jpg',
    wash: 'linear-gradient(200deg, rgba(35,32,28,.12) 0%, rgba(58,31,18,.62) 55%, rgba(35,32,28,.85) 100%)',
    // The premise is published pricing *and* published availability — both
    // halves. The word "transparent" never appears; the two lines demonstrate
    // it and the italic third hands the decision back to the visitor.
    headline: ['See the price.', 'See the open dates.', 'Then decide.'],
    accentClass: 'text-gold-200',
    body: "Every vendor publishes what they charge and when they're free — before you talk to anyone, and without asking for a quote.",
    guarantees: [
      'Live calendars — if a date shows open, it is',
      'Payment held until the event is complete',
      'Published prices, and no service fee on top',
    ],
  },
  vendor: {
    photo: '/stock/auth-vendor.jpg',
    wash: 'linear-gradient(200deg, rgba(35,32,28,.12) 0%, rgba(40,48,34,.62) 55%, rgba(28,32,24,.86) 100%)',
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
  const {
    photo,
    wash,
    headline: proof,
    accentClass,
    body,
    guarantees,
    sideLabels,
    sideLabelClasses,
  } = PANELS[panel];

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
          <p className="mt-1.5 mb-5.5 text-center text-md text-stone-700">{subhead}</p>

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

        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="font-display text-[38px] leading-[1.15] text-stone-0">
            {proof[0]}
            <br />
            {proof[1]}
            <br />
            <span className={`${accentClass} italic`}>{proof[2]}</span>
          </p>
          <p className="mt-3 max-w-100 text-md leading-relaxed text-stone-0/82">{body}</p>

          {/*
            One list, two markers. A panel addressed to a single side leads each
            line with a pale dot; the `both` panel replaces the dot with the
            name of the side, because an unlabelled list of three mixed promises
            reads as vague rather than as a split.
          */}
          <ul
            className={`mt-6.5 flex flex-col border-t border-stone-0/22 pt-5 ${
              sideLabels ? 'max-w-105 gap-3' : 'max-w-100 gap-2.75'
            }`}
          >
            {guarantees.map((guarantee, index) => (
              <li
                key={guarantee}
                className={`flex items-start ${sideLabels ? 'gap-2.75' : 'gap-2.5'}`}
              >
                {sideLabels ? (
                  <span
                    className={`w-16 flex-none pt-0.75 text-[9.5px] font-bold tracking-[.09em] uppercase ${sideLabelClasses?.[index] ?? ''}`}
                  >
                    {sideLabels[index]}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-1.75 shrink-0 rounded-full bg-sage-200"
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
