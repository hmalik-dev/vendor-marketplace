/**
 * The frame's marketing nav-link treatment: 12.5px / 500 in `stone-700`, going
 * to 13.5px at 1440. The same for `Browse` / `How it works` / `For vendors` in
 * `MarketingNav` and for `Sign in` in `SiteHeader`.
 *
 * 13.5px used to be the only size, which is `01 Landing`'s. Both `27 Landing —
 * 1024` and `14 Landing tablet` draw 12.5px.
 *
 * `py-3.5` plus `min-h-11` is hit area, not appearance. `30-responsive.md`
 * requires 44x44 touch targets at 768 and these links measured 16px tall — a
 * 12.5px line in a bar with no vertical padding. The padding grows the box and
 * nothing else: the nav centres its children, so the text does not move, and the
 * link carries no background or border for the larger box to reveal. It fits
 * inside the 56px bar the narrow frames draw, and the 64px one at 1440.
 *
 * `min-h-11` is there because the padding alone lands at **43px** — 14 + a 15px
 * line box + 14 — and 43 is not 44.
 *
 * Width is bought the same way the `Sign up` pill buys its height: a
 * pseudo-element, so the target reaches 44px without the box moving. `Sign in`
 * measures 39.3px wide and `Browse` 43px, and a `min-w-11` on the box itself
 * would push every sibling and fail the Layout axis to pass the Access one. The
 * overlay expands into the 16px gap between links, which is wider than the ~2px
 * each side it needs.
 *
 * It lives in its own module rather than beside `MarketingNav` because that
 * component is a Client Component, and a constant imported across the client
 * boundary reaches a Server Component as a client-reference proxy, not a
 * string. Interpolating one — `` `${MARKETING_LINK_CLASS} max-md:hidden` `` —
 * stringifies the proxy's throwing stub into the `class` attribute, and the
 * link silently renders unstyled. A plain module has no boundary to cross.
 */
export const MARKETING_LINK_CLASS =
  "relative flex min-h-11 items-center py-3.5 text-[12.5px] font-medium text-stone-700 transition-colors duration-(--duration-fast) after:absolute after:top-1/2 after:left-1/2 after:h-full after:min-w-11 after:w-full after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] min-[90rem]:text-[13.5px] hover:text-clay-600";
