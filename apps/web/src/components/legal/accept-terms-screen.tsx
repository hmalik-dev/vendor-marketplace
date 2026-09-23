'use client';

import {
  BRAND_NAME,
  ERROR_CODES,
  LEGAL_PATHS,
  SUPPORT_PATH,
  VENDOR_DETAILS_PATH,
  termsAcceptanceStatusSchema,
  type TermsAcceptanceStatus,
  type UserRole,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ContinueNotice } from '@/components/legal/continue-notice';
import { ExpandableDocumentCard } from '@/components/legal/expandable-document-card';
import { ApiClientError } from '@/lib/api-client';
import { signOut } from '@/lib/auth/auth-requests';
import type { LegalDocument } from '@/lib/legal-markdown';
import { terminalRefusal } from '@/lib/terms-gate-paths';
import { useApi } from '@/lib/use-api';

/**
 * The first screen after verification — two screens under one route.
 *
 * **First acceptance (VEN-507): the role, then continue under a notice.** The
 * sign-up form tells the person their choice can't be changed later, so this
 * screen never asks it again: the role the server recorded at sign-up
 * (VEN-662) — on whatever device the person verifies — is stated read-only,
 * from the server render, and the server creates the account with it, the
 * account and the acceptance in one transaction. A session with no recorded
 * role (it expired, or its record failed) is told to contact support and can
 * send nothing: no role is ever defaulted here. There is **no checkbox**: "By continuing you agree to the
 * Terms and Privacy Policy" sits under the submit, and the row is recorded as a
 * `continue_notice`, never as a ticked box. An account that already exists shows
 * its stored role read-only: nothing here can change it.
 *
 * **A new Terms version (`explicitTickRequired`) is the one tick.** An account
 * that accepted an earlier version is asked again with an unticked box, and that
 * is clickwrap:
 *
 * - **The box starts unticked.** A pre-ticked box is not an affirmative act.
 *   `useState` is seeded `false` and nothing else writes it.
 * - **The document is reachable from beside the box** — expanded in place here,
 *   and linked at `/terms` for a reader who wants it in its own tab.
 * - **The submit carries the tick**, so the server refuses a submission that
 *   does not. The disabled button is a courtesy; the rule is on the route.
 */
export interface AcceptTermsScreenProps {
  status: TermsAcceptanceStatus;
  /** The Terms themselves, parsed on the server from `content/legal/`. */
  terms: LegalDocument;
  /** Where the reader was going before the gate, already validated. */
  returnTo: string | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'a customer',
  vendor: 'a vendor',
  admin: 'an operator',
};

export function AcceptTermsScreen({
  status,
  terms,
  returnTo,
}: AcceptTermsScreenProps): React.ReactElement {
  const request = useApi();
  const router = useRouter();

  /* A new version asks for the tick; a first acceptance states the role and continues under a notice. */
  const tickMode = status.explicitTickRequired;
  /*
   * A role already decided — stored on the account, or recorded at sign-up —
   * is stated, never asked. Both come from the server render, so there is no
   * mount effect and nothing to flash.
   */
  const knownRole = tickMode
    ? null
    : status.account.exists
      ? status.account.role
      : status.signUpRole;
  const inFlight = useRef(false);

  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /* The role the server stored when it differs from the one stated: shown before continuing. */
  const [landedAs, setLandedAs] = useState<UserRole | null>(null);

  function continueOn(): void {
    /*
     * Back through `/after-sign-in` rather than straight to `returnTo`: the
     * account row exists only now, so this is the first moment its role can
     * be resolved, and that handler is the one place that knows where each
     * role starts and re-validates the destination before sending anybody to
     * it. `replace`, so Back does not return to a gate already cleared.
     *
     * A full load, not `router.replace`: the root layout's header was drawn
     * while the account row could not be read, and a client navigation keeps
     * it as drawn. `router.refresh()` straight after the replace is no answer —
     * the refresh supersedes the navigation, which never commits, and the
     * screen stays on "Recording…" (seen on a lane, VEN-678).
     */
    window.location.replace(
      returnTo ? `/after-sign-in?returnTo=${encodeURIComponent(returnTo)}` : '/after-sign-in',
    );
  }

  const ready = tickMode ? agreed : knownRole !== null;

  async function accept(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    /* A ref, not the `saving` state: a double-click lands before the re-render. */
    if (!ready || saving || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setFailed(null);

    try {
      const result = await request('/legal/terms/accept', {
        method: 'POST',
        /*
         * The tick for a new version; otherwise the version alone. No role is
         * sent: the server creates the account with the one it recorded at
         * sign-up (VEN-662).
         */
        body: tickMode ? { version: status.current, accepted: true } : { version: status.current },
        schema: termsAcceptanceStatusSchema,
      });

      /*
       * What the server stored is what counts. When it is not what this
       * screen stated, say so before moving on: the choice cannot be changed
       * later, and continuing silently would hide which side of the product
       * this account is on.
       */
      const stored = result.account.role;

      if (!tickMode && stored !== null && stored !== knownRole) {
        inFlight.current = false;
        setSaving(false);
        setLandedAs(stored);
        return;
      }

      continueOn();
    } catch (error) {
      inFlight.current = false;

      /*
       * The vendor gate (VEN-406): no account was created for this address.
       * The API has already written the waitlist row for it (VEN-512), so
       * there is nothing left to ask here — on to the details screen, rather
       * than staying to explain the refusal. The server keeps the recorded
       * role: a return visit still reads as "this person is a vendor".
       */
      if (error instanceof ApiClientError && error.code === ERROR_CODES.VENDOR_NOT_INVITED) {
        router.replace(VENDOR_DETAILS_PATH);
        return;
      }

      const refusal = terminalRefusal(error);

      if (refusal === 'suspended') {
        router.replace('/suspended');
        return;
      }

      if (refusal === 'signed-out') {
        // A session the API no longer honours: end it, so sign-in is a fresh one.
        const leave = (): void => window.location.assign('/sign-in');
        void signOut().then(leave, leave);
        return;
      }

      setSaving(false);
      setFailed(
        error instanceof ApiClientError && error.statusCode === 409
          ? 'The Terms were updated while this page was open. Reload and read them before accepting.'
          : 'Nothing has been recorded — try again.',
      );
    }
  }

  if (landedAs !== null) {
    return (
      <div className="mx-auto max-w-[700px] px-6 py-13">
        <h1 className="display-heading text-display-md text-stone-900">
          This account is {ROLE_LABELS[landedAs]}
        </h1>
        <p className="mt-2 text-sm leading-prose text-stone-600">
          This account was set up as {ROLE_LABELS[landedAs]}, and that can&apos;t be changed later.
          To switch, close the account and register again.
        </p>
        <Button variant="primary" size="lg" className="mt-6" onClick={continueOn}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[700px] px-6 py-13">
      {tickMode ? (
        <>
          <p className="text-label font-semibold tracking-label text-stone-600 uppercase">Legal</p>
          <h1 className="display-heading mt-2 text-display-md text-stone-900">
            The Terms have changed
          </h1>
          <p className="mt-2 text-sm leading-prose text-stone-600">
            Everyone using {BRAND_NAME} accepts the current Terms. We record that you did — the
            version, the moment, and this browser — so both sides can say what was agreed.
          </p>
        </>
      ) : (
        <h1 className="display-heading text-display-md text-stone-900">{`Welcome to ${BRAND_NAME}`}</h1>
      )}

      {failed ? (
        <Banner status="failed" title="That did not save" className="mt-5">
          {failed}
        </Banner>
      ) : null}

      {tickMode ? null : knownRole !== null ? (
        <p className="mt-6 text-base leading-prose text-stone-800" data-testid="stored-role">
          You&apos;re joining as {ROLE_LABELS[knownRole]}. This can&apos;t be changed later. To
          switch, close the account and register again.
        </p>
      ) : (
        /*
          No recorded role: it expired, or the sign-up could not store it. Signing
          up again would meet "already exists", so the way on is support, never a
          picker and never a default.
        */
        <Banner status="failed" title="We couldn't find how you're joining" className="mt-6">
          The choice you made at sign-up wasn&apos;t saved with this account, so it can&apos;t be
          set up from here.{' '}
          <a
            href={SUPPORT_PATH}
            className="font-semibold text-clay-600 underline underline-offset-4"
          >
            Contact support
          </a>{' '}
          and we&apos;ll finish it for you.
        </Banner>
      )}

      {tickMode ? (
        /*
          The document, clipped and expanded **in place**. Not a navigation and
          not a modal: a reader who opens the Terms must not lose the tick they
          have already made, and must not be dropped somewhere the gate then
          bounces them back from.
        */
        <ExpandableDocumentCard
          document={terms}
          heading={terms.title}
          headingId="terms-heading"
          bodyId="terms-body"
          meta={
            <>
              {terms.sections.length} sections &middot; {status.current}
            </>
          }
          collapseLabel="Collapse the Terms"
          helper="Opens here — you don't lose your place."
        />
      ) : null}

      {/*
        `noValidate`, because this form owns its own submit: the browser's
        constraint validation runs first and cancels the submit event, so
        `accept` would never fire. #388, and the guard that keeps it true.
      */}
      <form onSubmit={accept} noValidate className="mt-6">
        {tickMode ? (
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.currentTarget.checked)}
              className="mt-1 size-4 flex-none appearance-none rounded-[4px] border-[1.3px] border-stone-560 bg-stone-0 checked:border-clay-400 checked:bg-clay-400 checked:after:block checked:after:text-center checked:after:text-[10px] checked:after:leading-[14px] checked:after:text-stone-0 checked:after:content-['✓']"
            />
            <span className="text-base leading-prose text-stone-800">
              I have read and I accept the{' '}
              <a
                href={LEGAL_PATHS.terms}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-clay-500 underline underline-offset-4"
              >
                Terms of Service
              </a>{' '}
              {status.current}.
            </span>
          </label>
        ) : null}

        <div className="mt-5">
          {/*
            `40-states.md`: a primary blocked by something takes the `clay-300`
            disabled fill and stays visible, rather than the primitive's opacity
            wash — the same override the agreement step makes.
          */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!ready || saving}
            loading={saving}
            className="disabled:bg-clay-300 disabled:opacity-100"
          >
            {saving ? 'Recording…' : tickMode ? 'Accept and continue' : 'Continue'}
          </Button>
          {tickMode ? null : <ContinueNotice className="mt-3 text-left" />}
          <p className="mt-2 text-helper text-stone-600">
            We record the moment, this browser and its address, so the record means something later.
          </p>
        </div>
      </form>
    </div>
  );
}
