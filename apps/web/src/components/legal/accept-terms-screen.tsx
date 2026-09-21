'use client';

import {
  BRAND_NAME,
  ERROR_CODES,
  LEGAL_PATHS,
  VENDOR_APPLY_PATH,
  termsAcceptanceStatusSchema,
  type TermsAcceptanceStatus,
  type UserRole,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ContinueNotice } from '@/components/legal/continue-notice';
import { ExpandableDocumentCard } from '@/components/legal/expandable-document-card';
import { ApiClientError } from '@/lib/api-client';
import { signOut } from '@/lib/auth/auth-requests';
import {
  clearSignUpRole,
  readSignUpRole,
  rememberSignUpRole,
  type SignUpRole,
} from '@/lib/auth/signup-role';
import { cn } from '@/lib/utils';
import type { LegalDocument } from '@/lib/legal-markdown';
import { terminalRefusal } from '@/lib/terms-gate-paths';
import { useApi } from '@/lib/use-api';

/**
 * The first screen after verification — two screens under one route.
 *
 * **First acceptance (VEN-507): confirm the role, continue under a notice.**
 * The choice made at sign-up is only a hint, so this screen asks again —
 * preselecting the hint, or the invite's `vendor`, and otherwise nothing — and
 * the server stores what is submitted here, with the account and the acceptance
 * in one transaction. There is **no checkbox**: "By continuing you agree to the
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

/*
 * The same two cards the sign-up form draws (`ROLE_CHOICES`), so the choice
 * looks the same one step apart: clay for the customer, sage for the vendor.
 */
const ROLE_OPTIONS: readonly {
  role: SignUpRole;
  title: string;
  description: string;
  glyph: 'square' | 'circle';
  selectedCard: string;
  selectedGlyph: string;
}[] = [
  {
    role: 'customer',
    title: "I'm planning an event",
    description: 'Find and book vendors near you.',
    glyph: 'square',
    selectedCard: 'border-2 border-clay-400 bg-clay-100',
    selectedGlyph: 'border-clay-500',
  },
  {
    role: 'vendor',
    title: "I'm a vendor",
    description: 'List your services and take bookings.',
    glyph: 'circle',
    selectedCard: 'border-2 border-sage-400 bg-sage-50',
    selectedGlyph: 'border-sage-600',
  },
];

export function AcceptTermsScreen({
  status,
  terms,
  returnTo,
}: AcceptTermsScreenProps): React.ReactElement {
  const request = useApi();
  const router = useRouter();

  /* A new version asks for the tick; a first acceptance asks for the role and continues under a notice. */
  const tickMode = status.explicitTickRequired;
  const storedRole = !tickMode && status.account.exists ? status.account.role : null;
  const inFlight = useRef(false);

  const [role, setRole] = useState<SignUpRole | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [notInvited, setNotInvited] = useState(false);
  /* The role the server stored when it differs from the one chosen: shown before continuing. */
  const [landedAs, setLandedAs] = useState<UserRole | null>(null);

  /*
   * Preselection is read after mount, never during render: `localStorage` does
   * not exist on the server, so reading it in the initial state would render
   * one thing there and another on hydration. Order: the browser hint (under a
   * day old, validated by `readSignUpRole`), then the invite's `vendor`, then
   * nothing — never a default. A choice the person already made is kept.
   */
  useEffect(() => {
    if (!tickMode && storedRole === null) {
      setRole((chosen) => chosen ?? readSignUpRole() ?? status.suggestedRole);
    }
  }, [tickMode, storedRole, status.suggestedRole]);

  function choose(next: SignUpRole): void {
    setRole(next);
    setNotInvited(false);
    /* Kept as the hint, so a reload lands on the same choice. It is still only a hint. */
    rememberSignUpRole(next);
  }

  function continueOn(): void {
    /*
     * Back through `/after-sign-in` rather than straight to `returnTo`: the
     * account row exists only now, so this is the first moment its role can
     * be resolved, and that handler is the one place that knows where each
     * role starts and re-validates the destination before sending anybody to
     * it. `replace`, so Back does not return to a gate already cleared.
     */
    router.replace(
      returnTo ? `/after-sign-in?returnTo=${encodeURIComponent(returnTo)}` : '/after-sign-in',
    );
  }

  const ready = tickMode ? agreed : storedRole !== null || role !== null;

  async function accept(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    /* A ref, not the `saving` state: a double-click lands before the re-render. */
    if (!ready || saving || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setFailed(null);
    setNotInvited(false);

    try {
      const result = await request('/legal/terms/accept', {
        method: 'POST',
        /*
         * The tick for a new version; otherwise the role confirmed on this
         * screen, left out for an account that already exists (the server
         * ignores it there, and the screen shows the stored one).
         */
        body: tickMode
          ? { version: status.current, accepted: true }
          : {
              version: status.current,
              ...(storedRole === null && role !== null ? { role } : {}),
            },
        schema: termsAcceptanceStatusSchema,
      });

      /* Accepted: the hint has done its job, and only now. */
      clearSignUpRole();

      /*
       * What the server stored is what counts. When it is not what was chosen
       * (another tab won the race), say so before moving on: the choice cannot
       * be changed later, and continuing silently would hide which side of the
       * product this account is on.
       */
      const stored = result.account.role;

      if (!tickMode && storedRole === null && role !== null && stored !== null && stored !== role) {
        inFlight.current = false;
        setSaving(false);
        setLandedAs(stored);
        return;
      }

      continueOn();
    } catch (error) {
      /*
       * The vendor gate (VEN-406): no account was created for this address, so
       * the person stays here, signed in and with the choice intact, to pick
       * customer instead or to apply. Neither the session nor the hint is
       * cleared: doing so would let a return visit quietly choose for them.
       */
      inFlight.current = false;

      if (error instanceof ApiClientError && error.code === ERROR_CODES.VENDOR_NOT_INVITED) {
        setSaving(false);
        setNotInvited(true);
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
          Another tab set this account up as {ROLE_LABELS[landedAs]} a moment before this one, and
          that can&apos;t be changed later. To switch, close the account and register again.
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
        <>
          <p className="text-label font-semibold tracking-label text-stone-600 uppercase">
            One last step
          </p>
          <h1 className="display-heading mt-2 text-display-md text-stone-900">
            Confirm how you&apos;re joining
          </h1>
        </>
      )}

      {failed ? (
        <Banner status="failed" title="That did not save" className="mt-5">
          {failed}
        </Banner>
      ) : null}

      {notInvited ? (
        <Banner status="failed" title="Vendor accounts are by invitation for now" className="mt-5">
          Nothing was created. Choose customer to continue, or{' '}
          <Link href={VENDOR_APPLY_PATH} className="font-semibold underline underline-offset-4">
            apply to become a vendor
          </Link>
          .
        </Banner>
      ) : null}

      {tickMode ? null : storedRole !== null ? (
        <p className="mt-6 text-base leading-prose text-stone-800" data-testid="stored-role">
          You&apos;re joining as {ROLE_LABELS[storedRole]}. This can&apos;t be changed later. To
          switch, close the account and register again.
        </p>
      ) : (
        <fieldset className="mt-6">
          <legend className="text-label font-semibold tracking-label text-stone-600 uppercase">
            How are you joining?
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ROLE_OPTIONS.map((option) => {
              const selected = role === option.role;

              return (
                <label
                  key={option.role}
                  className={cn(
                    'cursor-pointer rounded-xl px-3.5 py-4 transition-colors duration-(--duration-fast)',
                    'has-focus-visible:ring-2 has-focus-visible:ring-clay-400/40 has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-stone-50',
                    selected
                      ? option.selectedCard
                      : 'border border-stone-300 bg-stone-0 hover:border-stone-400',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.role}
                    checked={selected}
                    onChange={() => choose(option.role)}
                    data-focus-own
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mb-2.5 flex size-8.5 items-center justify-center rounded-full',
                      selected ? 'bg-stone-0' : 'bg-stone-150',
                    )}
                  >
                    <span
                      className={cn(
                        'block size-3.25 border-[1.6px]',
                        option.glyph === 'circle' ? 'rounded-full' : 'rounded-[3px]',
                        selected ? option.selectedGlyph : 'border-stone-600',
                      )}
                    />
                  </span>
                  <span className="block text-[14.5px] font-semibold text-stone-900">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-[12px] leading-normal text-stone-700">
                    {option.description}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-3 text-helper text-stone-600" aria-live="polite">
            {role
              ? `You're joining as ${ROLE_LABELS[role]}. This can't be changed later. To switch, close the account and register again.`
              : "Choose one to continue. This can't be changed later."}
          </p>
        </fieldset>
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
