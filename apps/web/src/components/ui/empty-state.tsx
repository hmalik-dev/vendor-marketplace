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
      <span className="absolute top-0 left-[22px] size-9 rounded-full border border-dashed border-stone-400" />
    </span>
  );
}

export interface EmptyStateProps {
  /** A muted geometric glyph — a 32px lucide icon, not an illustration. */
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
  className?: string;
}

/**
 * Glyph, Serif headline, one sentence saying what will appear here, one CTA.
 * Never a blank pane.
 *
 * See design/design-plan/03-components.md.
 */
export function EmptyState({
  icon,
  headline,
  description,
  action,
  panel = false,
  className,
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
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
        <span aria-hidden="true" className="text-stone-400 [&_svg]:size-8">
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
      <h2 className="font-display text-display-md text-stone-900">{headline}</h2>
      <p className="max-w-[420px] text-base leading-prose text-stone-700">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
