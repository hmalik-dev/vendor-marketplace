import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The frames' empty-state glyph: two 36px circles, one filled and one dashed,
 * overlapping by 14px in a 58x36 box — `40-states.md` names it as *the* muted
 * geometric glyph, and frame `20` draws it above `No requests yet`.
 *
 * Circles rather than a lucide icon because there is no icon in the set that
 * says "nothing has arrived" without also saying what *kind* of thing.
 */
export function EmptyStateGlyph(): React.ReactElement {
  return (
    <span aria-hidden="true" className="relative block h-9 w-[58px]">
      <span className="absolute top-0 left-0 size-9 rounded-full bg-stone-150" />
      <span className="absolute top-0 left-[22px] size-9 rounded-full border-[1.5px] border-dashed border-stone-400" />
    </span>
  );
}

/**
 * Frame `18`'s twin-ring mark — the *search* empty state's glyph, and only it.
 *
 * Two outlined circles rather than `EmptyStateGlyph`'s filled-plus-dashed pair:
 * `18` draws `1.5px solid #D5CEC2` and `1.5px dashed #D5CEC2` at `stone-400`,
 * offset by 24px in a 62x38 box, where `19`/`20` draw a `stone-150` fill beside
 * a solid ring in 58x36. Different marks for different states, so this is its
 * own component rather than a variant prop nobody would find.
 *
 * The ladder is the frames' own: `27 Search — no results · 1024` draws the same
 * mark at 54x33 with a 21px offset and 14px of clearance, `18` at 62x38 with 24
 * and 20. The margin is carried here because it is part of the mark's measured
 * geometry, and it lands on top of `EmptyState`'s uniform 12px stack gap —
 * 12 + 2 = 14 at 1024, 12 + 8 = 20 at 1440.
 *
 * Replaced a 32x32 `lucide-search-x` (#417 item 2), which was an icon saying
 * "search failed" where the frame draws the product's own empty mark.
 */
export function SearchEmptyGlyph(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="relative mb-0.5 block h-[33px] w-[54px] min-[90rem]:mb-2 min-[90rem]:h-9.5 min-[90rem]:w-[62px]"
    >
      <span className="absolute top-0 left-0 size-[33px] rounded-full border-[1.5px] border-stone-400 min-[90rem]:size-9.5" />
      <span className="absolute top-0 left-[21px] size-[33px] rounded-full border-[1.5px] border-dashed border-stone-400 min-[90rem]:left-6 min-[90rem]:size-9.5" />
    </span>
  );
}

export interface EmptyStateProps {
  /**
   * The muted geometric glyph above the headline.
   *
   * **Defaults to `EmptyStateGlyph`, and that default is the point.**
   * `40-states.md` lists the glyph as part of the state, not as decoration —
   * yet seven of the nine call sites omitted it, because an optional prop is
   * one a caller forgets. Making it the default means a tenth caller gets it
   * without knowing it exists.
   *
   * Pass a lucide icon to say something more specific (search passes `SearchX`).
   * Passing `null` removes it, which is deliberate, visible in review, and
   * guarded by a test — not something that can happen by omission.
   */
  icon?: ReactNode;
  headline: string;
  description: string;
  /** One primary action. Imperative, 2-4 words. */
  action?: ReactNode;
  /**
   * Draw the state as a bordered panel that fills its container, as frame `20`
   * draws the vendor dashboard's request pane: a dashed `stone-400` hairline
   * at an 18px radius on `stone-0`.
   *
   * Opt-in rather than the default because most empty states sit *inside* a
   * card that already draws the border — a second one would double it.
   */
  panel?: boolean;
  /**
   * Which of the two sizes `40-states.md` names this state is drawn at.
   *
   * The law is one sentence with two numbers in it — "headline at 26px in-app /
   * 30px marketing" — so the component carries both rather than letting call
   * sites override a single default by hand. `marketing` widens the sentence to
   * the 520px measure frame `18` draws with it; `app` keeps the 420px one.
   *
   * The search no-results state is the marketing size because the screen is
   * public: it is the first thing an unauthenticated visitor sees fail.
   */
  scale?: 'app' | 'marketing';
  /**
   * Which of `40-states.md`'s colour semantics this state carries.
   *
   * `neutral` is an empty state: nothing went wrong, there is simply nothing
   * here. `failure` is the law's red — *"Red `error-50 / error-500` — it
   * failed"* — and exists because a failed request and an empty result were
   * rendering identically, so a backend outage read as "nobody matches your
   * filters" (#368).
   *
   * Opt-in, and it tints the glyph only. No frame draws a failure state, so
   * there is nothing to match on the layout axis, and a colour-only change
   * cannot move a screen that a frame *does* draw. Red is never used for
   * `pending`, and gold is never used for a failure.
   */
  tone?: 'neutral' | 'failure';
  /**
   * The heading level the headline renders at. `2` everywhere but one place.
   *
   * `1` exists for a state that *replaces* the page's own `<h1>` rather than
   * sitting under it. `/search` is the case: the count row carries the
   * document's heading — `17 photographers in Austin`, or `Searching…` while a
   * query is in flight — and frame `18` opens straight into the empty state
   * with no count row above it, so at zero results the route rendered no level
   * -1 heading at all. Confirmed through the accessibility tree, not
   * `querySelector`: `getByRole('heading', { level: 1 })` returned nothing on
   * the empty state and one node on the populated one.
   *
   * A number rather than a `Tag` prop, so a caller cannot pass a `<div>`.
   */
  headingLevel?: 1 | 2;
  className?: string;
}

/**
 * Glyph, Serif headline, one sentence saying what will appear here, one CTA.
 * Never a blank pane.
 *
 * See design/design-plan/03-components.md.
 */
export function EmptyState({
  icon = <EmptyStateGlyph />,
  headline,
  description,
  action,
  panel = false,
  scale = 'app',
  tone = 'neutral',
  headingLevel = 2,
  className,
}: EmptyStateProps): React.ReactElement {
  const isMarketing = scale === 'marketing';
  const Headline = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        // Frame 20 spaces the panel's stack 18 / 9 / 18, which the uniform
        // 12px gap cannot express; everywhere else keeps the even rhythm.
        panel ? 'gap-0' : 'gap-3',
        // The panel owns the pane it is given, so its padding is horizontal
        // only — frame `20` centres the content in the full height rather
        // than pushing it down from the top.
        panel
          ? 'h-full rounded-2xl border border-dashed border-stone-400 bg-stone-0 px-10'
          : 'px-6 py-12',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            '[&_svg]:size-8',
            tone === 'failure' ? 'text-error-500' : 'text-stone-400',
            panel && 'mb-[18px]',
          )}
        >
          {icon}
        </span>
      ) : null}
      {/*
        26px, not 21px. 40-states.md fixes the in-app empty-state headline at
        26px (30px on marketing), and frame 20 draws it there. The role sets no
        tracking, so the family hook is used on its own rather than the tracked
        display-heading role.

        Backticks are deliberately absent above: display-type.test.ts reads
        backtick spans as template literals, so quoting a serif class name in a
        comment registers as a serif element with no size.
      */}
      <Headline
        className={cn(
          'font-display text-stone-900',
          isMarketing ? 'text-display-empty' : 'text-display-md',
          panel && 'mb-2.25',
        )}
      >
        {headline}
      </Headline>
      <p
        className={cn(
          'text-base leading-prose text-stone-700',
          isMarketing ? 'max-w-[520px]' : 'max-w-[420px]',
          panel && 'mb-[18px]',
        )}
      >
        {description}
      </p>
      {action ? <div className={panel ? undefined : 'mt-2'}>{action}</div> : null}
    </div>
  );
}
