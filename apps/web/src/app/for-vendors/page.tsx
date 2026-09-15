import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BRAND_NAME,
  calculateFees,
  DEFAULT_PLATFORM_FEE_RATE,
  formatPrice,
  formatRate,
  pageTitle,
  LEGAL_PATHS,
  PAYOUT_RELEASE_HOURS,
} from '@vendor-marketplace/shared';
import { Button } from '@/components/ui/button';
import { redirectVendorToDashboard } from '@/lib/current-user';
import { FOR_VENDORS_PAYOUTS_ANCHOR } from '@/lib/for-vendors';

export const metadata: Metadata = {
  title: pageTitle('For vendors'),
  description: `What a vendor keeps and when they are paid on ${BRAND_NAME}.`,
  alternates: { canonical: '/for-vendors' },
};

/**
 * The composition differs by role — a vendor is redirected — so a cached copy
 * would be wrong for part of the audience. The same declaration `/` makes.
 */
export const dynamic = 'force-dynamic';

/** The sign-up deep link, with the vendor card pre-selected (21-sign-up.md). */
const SIGN_UP_PATH = '/sign-up?role=vendor';

/**
 * The worked example's price, formatted through `formatPrice` like every other
 * amount in the product — so `$2,600` where the frame draws `$2,600.00`, the
 * same accepted deviation #454 recorded for the console.
 *
 * The frame's own arithmetic is a transcription (`$286.00` is 11%); the rows
 * here are computed from the rate, so they always sum. Arithmetic on a
 * vendor's own figure, not a claim about the platform — so it is not an
 * invented statistic.
 */
const EXAMPLE_PRICE_CENTS = 260_000;

/** Same gutter ladder as the landing page and the header. */
const CONTAINER = 'mx-auto w-full max-w-[1440px] px-5 lg:px-7 min-[90rem]:px-10';

/**
 * "an <brand> balance", with the article following the brand rather than typed
 * beside it — the name is read from `BRAND_NAME`, so the article must be too.
 */
const BRAND_BALANCE = `${/^[aeiou]/i.test(BRAND_NAME) ? 'an' : 'a'} ${BRAND_NAME} balance`;

const EYEBROW = 'text-xs font-semibold tracking-[0.11em] text-clay-600 uppercase';

/** A config figure. Gold, because each one names a wait (40-states.md). */
function ConfigChip({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span
      data-slot="config-chip"
      className="rounded-[4px] bg-gold-50 px-1.5 py-0.5 font-mono text-pill font-medium tracking-[0.05em] whitespace-nowrap text-gold-600"
    >
      {children}
    </span>
  );
}

/**
 * Built per render rather than at module scope, so the release step reads
 * `PAYOUT_RELEASE_HOURS` when the page renders, not once when it is imported.
 */
function payoutSteps(): readonly { key: string; title: React.ReactNode; body: string }[] {
  return [
    {
      key: 'accept',
      title: 'You accept the request',
      body: 'Date, package and customer before you commit. Declining costs nothing.',
    },
    {
      key: 'pay',
      title: 'The customer pays in full',
      body: 'At the moment they book, not on the day. The date is held as soon as it clears.',
    },
    {
      key: 'hold',
      title: 'Stripe holds it until the event',
      body: 'You can see it sitting there the whole time.',
    },
    {
      key: 'release',
      /*
       * The frame's "two business days" is a design placeholder; D35's constant
       * governs, so the chip says whatever `PAYOUT_RELEASE_HOURS` says.
       */
      title: (
        <>
          Released <ConfigChip>{`${PAYOUT_RELEASE_HOURS} hours`}</ConfigChip> after
        </>
      ),
      body: 'The hold lifts and the payout runs on the next sweep. Your dashboard names the date.',
    },
  ];
}

const PAYOUT_FACTS = [
  {
    lead: 'Canceled by the customer?',
    body: 'They are refunded and our fee is refunded with it.',
  },
  {
    lead: 'Payout failed?',
    body: 'You are told which detail Stripe rejected, not just that it failed.',
  },
  {
    lead: 'You cannot be booked on a day you did not open.',
    body: 'Accepting closes that date everywhere; unanswered requests expire and free it.',
  },
] as const;

/**
 * `/for-vendors` — the standalone frame in `design/delta-vendors/`.
 *
 * Two questions answered once each: what a vendor keeps, and when they get it.
 * The commission appears exactly once, as a subtraction inside the worked
 * example, and both figures come from the constants the vendor agreement and
 * the payout sweep read — never from the template.
 *
 * Mobile variants that shorten copy are hidden with CSS rather than rendered
 * twice, so neither CTA nor the commission is ever duplicated in the DOM.
 */
export default async function ForVendorsPage(): Promise<React.ReactElement> {
  // The page's only ask is one a vendor has already completed.
  await redirectVendorToDashboard();

  const steps = payoutSteps();
  const fees = calculateFees(EXAMPLE_PRICE_CENTS, DEFAULT_PLATFORM_FEE_RATE);

  return (
    <>
      <section
        aria-labelledby="for-vendors-heading"
        className="border-b border-stone-275 bg-stone-50"
      >
        <div
          className={`${CONTAINER} grid items-center gap-6.5 pt-8.5 pb-7.5 lg:grid-cols-[minmax(0,1fr)_452px] lg:gap-16 lg:pt-18 lg:pb-15`}
        >
          <div>
            <p className={`${EYEBROW} mb-3 lg:mb-4`}>For vendors</p>
            <h1
              id="for-vendors-heading"
              className="mb-3.5 font-display text-[34px] leading-[1.08] tracking-[-0.015em] text-pretty text-stone-900 lg:mb-4.5 lg:text-[56px] lg:leading-[1.06] lg:tracking-[-0.02em]"
            >
              Your prices, your dates,
              <br className="max-lg:hidden" /> your money.
            </h1>
            <p className="max-w-155 text-cta leading-[1.7] text-pretty text-stone-700 lg:text-lg lg:leading-[1.75]">
              List what you charge and the days you have free.
              <span className="max-lg:hidden">
                {' '}
                Customers book those days at those prices — no quotes by phone, no chasing an
                invoice afterwards.
              </span>{' '}
              You are paid through Stripe after the event.
            </p>
            <div className="mt-5.5 flex flex-col items-stretch gap-3 lg:mt-7.5 lg:flex-row lg:items-center lg:gap-5.5">
              <Link
                href={SIGN_UP_PATH}
                className="flex min-h-12 items-center justify-center rounded-lg bg-clay-400 px-6.5 py-3.5 text-cta font-semibold text-stone-0 transition-colors duration-(--duration-fast) hover:bg-clay-600"
              >
                Start taking bookings
              </Link>
              <a
                href={`#${FOR_VENDORS_PAYOUTS_ANCHOR}`}
                className="text-center text-base font-semibold text-clay-500 underline-offset-4 transition-colors duration-(--duration-fast) hover:text-clay-600 hover:underline"
              >
                See how payouts work ↓
              </a>
            </div>
            <ul className="mt-6.5 flex gap-6.5 text-sm text-stone-600 max-lg:hidden">
              <li>Free to list</li>
              <li aria-hidden="true" className="text-stone-500">
                ·
              </li>
              <li>No monthly fee</li>
              <li aria-hidden="true" className="text-stone-500">
                ·
              </li>
              <li>No fee unless you get paid</li>
            </ul>
          </div>

          <div
            data-slot="worked-example"
            className="rounded-xl border border-stone-300 bg-stone-0 px-4.5 pt-4.5 pb-4 shadow-[0_10px_30px_rgba(35,32,28,0.07)] lg:px-6 lg:pt-5.5 lg:pb-5"
          >
            <p className="mb-3 text-label font-medium tracking-[0.07em] text-stone-600 uppercase lg:mb-3.5">
              One booking, end to end
            </p>
            <dl>
              <div className="flex items-baseline justify-between border-b border-stone-150 py-2.25 lg:py-2.75">
                <dt className="text-action text-stone-900 lg:text-base">You charge</dt>
                <dd className="font-mono text-cta text-stone-900 lg:text-lg">
                  {formatPrice(fees.totalCents)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-b border-stone-150 py-2.25 lg:py-2.75">
                <dt className="text-action text-stone-600 lg:text-base">
                  {`${BRAND_NAME}'s fee `}
                  <ConfigChip>{formatRate(DEFAULT_PLATFORM_FEE_RATE)}</ConfigChip>
                </dt>
                <dd className="font-mono text-action text-stone-600 lg:text-cta">
                  {`− ${formatPrice(fees.platformFeeCents)}`}
                </dd>
              </div>
              <div className="flex items-baseline justify-between pt-3 pb-1 lg:pt-3.5 lg:pb-1.5">
                <dt className="text-base font-semibold text-stone-900 lg:text-cta">You keep</dt>
                <dd
                  data-slot="you-keep"
                  className="font-mono text-[21px] text-sage-600 lg:text-[24px]"
                >
                  {formatPrice(fees.vendorPayoutCents)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 border-t border-stone-150 pt-3 text-sm leading-[1.65] text-stone-600 max-lg:hidden">
              The customer pays{' '}
              <span className="font-mono text-meta">{formatPrice(fees.totalCents)}</span> — exactly
              your price. {BRAND_NAME} adds nothing on top, so you are never the expensive way to
              book yourself.
            </p>
          </div>
        </div>
      </section>

      <section
        id={FOR_VENDORS_PAYOUTS_ANCHOR}
        aria-labelledby="payouts-heading"
        className="scroll-mt-(--header-height) border-b border-stone-275 bg-stone-0"
      >
        <div className={`${CONTAINER} py-7.5 lg:py-14`}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-10 lg:mb-7">
            <div>
              <p className={`${EYEBROW} mb-2.75 lg:mb-3`}>When you are paid</p>
              <h2
                id="payouts-heading"
                className="display-heading text-[26px] leading-[1.16] text-stone-900 lg:text-[34px] lg:leading-[1.14]"
              >
                Collected at booking, released after the event.
              </h2>
            </div>
            <p className="max-w-85 text-action leading-[1.7] text-stone-600 max-lg:hidden">
              Nothing is invoiced and nothing is chased. Stripe holds the money in <em>your</em>{' '}
              account — not {BRAND_BALANCE} — the whole time.
            </p>
          </div>

          <ol className="grid overflow-hidden rounded-panel border border-stone-300 lg:grid-cols-4 lg:rounded-xl">
            {steps.map((step, index) => (
              <li
                key={step.key}
                data-slot="payout-step"
                className={
                  index === steps.length - 1
                    ? 'bg-gold-25 px-4.25 py-3.75 lg:px-5.5 lg:py-5'
                    : 'border-b border-stone-300 bg-stone-50 px-4.25 py-3.75 lg:border-r lg:border-b-0 lg:px-5.5 lg:py-5'
                }
              >
                <p className="mb-1.75 font-mono text-label text-clay-600 lg:mb-2.5 lg:text-xs">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="text-base font-semibold text-stone-900 lg:mb-1.25 lg:text-[14.5px]">
                  {step.title}
                </h3>
                <p className="text-action leading-[1.6] text-stone-600 max-lg:hidden">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <ul className="mt-4.5 flex flex-wrap gap-7.5 text-action text-stone-700 max-lg:hidden">
            {PAYOUT_FACTS.map((fact) => (
              <li key={fact.lead}>
                <strong className="font-semibold">{fact.lead}</strong> {fact.body}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-[1.7] text-stone-700 lg:hidden">
            You cannot be booked on a day you did not open. Cancellations refund our fee too.
          </p>
        </div>
      </section>

      <section aria-labelledby="for-vendors-cta-heading" className="bg-stone-900">
        <div
          className={`${CONTAINER} flex flex-col gap-5 py-7.5 lg:flex-row lg:items-end lg:justify-between lg:gap-15 lg:py-15.5`}
        >
          <div className="max-w-160">
            <h2
              id="for-vendors-cta-heading"
              className="mb-2.75 font-display text-[26px] leading-[1.14] text-stone-50 lg:mb-3.25 lg:text-[38px] lg:leading-[1.1]"
            >
              Set your prices and open your first date.
            </h2>
            <p className="text-base leading-[1.65] text-stone-480 lg:text-cta lg:leading-[1.7]">
              <span className="max-lg:hidden">
                Signing up takes a profile, a price list and a Stripe account.{' '}
              </span>
              Nothing is charged until you complete a booking.
            </p>
          </div>
          {/* The button leads on mobile and trails on desktop, as both frames draw. */}
          <div className="flex flex-none flex-col items-stretch gap-3.5 lg:flex-row lg:items-center lg:gap-5 lg:pb-0.75">
            <Link
              href={LEGAL_PATHS['vendor-agreement']}
              className="order-2 text-center text-action font-semibold text-stone-480 underline-offset-4 transition-colors duration-(--duration-fast) hover:text-stone-50 hover:underline lg:order-1 lg:text-base"
            >
              Read the vendor agreement
            </Link>
            {/*
              The cream `secondary` fill, as the landing band draws it — its
              ink label lives in the variant, not in this subtree.
            */}
            <Button
              variant="secondary"
              className="order-1 mt-0 min-h-12 px-6 py-3.25 text-cta lg:order-2 lg:min-h-0 lg:rounded-[9px] lg:text-base"
              asChild
            >
              <Link href={SIGN_UP_PATH}>Start taking bookings</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
