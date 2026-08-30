import { StockPhoto } from '@/components/ui/stock-photo';

/**
 * The hero cluster, at the sizes, angles and offsets the frames draw — at all
 * three drawn widths.
 *
 * **Every number here is read from a frame, not derived.** The cluster is not
 * one composition scaled three ways: `14 Landing tablet` re-positions the cards
 * as well as shrinking them, so a single `scale()` that gets the sizes exactly
 * right lands the offsets ~6px out. Sizes and positions are therefore stated
 * per breakpoint, in the frames' own pixels, so each is checkable against its
 * frame by reading one line.
 *
 * | | 768 (`14 Landing tablet`) | 1024 (`27 Landing — 1024`) | 1440 (`01 Landing`) |
 * | --- | --- | --- | --- |
 * | florals | 146x182 at (4, 6) | 172x213 at (14, 0) | 236x292 at (20, 0) |
 * | portrait | 158x196 at (112, 38) | 185x231 at (138, 51) | 254x316 at (190, 70) |
 * | venue | — | 137x110 at (3, 152) | 188x150 at (4, 208) |
 * | column | 250 tall | 286 tall | 392 tall |
 *
 * The ratios are 0.62 and 0.73 of the 1440 card, which is where
 * `30-responsive.md`'s two scales come from — but they are the *result* of the
 * frames rather than the rule that produced them.
 *
 * **Radius and shadow step with the size**, and are stated per breakpoint for
 * the same reason: the frames draw 13/14/16px radii and progressively lighter
 * shadows, so carrying the 1440 treatment down made a 146px card wear a
 * 40px-blur shadow and read heavier than the photograph inside it.
 *
 * Every step is `min-[90rem]`, never `xl`. `xl` is 1280, which no frame in this
 * bundle draws — and while the geometry stepped there and the styling stepped at
 * 1440, the band from 1280 to 1439 rendered full-size 1440 cards wearing the
 * 1024 radius and shadow, beside a headline and a search bar still on their 1024
 * values. A composition no frame draws and nobody measured.
 *
 * `sizes` is the card's own rendered width at its largest, so the browser
 * fetches for 1440 and reuses that file at the narrower widths.
 */
const CARDS = [
  {
    src: '/stock/florals.jpg',
    sizes: '236px',
    geometry:
      'top-[6px] left-[4px] h-[182px] w-[146px] lg:top-0 lg:left-[14px] lg:h-[213px] lg:w-[172px] min-[90rem]:top-0 min-[90rem]:left-5 min-[90rem]:h-73 min-[90rem]:w-59',
    style:
      /*
        16px at 1440, not `rounded-2xl` — that token is 18px (#249). The
        frame draws 13/14/16px across 768/1024/1440 and there is no 16px
        step in the scale to reach for instead, so this states the frame's
        pixel value directly, the same way the other two breakpoints already do.
      */
      'rotate-[-4deg] rounded-[13px] shadow-[0_10px_26px_rgba(35,32,28,.16)] lg:rounded-[14px] lg:shadow-[0_12px_32px_rgba(35,32,28,.16)] min-[90rem]:rounded-[16px] min-[90rem]:shadow-[0_14px_40px_rgba(35,32,28,.16)]',
  },
  {
    src: '/stock/portrait.jpg',
    sizes: '254px',
    geometry:
      'top-[38px] left-[112px] h-[196px] w-[158px] lg:top-[51px] lg:left-[138px] lg:h-[231px] lg:w-[185px] min-[90rem]:top-17.5 min-[90rem]:left-47.5 min-[90rem]:h-79 min-[90rem]:w-63.5',
    style:
      // 16px at 1440 — see the florals card above (#249).
      'rotate-[3deg] rounded-[13px] shadow-[0_12px_30px_rgba(35,32,28,.2)] lg:rounded-[14px] lg:shadow-[0_15px_38px_rgba(35,32,28,.2)] min-[90rem]:rounded-[16px] min-[90rem]:shadow-[0_18px_46px_rgba(35,32,28,.2)]',
  },
  {
    src: '/stock/venue.jpg',
    sizes: '188px',
    /*
     * The card the composition sheds at 768, and `14 Landing tablet` is what
     * says so — it draws two. This **overrides** the old "the cluster never
     * sheds a card" rule, and the frame's reason is arithmetic: at 0.62 this
     * card would be 117x93, under the ~140px short-edge floor the other two
     * clear, so it stops reading as a photograph and starts reading as a chip.
     */
    geometry:
      'hidden lg:block lg:top-[152px] lg:left-[3px] lg:h-[110px] lg:w-[137px] min-[90rem]:top-52 min-[90rem]:left-1 min-[90rem]:h-37.5 min-[90rem]:w-47',
    /* Shed at 768, so this one only ever needs its 1024 and 1440 steps. */
    style:
      'rotate-[2deg] lg:rounded-[12px] lg:shadow-[0_10px_26px_rgba(35,32,28,.14)] min-[90rem]:rounded-[14px] min-[90rem]:shadow-[0_12px_32px_rgba(35,32,28,.14)]',
  },
] as const;

/**
 * The proof that real vendors exist, and what fills the hero's right-hand
 * column from 768 up.
 *
 * The cards carry licensed stock standing in for launch photography — a
 * tablescape, a couple's portrait and a lit reception hall, one per card, so
 * the stack shows three different kinds of vendor rather than three of the same.
 *
 * The third card carries the stack's tonal weight. Its first two are pale — a
 * cream tablescape and an overcast beach — so a third pale frame makes the
 * cluster read as one blur rather than three cards, whatever the shadow does.
 *
 * Frame `01` floats a vendor chip over the stack reading "★ 4.9 · replies in
 * 2h". It is **deferred post-MVP**: reply time is the implied ranking mechanic
 * open question 2 says not to ship before it is real, and a single hand-picked
 * vendor's rating on the hero is platform marketing rather than a query
 * result. It returns when there is data behind it — see
 * design/design-plan/98-post-mvp.md.
 *
 * See design/design-plan/10-landing.md and 30-responsive.md.
 */
export function PhotoCluster(): React.ReactElement {
  return (
    /*
     * The column's height is the frame's, per width, and it is what sets the
     * hero row's height — the copy column is shorter and sits inside it. Stated
     * rather than derived from the cards, because the cards are absolutely
     * positioned and contribute nothing to layout.
     */
    <div className="relative h-[250px] w-[270px] lg:h-[286px] lg:w-[323px] min-[90rem]:h-98 min-[90rem]:w-125">
      {CARDS.map((card, index) => (
        <StockPhoto
          key={card.src}
          src={card.src}
          sizes={card.sizes}
          // The two cards above the fold at 1440 load eagerly; a hero that
          // paints its headline over three empty boxes is the thing to avoid.
          priority={index < 2}
          className={`absolute ${card.geometry} ${card.style}`}
        />
      ))}
    </div>
  );
}
