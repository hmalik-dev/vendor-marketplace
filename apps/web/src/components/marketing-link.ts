/**
 * The frame's marketing nav-link treatment: 12.5px / 500 in `stone-700`, going
 * to 13.5px at 1440. The same for `Browse` / `How it works` / `For vendors` in
 * `MarketingNav` and for `Sign in` in `SiteHeader`.
 *
 * 13.5px used to be the only size, which is `01 Landing`'s. Both `27 Landing —
 * 1024` and `14 Landing tablet` draw 12.5px.
 *
 * It lives in its own module rather than beside `MarketingNav` because that
 * component is a Client Component, and a constant imported across the client
 * boundary reaches a Server Component as a client-reference proxy, not a
 * string. Interpolating one — `` `${MARKETING_LINK_CLASS} max-md:hidden` `` —
 * stringifies the proxy's throwing stub into the `class` attribute, and the
 * link silently renders unstyled. A plain module has no boundary to cross.
 */
export const MARKETING_LINK_CLASS =
  'text-[12.5px] font-medium text-stone-700 transition-colors duration-(--duration-fast) min-[90rem]:text-[13.5px] hover:text-clay-600';
