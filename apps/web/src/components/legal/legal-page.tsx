import { LEGAL_JUMP_RAIL_MIN_SECTIONS } from '@vendor-marketplace/shared';
import type { LegalDocument } from '@/lib/legal-markdown';
import { LegalBlocks } from './legal-blocks';
import { JumpRail } from './jump-rail';

/**
 * The date a legal page states it was last updated.
 *
 * UTC, and from the frontmatter — a date rendered in the reader's zone slips a
 * day for half the planet, and "last updated 3 June" against a file that says
 * the 4th is the kind of discrepancy this page exists not to have.
 */
const LAST_UPDATED = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The reading layout — frame `31`, and unlike every other screen in this
 * product **the page scrolls, not a pane**.
 *
 * There is no app shell here and no fixed height: this is the marketplace's
 * public face, so it takes the site header and the marketing footer from the
 * root layout and simply runs down the page. `04-laws.md`'s 1.0x scroll budget
 * is a law about app screens, and a Terms of Service that fits one screen is a
 * Terms of Service nobody wrote.
 *
 * The prose scale is its own: **15px/1.85 on a 660px measure**, explicitly not
 * the app's 13.5px/1.6, which is unreadable at this length.
 */
export function LegalPage({ document }: { document: LegalDocument }): React.ReactElement {
  const showRail = document.sections.length >= LEGAL_JUMP_RAIL_MIN_SECTIONS;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] justify-center gap-14 px-5 pt-13 pb-20 lg:px-10">
      {/*
        Offset to the first section heading rather than to the title, so the
        rail's first row lines up with the section it names.
      */}
      {showRail ? (
        <div className="hidden w-[212px] flex-none pt-24 lg:block">
          <JumpRail
            sections={document.sections.map(({ number, title, id }) => ({ number, title, id }))}
          />
        </div>
      ) : null}

      {/*
        660px, and `w-full` under it so the measure narrows rather than
        overflowing at 390. With no rail the column is simply centred — the
        cookie notice re-centres its measure rather than leaving a hole where
        a rail it does not have would be.
      */}
      <article className="w-full max-w-[660px]">
        <p className="mb-2.75 text-label font-semibold tracking-label text-stone-600 uppercase">
          Legal
        </p>
        <h1 className="mb-3.25 font-display text-[44px] leading-[1.06] tracking-[-.015em] text-stone-900">
          {document.title}
        </h1>
        <div className="mb-8.5 flex flex-wrap items-center gap-3 border-b border-stone-300 pb-6.5 text-sm text-stone-600">
          <span>
            Last updated{' '}
            <strong className="font-semibold text-stone-700">
              {LAST_UPDATED.format(new Date(`${document.lastUpdated}T00:00:00Z`))}
            </strong>
          </span>
          {document.note ? (
            <>
              <span aria-hidden="true" className="text-stone-500">
                ·
              </span>
              <span>{document.note}</span>
            </>
          ) : null}
        </div>

        <LegalBlocks blocks={document.lead} />

        {document.sections.map((section) => (
          <section key={section.id} className="mb-7.5">
            {/*
              **The number is part of the heading, not a decoration.** Stripe,
              vendors and support all cite these by number, so "section 5" has
              to mean something and has to keep meaning it. The `id` is the
              slug, never the counter — these are public URLs people paste into
              email, and an inserted section must not move them.

              `scroll-mt` clears the fixed site header, so following a link to
              `#cancellations-and-refunds` does not land the heading underneath
              it.
            */}
            <h2
              id={section.id}
              className="mb-3 scroll-mt-24 font-display text-[24px] text-stone-900"
            >
              {section.number}&nbsp;&nbsp;{section.title}
            </h2>
            <LegalBlocks blocks={section.blocks} />
          </section>
        ))}
      </article>

      {/*
        The frame's own right-hand spacer, and it is **56px, not another 212**:
        frame `31` draws `rail 212 · gap 56 · measure 660 · gap 56 · spacer 56`
        and centres that, which puts the measure right of centre rather than on
        it. A mirrored 212 centres the measure instead and moves the whole
        composition 40px left of the frame.
      */}
      {showRail ? <div className="hidden w-14 flex-none lg:block" aria-hidden="true" /> : null}
    </div>
  );
}
