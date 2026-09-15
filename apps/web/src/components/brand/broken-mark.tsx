import { cn } from '@/lib/utils';

/**
 * The mark with its second circle come loose — frame `15`'s illustration. The
 * filled circle goes flat `stone-200` and the stroked one becomes a `stone-400`
 * dash: the product's own glyph, not working. No cartoon and no oversized "404".
 *
 * Come loose is the point, so it does **not** share the logo's 0.45 overlap:
 * frame `15` draws the dashed circle at `left:28px` in a 74x46 box, and the
 * empty-state marks on `18`–`20` corroborate a 0.61–0.64 D offset (VEN-419).
 * The screens document is content-box, so the dashed ring is `box-content`: its
 * 1.5px border paints outside the 46px, a 49px ring to 77px, as the logo's does.
 * It is decorative — the heading beside it says what happened — so it is hidden
 * from the accessibility tree.
 */
const DIAMETER = 46;
const OFFSET = 28;

export interface BrokenMarkProps {
  className?: string;
}

export function BrokenMark({ className }: BrokenMarkProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      data-testid="broken-mark"
      className={cn('relative block', className)}
      style={{ width: DIAMETER + OFFSET, height: DIAMETER }}
    >
      <span
        className="absolute top-0 left-0 rounded-full bg-stone-200"
        style={{ width: DIAMETER, height: DIAMETER }}
      />
      <span
        className="absolute top-0 box-content rounded-full border-[1.5px] border-dashed border-stone-400"
        style={{ left: OFFSET, width: DIAMETER, height: DIAMETER }}
      />
    </span>
  );
}
