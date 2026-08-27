import { StockPhoto } from '@/components/ui/stock-photo';

/**
 * The three cards, at the sizes, angles and offsets frame `01` draws them.
 * The shadow deepens with elevation, so the stack reads as three objects on a
 * table rather than three rectangles at three angles.
 *
 * `sizes` is the card's own rendered width — these never scale with the
 * viewport, they are fixed boxes the whole cluster shrinks at `sm`.
 */
const CARDS = [
  {
    src: '/stock/florals.jpg',
    sizes: '236px',
    className:
      'top-0 left-5 h-73 w-59 rotate-[-4deg] rounded-2xl shadow-[0_14px_40px_rgba(35,32,28,.16)]',
  },
  {
    src: '/stock/portrait.jpg',
    sizes: '254px',
    className:
      'top-17.5 left-47.5 h-79 w-63.5 rotate-[3deg] rounded-2xl shadow-[0_18px_46px_rgba(35,32,28,.2)]',
  },
  {
    src: '/stock/dj.jpg',
    sizes: '188px',
    /*
     * The smallest card is the one the composition can lose: below `lg` the
     * two columns have already stacked and the cluster is doing its work with
     * two cards, where a third would only make the stack taller.
     */
    className:
      'top-52 left-1 hidden h-37.5 w-47 rotate-[2deg] rounded-[14px] shadow-[0_12px_32px_rgba(35,32,28,.14)] lg:block',
  },
] as const;

/**
 * The proof that real vendors exist, and what fills the hero's right-hand 44%.
 *
 * The three cards carry licensed stock standing in for launch photography —
 * a tablescape, a couple's portrait and a dance floor, one per card, so the
 * stack shows three different kinds of vendor rather than three of the same.
 *
 * Frame `01` floats a vendor chip over the stack reading "★ 4.9 · replies in
 * 2h". It is **deferred post-MVP**: reply time is the implied ranking mechanic
 * open question 2 says not to ship before it is real, and a single hand-picked
 * vendor's rating on the hero is platform marketing rather than a query
 * result. It returns when there is data behind it — see
 * design/design-plan/98-post-mvp.md.
 *
 * See design/design-plan/10-landing.md.
 */
export function PhotoCluster(): React.ReactElement {
  return (
    /*
     * 392px is the frame's height for this column, and it is what sets the
     * hero row's height — the copy column is shorter and sits inside it.
     *
     * The cards are placed in absolute pixels, so below `sm` the stack is
     * scaled rather than reflowed: a 390px screen cannot hold a 444px-wide
     * composition, and squeezing the cards individually would lose the
     * overlaps that make it a cluster instead of three photographs.
     */
    <div className="relative h-98 w-125 shrink-0 max-sm:h-65 max-sm:origin-top max-sm:scale-65">
      {CARDS.map((card, index) => (
        <StockPhoto
          key={card.src}
          src={card.src}
          sizes={card.sizes}
          // The two cards above the fold at 1440 load eagerly; a hero that
          // paints its headline over three empty boxes is the thing to avoid.
          priority={index < 2}
          className={`absolute ${card.className}`}
        />
      ))}
    </div>
  );
}
