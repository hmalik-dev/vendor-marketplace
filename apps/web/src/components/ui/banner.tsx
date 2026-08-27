import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The inline banner — one per screen, at the top of the pane it concerns.
 * Frame `26 State library`.
 *
 * `40-states.md` states the colour rule and then says it does not bend: red is
 * never used for `pending`, gold is never used for a failure. A convention that
 * can be broken by passing the wrong string is not a rule, so the tone is not a
 * free choice here — it is derived from what the banner *means*.
 *
 * That makes the forbidden combinations unrepresentable rather than merely
 * discouraged: there is no `tone` prop to get wrong, and a reviewer reading
 * `status="pending"` at a call site knows the colour without looking.
 */
export type BannerStatus =
  /** Neutral, and resolves itself — offline/reconnecting, a degraded feature. */
  | 'informational'
  /** Waiting on someone — publish blockers, availability conflicts, date holds. */
  | 'pending'
  /** It failed — a declined card, a failed send, a 500. */
  | 'failed'
  /** Settled — payout connected, "no payment was taken". */
  | 'settled';

interface BannerTokens {
  surface: string;
  dot: string;
  body: string;
}

/** Keyed to the colour-semantics table in `40-states.md`, which does not bend. */
const STATUS_TOKENS: Record<BannerStatus, BannerTokens> = {
  informational: {
    surface: 'bg-steel-50 border-steel-200',
    dot: 'bg-steel-600',
    body: 'text-steel-600',
  },
  pending: {
    surface: 'bg-gold-50 border-gold-300',
    dot: 'bg-gold-400',
    body: 'text-gold-600',
  },
  failed: {
    surface: 'bg-error-50 border-error-200',
    dot: 'bg-error-500',
    body: 'text-stone-700',
  },
  settled: {
    surface: 'bg-sage-50 border-sage-300',
    dot: 'bg-sage-400',
    body: 'text-sage-600',
  },
};

export interface BannerProps {
  status: BannerStatus;
  /** The headline. One line — the sentence goes in `children`. */
  title?: ReactNode;
  /** One sentence per job, per `40-states.md`. */
  children: ReactNode;
  className?: string;
}

export function Banner({ status, title, children, className }: BannerProps): React.ReactElement {
  const tokens = STATUS_TOKENS[status];

  return (
    <div
      /*
       * `status` rather than `alert`: a banner is standing context at the top
       * of a pane, not an interruption. A live region here would re-announce
       * the same sentence on every re-render of the screen it sits on.
       */
      role="status"
      data-status={status}
      className={cn(
        'flex items-start gap-2.75 rounded-xl border px-3.75 py-3.25',
        tokens.surface,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('mt-0.25 size-4 shrink-0 rounded-full', tokens.dot)} />
      <div>
        {title ? <p className="text-[13px] font-semibold text-stone-900">{title}</p> : null}
        <p className={cn('text-[12.5px] leading-[1.55]', tokens.body, title && 'mt-0.75')}>
          {children}
        </p>
      </div>
    </div>
  );
}
