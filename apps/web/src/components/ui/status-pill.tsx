import { cn } from '@/lib/utils';

/**
 * The seven-status vocabulary in design/design-plan/03-components.md.
 *
 * Status is never colour alone — the pill's text is always present, so the
 * meaning survives for anyone who cannot separate the hues.
 */
export const STATUS_TONES = {
  /** Waiting on the other party. */
  pending: 'bg-gold-50 text-gold-600',
  /** The vendor sent a number. */
  quoted: 'bg-steel-50 text-steel-600',
  /** Waiting on *this* user — the only tone that spends clay. */
  needsYou: 'bg-clay-100 text-clay-600',
  /** Settled. */
  confirmed: 'bg-sage-50 text-sage-600',
  /** Done. */
  completed: 'bg-sage-100 text-sage-600',
  /** Inert: declined, paused, expired. */
  inert: 'bg-stone-200 text-stone-600',
  /** Went wrong: cancelled, flagged. */
  failed: 'bg-error-50 text-error-500',
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

export interface StatusPillProps {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}

export function StatusPill({ tone, children, className }: StatusPillProps): React.ReactElement {
  return (
    <span
      data-slot="status-pill"
      data-tone={tone}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1.5 text-xs font-bold tracking-[.07em] uppercase',
        STATUS_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
