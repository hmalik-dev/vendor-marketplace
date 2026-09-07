'use client';

import {
  BRAND_NAME,
  LEGAL_PATHS,
  termsAcceptanceStatusSchema,
  type TermsAcceptanceStatus,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ExpandableDocumentCard } from '@/components/legal/expandable-document-card';
import { ApiClientError } from '@/lib/api-client';
import type { LegalDocument } from '@/lib/legal-markdown';
import { useApi } from '@/lib/use-api';

/**
 * The first-sign-in acceptance gate — an unticked box the person ticks.
 *
 * **This is clickwrap, and the distinction is the whole point of the screen.**
 * Before it, accepting the Terms was a `Continue` press under a link nobody
 * opened — browsewrap, which is the form courts decline to enforce. A record
 * saying somebody accepted is worth nothing if the act it records is arriving.
 *
 * Three properties, each of which a shortcut would lose:
 *
 * - **The box starts unticked.** A pre-ticked box is not an affirmative act and
 *   is the single most common way a clickwrap record is thrown out. `useState`
 *   is seeded `false` and nothing else writes it.
 * - **The document is reachable from beside the box** — expanded in place here,
 *   and linked at `/terms` for a reader who wants it in its own tab. Neither
 *   leaves the screen or resets what has been ticked.
 * - **The submit carries the tick**, so the server refuses a submission that
 *   does not. The disabled button below is a courtesy to the reader; the rule
 *   is on the route.
 */
export interface AcceptTermsScreenProps {
  status: TermsAcceptanceStatus;
  /** The Terms themselves, parsed on the server from `content/legal/`. */
  terms: LegalDocument;
  /** Where the reader was going before the gate, already validated. */
  returnTo: string | null;
}

export function AcceptTermsScreen({
  status,
  terms,
  returnTo,
}: AcceptTermsScreenProps): React.ReactElement {
  const request = useApi();
  const router = useRouter();

  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function accept(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    if (!agreed || saving) {
      return;
    }

    setSaving(true);
    setFailed(null);

    try {
      await request('/legal/terms/accept', {
        method: 'POST',
        body: { version: status.current, accepted: true },
        schema: termsAcceptanceStatusSchema,
      });

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
    } catch (error) {
      setSaving(false);
      setFailed(
        error instanceof ApiClientError && error.statusCode === 409
          ? 'The Terms were updated while this page was open. Reload and read them before accepting.'
          : 'Nothing has been recorded — try again.',
      );
    }
  }

  return (
    <div className="mx-auto max-w-[700px] px-6 py-13">
      <p className="text-label font-semibold tracking-label text-stone-600 uppercase">Legal</p>
      <h1 className="display-heading mt-2 text-display-md text-stone-900">
        Before you start, the Terms
      </h1>
      <p className="mt-2 text-sm leading-prose text-stone-600">
        Everyone using {BRAND_NAME} accepts these once. We record that you did — the version, the
        moment, and this browser — so both sides can say what was agreed.
      </p>

      {failed ? (
        <Banner status="failed" title="That did not save" className="mt-5">
          {failed}
        </Banner>
      ) : null}

      {/*
        The document, clipped and expanded **in place**. Not a navigation and
        not a modal: a reader who opens the Terms must not lose the tick they
        have already made, and must not be dropped somewhere the gate then
        bounces them back from.
      */}
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

      {/*
        `noValidate`, because this form owns its own submit: the browser's
        constraint validation runs first and cancels the submit event, so
        `accept` would never fire. #388, and the guard that keeps it true.
      */}
      <form onSubmit={accept} noValidate className="mt-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.currentTarget.checked)}
            className="mt-1 size-4 flex-none appearance-none rounded-[4px] border-[1.3px] border-stone-400 bg-stone-0 checked:border-clay-400 checked:bg-clay-400 checked:after:block checked:after:text-center checked:after:text-[10px] checked:after:leading-[14px] checked:after:text-stone-0 checked:after:content-['✓']"
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
            disabled={!agreed || saving}
            loading={saving}
            className="disabled:bg-clay-300 disabled:opacity-100"
          >
            {saving ? 'Recording…' : 'Accept and continue'}
          </Button>
          <p className="mt-2 text-helper text-stone-600">
            We record the moment, this browser and its address, so the record means something later.
          </p>
        </div>
      </form>
    </div>
  );
}
