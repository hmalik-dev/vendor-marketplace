import type { ReactNode } from 'react';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { StockPhoto } from '@/components/ui/stock-photo';

/**
 * The three guarantees on the marketing panel.
 *
 * Deliberately mechanism, not metrics: a new marketplace has no vendor count,
 * no "events booked" and no average rating worth publishing, and the last thing
 * a hesitant sign-up reads is the worst possible place for a placeholder
 * number. Each of these is true on day one. The stats band returns when the
 * numbers are real — condition in design/design-plan/98-post-mvp.md.
 */
const GUARANTEES = [
  'Live calendars — if a date shows open, it is',
  'Payment held until the event is complete',
  'Published prices, and no service fee on top',
] as const;

/**
 * The 200deg wash that lets the proof copy sit legibly over a photograph. It
 * is specific to this screen, so it lives here rather than in the shared theme.
 */
const PHOTO_WASH =
  'linear-gradient(200deg, rgba(35,32,28,.12) 0%, rgba(58,31,18,.62) 55%, rgba(35,32,28,.85) 100%)';

export interface AuthScreenProps {
  /** Serif headline: "Let's get you set up", "Welcome back". */
  headline: string;
  /** The one line under it. */
  subhead: string;
  children: ReactNode;
}

/**
 * The split screen behind both authentication routes.
 *
 * A card floating in a field of cream wastes half the viewport, so the
 * marketing panel uses the width honestly. Below 1280 the photograph drops and
 * the auth column centres — see design/design-plan/21-sign-up.md.
 */
export function AuthScreen({ headline, subhead, children }: AuthScreenProps): React.ReactElement {
  return (
    // The attribute is what globals.css keys the chrome-suppression rule off.
    <div data-auth-screen className="flex min-h-dvh">
      {/*
        `my-auto` on the panel rather than `justify-center` on the column: a
        centred flex child taller than its container is clipped at the top
        instead of being scrolled to, and a sliced headline is a bug.
      */}
      <div className="relative flex flex-1 flex-col items-center overflow-y-auto bg-stone-50 px-6 py-10 sm:px-10 xl:px-15">
        {/* A single soft clay disc bleeding off the corner, as in the frame. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-30 -left-27 size-85 rounded-full bg-clay-400/5"
        />

        <div className="relative my-auto w-full max-w-115">
          <div className="mb-6.5 flex justify-center">
            <Logo size={LOGO_SIZES.authPanel} />
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
        letterboxing into a strip.
      */}
      <div className="relative hidden w-150 shrink-0 overflow-hidden xl:block">
        <StockPhoto src="/stock/auth.jpg" sizes="600px" priority className="absolute inset-0" />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundImage: PHOTO_WASH }}
        />

        <div className="absolute inset-x-0 bottom-0 p-12">
          {/*
            The premise is published pricing *and* published availability —
            both halves. The word "transparent" never appears; the two lines
            demonstrate it and the italic third line closes on the customer's
            own decision. See design/design-plan/21-sign-up.md.
          */}
          <p className="font-display text-[38px] leading-[1.15] text-stone-0">
            See the price.
            <br />
            See the open dates.
            <br />
            <span className="text-gold-200 italic">Then decide.</span>
          </p>
          <p className="mt-3 max-w-100 text-md leading-relaxed text-stone-0/82">
            Every vendor publishes what they charge and when they&apos;re free — before you talk to
            anyone, and without asking for a quote.
          </p>

          <ul className="mt-6.5 flex max-w-100 flex-col gap-2.75 border-t border-stone-0/22 pt-5">
            {GUARANTEES.map((guarantee) => (
              <li key={guarantee} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.75 shrink-0 rounded-full bg-sage-200"
                />
                <span className="text-[13.5px] leading-normal text-stone-0/90">{guarantee}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
