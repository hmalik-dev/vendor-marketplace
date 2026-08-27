import { cn } from '@/lib/utils';

/**
 * The mark with its second circle come loose — the illustration on frames `15`
 * and `26`. Two circles at the mark's own 45% overlap, but the filled one goes
 * flat `stone-200` and the stroked one becomes a `stone-400` dash: the product's
 * own glyph, not working. No cartoon and no oversized "404".
 *
 * It carries the same OFFSET_RATIO the real mark does, so the two stay in step.
 * It is decorative — the heading beside it says what happened — so it is hidden
 * from the accessibility tree.
 */
const DIAMETER = 46;
const OFFSET_RATIO = 0.45;

export interface BrokenMarkProps {
  className?: string;
}

export function BrokenMark({ className }: BrokenMarkProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      data-testid="broken-mark"
      className={cn('relative block', className)}
      style={{ width: DIAMETER * (1 + OFFSET_RATIO), height: DIAMETER }}
    >
      <span
        className="absolute top-0 left-0 rounded-full bg-stone-200"
        style={{ width: DIAMETER, height: DIAMETER }}
      />
      <span
        className="absolute top-0 rounded-full border-[1.5px] border-dashed border-stone-400"
        style={{ left: DIAMETER * OFFSET_RATIO, width: DIAMETER, height: DIAMETER }}
      />
    </span>
  );
}
