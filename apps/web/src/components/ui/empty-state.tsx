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
  className,
}: EmptyStateProps): React.ReactElement {
  const isMarketing = scale === 'marketing';

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
          className={cn('text-stone-400 [&_svg]:size-8', panel && 'mb-[18px]')}
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
      <h2
        className={cn(
          'font-display text-stone-900',
          isMarketing ? 'text-display-empty' : 'text-display-md',
          panel && 'mb-2.25',
        )}
      >
        {headline}
      </h2>
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
