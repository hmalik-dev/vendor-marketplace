'use client';

import { useState } from 'react';
import { LegalBlocks } from '@/components/legal/legal-blocks';
import type { LegalDocument } from '@/lib/legal-markdown';

/**
 * A legal document read **in place** — clipped, faded, and expanded without
 * leaving the screen it sits on.
 *
 * Both surfaces that ask somebody to accept something use this, and neither can
 * navigate away to show the text: the vendor agreement is step 3 of onboarding
 * and a vendor who loses their place is a vendor who does not finish, and the
 * Terms gate would bounce a reader straight back to itself. A modal loses the
 * same state for the same reason.
 *
 * The composition is frame `32`'s and is not parameterised — the header strip,
 * the 150px clip, the 56px fade and the expand control are the drawing. What
 * varies is only what the two documents are called.
 *
 * It exists as one component because it was briefly two. #429 copied the card
 * onto the acceptance gate and the copies had already drifted — different clip
 * heights, padding on different elements — which is the shape of divergence a
 * parity pass finds on one screen and not the other.
 */
export interface ExpandableDocumentCardProps {
  document: LegalDocument;
  /** The card's own heading — `Full agreement`, or the document's title. */
  heading: string;
  /** The line opposite it: `11 sections · v1.0 · 4 Jun 2026`. */
  meta: React.ReactNode;
  /** Distinct per instance, because two cards could share a document. */
  bodyId: string;
  headingId: string;
  /** What the control says once the document is open. */
  collapseLabel: string;
  /** The reassurance under it — which screen the reader does not leave. */
  helper: string;
}

export function ExpandableDocumentCard({
  document,
  heading,
  meta,
  bodyId,
  headingId,
  collapseLabel,
  helper,
}: ExpandableDocumentCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-labelledby={headingId}
      className="mt-6 overflow-hidden rounded-panel border border-stone-300"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-300 bg-stone-50 px-4.5 py-3">
        <h2 id={headingId} className="text-cta font-semibold text-stone-900">
          {heading}
        </h2>
        <p className="text-meta text-stone-600">{meta}</p>
      </div>
      <div className="relative px-4.5 pt-4">
        {/*
          Clipped visually and **not** hidden from assistive technology. The
          first 150px are on screen either way, so `aria-hidden` would hide
          content a sighted reader can already read — and a screen-reader user
          getting the whole document rather than a truncated one is the better
          outcome, not a worse one. `aria-expanded` on the control below still
          says which state the box is in.
        */}
        <div id={bodyId} className={expanded ? '' : 'max-h-[150px] overflow-hidden'}>
          {document.sections.map((section) => (
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
          aria-controls={bodyId}
          onClick={() => setExpanded((open) => !open)}
          className="cursor-pointer text-action font-semibold text-clay-500 underline-offset-4 hover:underline"
        >
          {expanded ? collapseLabel : `Read all ${document.sections.length} sections`}
        </button>
        <p className="mt-1 text-helper text-stone-600">{helper}</p>
      </div>
    </section>
  );
}
