'use client';

import {
  BRAND_NAME,
  LEGAL_ACCEPTANCE_LABELS,
  vendorAgreementStatusSchema,
  vendorAgreementTerms,
  type VendorAgreementStatus,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { LegalBlocks } from '@/components/legal/legal-blocks';
import { OnboardingSteps } from '@/components/vendor/onboarding-steps';
import type { LegalDocument } from '@/lib/legal-markdown';
import { useApi } from '@/lib/use-api';

/**
 * Frame `32` — the vendor agreement, which is a **step with an action** rather
 * than a page behind a footer link.
 *
 * A vendor cannot take payment until they hold the current version, so this is
 * the surface that gates money on their side. Two states: unaccepted, which
 * blocks; and accepted, which is a permanent record rather than a banner that
 * fades.
 */

/**
 * How the accepted state states the moment, to the minute and with the zone.
 *
 * **UTC, like every other formatter in this app.** This component is a client
 * component rendered from a `force-dynamic` server page, so Next renders it on
 * the server first: an unpinned zone formats the instant in the container's
 * zone there and the viewer's zone in the browser, and with `timeZoneName` in
 * the output the two strings differ in both the time and the label — a
 * hydration mismatch React logs and a record that reads differently depending
 * on who opens it. #409 cost this product one bug of that shape already.
 */
const ACCEPTED_AT = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

/** `4 Jun 2026` — the agreements table's column, and the card header's date. */
const ACCEPTED_DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export interface VendorAgreementScreenProps {
  status: VendorAgreementStatus;
  /** The agreement itself, parsed on the server from `content/legal/`. */
  agreement: LegalDocument;
  /** True once Stripe can both transfer to and pay out from the account. */
  payoutsLive: boolean;
}

export function VendorAgreementScreen({
  status: initial,
  agreement,
  payoutsLive,
}: VendorAgreementScreenProps): React.ReactElement {
  const [status, setStatus] = useState(initial);

  return status.isCurrent ? (
    <AcceptedRecord status={status} payoutsLive={payoutsLive} />
  ) : (
    <UnacceptedStep status={status} agreement={agreement} onAccepted={setStatus} />
  );
}

/**
 * The blocking state.
 *
 * The four terms that cost a vendor money get the display treatment *above* the
 * prose, and that is the design intent rather than a flourish: a vendor who
 * reads only this panel has still read the commercially material terms. Every
 * figure in it comes from the constants — see `vendorAgreementTerms`.
 */
function UnacceptedStep({
  status,
  agreement,
  onAccepted,
}: {
  status: VendorAgreementStatus;
  agreement: LegalDocument;
  onAccepted: (status: VendorAgreementStatus) => void;
}): React.ReactElement {
  const request = useApi();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const terms = vendorAgreementTerms();
  const isNewVersion = status.accepted !== null;

  async function accept(submitted: React.FormEvent): Promise<void> {
    submitted.preventDefault();
    setFailed(false);
    setSaving(true);

    try {
      const next = await request('/vendor/agreement/accept', {
        method: 'POST',
        body: { version: status.current },
        schema: vendorAgreementStatusSchema,
      });

      onAccepted(next);
      /*
       * The dashboard's blocker banner reads this same state on the server, so
       * the cached shell has to be refreshed or a vendor who accepts here still
       * sees the blocker when they navigate back.
       */
      router.refresh();
    } catch {
      // The API's own words never reach a screen — `40-states.md`.
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[700px]">
      <OnboardingSteps current={3} />

      <h1 className="display-heading text-display-lg text-stone-900">The vendor agreement</h1>
      <p className="mt-2 text-sm leading-prose text-stone-600">
        Read this once and accept it. You cannot take payments until you have, because it is the
        agreement Stripe pays you under.
      </p>

      {isNewVersion ? (
        <Banner
          status="pending"
          title={`${status.current} replaces ${status.accepted?.version}`}
          className="mt-5"
        >
          The agreement has been revised. Your acceptance of {status.accepted?.version} stands on
          your record — accepting this one adds to it rather than replacing it.
        </Banner>
      ) : null}

      {failed ? (
        <Banner status="failed" title="That did not save" className="mt-5">
          Nothing has been recorded &mdash; try again.
        </Banner>
      ) : null}

      <section
        aria-labelledby="four-terms"
        className="mt-6 rounded-[14px] bg-stone-150 px-5.5 py-5"
      >
        <h2
          id="four-terms"
          className="mb-4 text-label font-semibold tracking-label text-stone-600 uppercase"
        >
          The four terms that cost you money
        </h2>
        <dl className="grid gap-x-6.5 gap-y-4.5 sm:grid-cols-2">
          {terms.map((term) => (
            <div key={term.label}>
              <dt className="text-label font-semibold tracking-label text-stone-600 uppercase">
                {term.label}
              </dt>
              <dd>
                {term.figure ? (
                  <p className="mt-1 font-display text-[27px] text-stone-900">{term.figure}</p>
                ) : null}
                <p className="mt-1 text-action leading-prose text-stone-700">{term.body}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/*
        The full agreement, clipped and expanded **in place**. Not a modal and
        not a navigation: onboarding state has to survive reading it, and a
        vendor who loses their place is a vendor who does not finish.
      */}
      <section
        aria-labelledby="full-agreement"
        className="mt-6 overflow-hidden rounded-panel border border-stone-300"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-300 bg-stone-50 px-4.5 py-3">
          <h2 id="full-agreement" className="text-cta font-semibold text-stone-900">
            Full agreement
          </h2>
          {/*
            Frame `32`'s header strip: `11 sections · v1.0 · 4 Jun 2026`. The
            date is formatted rather than printed as the frontmatter's ISO
            string — `2026-06-04` on a card a vendor is asked to accept reads
            as a system value that escaped.
          */}
          <p className="text-meta text-stone-600">
            {agreement.sections.length} sections · {status.current} ·{' '}
            {ACCEPTED_DAY.format(new Date(`${agreement.lastUpdated}T00:00:00Z`))}
          </p>
        </div>
        <div className="relative px-4.5 pt-4">
          {/*
            Clipped visually and **not** hidden from assistive technology. The
            first 150px are on screen either way, so `aria-hidden` would hide
            content a sighted vendor can already read — and a screen-reader user
            getting the whole agreement rather than a truncated one is the
            better outcome, not a worse one. `aria-expanded` on the control
            below still says which state the box is in.
          */}
          <div id="agreement-body" className={expanded ? '' : 'max-h-[150px] overflow-hidden'}>
            {agreement.sections.map((section) => (
              <section key={section.id} className="mb-6">
                <h3 className="mb-2.5 font-display text-[19px] text-stone-900">
                  {section.number}&nbsp;&nbsp;{section.title}
                </h3>
                <LegalBlocks blocks={section.blocks} />
              </section>
            ))}
          </div>
          {/* The 56px fade to the card fill, drawn only while the body is clipped. */}
          {expanded ? null : (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-b from-transparent to-stone-0"
            />
          )}
        </div>
        <div className="px-4.5 pt-2 pb-4">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="agreement-body"
            onClick={() => setExpanded((open) => !open)}
            className="cursor-pointer text-action font-semibold text-clay-500 underline-offset-4 hover:underline"
          >
            {expanded ? 'Collapse the agreement' : `Read all ${agreement.sections.length} sections`}
          </button>
          <p className="mt-1 text-helper text-stone-600">
            Opens in this step — you don&apos;t lose your place.
          </p>
        </div>
      </section>

      {/*
        `noValidate`, because this form owns its own submit: the browser's
        constraint validation runs first and cancels the submit event, so
        `accept` would never fire. #388, and the guard that keeps it true.
      */}
      <form onSubmit={accept} noValidate className="mt-6">
        {/*
          The label **names the business**, not just "I agree": the record says
          who accepted on whose behalf, and the control a vendor ticks should
          say the same thing the row will.
        */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.currentTarget.checked)}
            className="mt-1 size-4 flex-none appearance-none rounded-[4px] border-[1.3px] border-stone-400 bg-stone-0 checked:border-clay-400 checked:bg-clay-400 checked:after:block checked:after:text-center checked:after:text-[10px] checked:after:leading-[14px] checked:after:text-stone-0 checked:after:content-['✓']"
          />
          <span className="text-base leading-prose text-stone-800">
            I have read the vendor agreement and I accept it on behalf of{' '}
            <strong className="font-semibold">{status.businessName}</strong>. I understand{' '}
            {BRAND_NAME} retains {terms[0].figure} of each booking.
          </span>
        </label>

        <div className="mt-5">
          {/*
            `40-states.md`: a primary blocked by something takes the `clay-300`
            disabled fill and stays visible, rather than the primitive's opacity
            wash — the same override the checkout pay button makes.
          */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!agreed || saving}
            loading={saving}
            className="disabled:bg-clay-300 disabled:opacity-100"
          >
            {saving ? 'Recording…' : 'Accept and continue'}
          </Button>
          <p className="mt-2 text-helper text-stone-600">Next: connecting payouts.</p>
        </div>
      </form>
    </div>
  );
}

/**
 * The accepted state — a record, not a banner.
 *
 * Acceptance is not a toast that disappears: "which version did I agree to" is
 * a real question the moment the agreement changes, and this is where it is
 * answered. The table below lists **every** acceptance, because a new version
 * adds a row rather than replacing one.
 */
function AcceptedRecord({
  status,
  payoutsLive,
}: {
  status: VendorAgreementStatus;
  payoutsLive: boolean;
}): React.ReactElement {
  const accepted = status.accepted;
  const payoutTiming = vendorAgreementTerms()[1];

  return (
    <div className="max-w-[700px]">
      <h1 className="display-heading text-display-md text-stone-900">Agreements</h1>
      <p className="mt-1 text-sm leading-prose text-stone-600">
        What you have accepted, and when. A new version adds a row here rather than replacing one.
      </p>

      {accepted ? (
        <div className="mt-5 rounded-[14px] border border-sage-300 bg-sage-50 px-5 py-4.5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-stone-0 text-[11px] text-sage-600"
            >
              ✓
            </span>
            <div>
              <p className="text-cta font-semibold text-stone-900">
                Vendor agreement {accepted.version} — accepted
              </p>
              <p className="mt-1 text-sm leading-prose text-stone-700">
                Accepted{' '}
                <strong className="font-semibold">{ACCEPTED_AT.format(accepted.acceptedAt)}</strong>{' '}
                by {accepted.acceptedByName}, for {accepted.businessName}.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/*
        The payout strip. `PAYOUTS LIVE` is a claim about Stripe, so it is drawn
        from the payout status rather than from having accepted — a vendor can
        hold the agreement and still have no rail.
      */}
      <div className="mt-3.5 flex flex-wrap items-center gap-3 rounded-panel bg-stone-150 px-4.5 py-3.5">
        <span
          className={`rounded-full px-2.5 py-1.25 text-pill font-bold tracking-[.07em] uppercase ${
            payoutsLive ? 'bg-sage-100 text-sage-600' : 'bg-stone-200 text-stone-600'
          }`}
        >
          {payoutsLive ? 'Payouts live' : 'Payouts not connected'}
        </span>
        <p className="text-action leading-prose text-stone-700">
          {payoutsLive
            ? `Stripe Connect is verified. ${payoutTiming.body}`
            : `Connect payouts to be paid. ${payoutTiming.body}`}
        </p>
      </div>

      <table className="mt-6 w-full border-separate border-spacing-0 overflow-hidden rounded-panel border border-stone-300 text-left">
        <thead>
          <tr className="bg-stone-150">
            {['Document', 'Version', 'Accepted'].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="border-b border-stone-300 px-3.5 py-2.5 text-label font-semibold tracking-label text-stone-600 uppercase"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {status.history.map((row, index) => (
            <tr key={`${row.document}-${row.version}-${row.acceptedAt.toISOString()}`}>
              <td
                className={`px-3.5 py-3 text-action font-semibold text-stone-900 ${
                  index === status.history.length - 1 ? '' : 'border-b border-stone-200'
                }`}
              >
                {LEGAL_ACCEPTANCE_LABELS[row.document]}
              </td>
              <td
                className={`px-3.5 py-3 text-action text-stone-700 ${
                  index === status.history.length - 1 ? '' : 'border-b border-stone-200'
                }`}
              >
                {row.version}
              </td>
              <td
                className={`px-3.5 py-3 text-action text-stone-700 ${
                  index === status.history.length - 1 ? '' : 'border-b border-stone-200'
                }`}
              >
                {ACCEPTED_DAY.format(row.acceptedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
