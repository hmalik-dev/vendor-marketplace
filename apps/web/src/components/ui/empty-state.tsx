import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Glyph, Serif headline, one sentence saying what will appear here, one CTA.
 * Never a blank pane.
 *
 * See design/design-plan/03-components.md.
 */
export interface EmptyStateProps {
  /** A muted geometric glyph — a 32px lucide icon, not an illustration. */
  icon?: ReactNode;
  headline: string;
  description: string;
  /** One primary action. Imperative, 2-4 words. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  headline,
  description,
  action,
  className,
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="text-stone-400 [&_svg]:size-8">
          {icon}
        </span>
      ) : null}
      <h2 className="font-display text-display-sm text-stone-900">{headline}</h2>
      <p className="max-w-sm text-base leading-prose text-stone-700">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
