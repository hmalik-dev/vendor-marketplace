/**
 * The frame's marketing nav-link treatment: 13.5px / 500 in `stone-700`, the
 * same for `Browse` / `How it works` / `For vendors` in `MarketingNav` and for
 * `List your services` / `Sign in` in `SiteHeader`.
 *
 * It lives in its own module rather than beside `MarketingNav` because that
 * component is a Client Component, and a constant imported across the client
 * boundary reaches a Server Component as a client-reference proxy, not a
 * string. Interpolating one — `` `${MARKETING_LINK_CLASS} max-md:hidden` `` —
 * stringifies the proxy's throwing stub into the `class` attribute, and the
 * link silently renders unstyled. A plain module has no boundary to cross.
 */
export const MARKETING_LINK_CLASS =
  'text-[13.5px] font-medium text-stone-700 transition-colors duration-(--duration-fast) hover:text-clay-600';
