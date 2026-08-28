/**
 * The product's public identity, in exactly one place.
 *
 * The repository, packages and infrastructure keep the name
 * `vendor-marketplace`; everything a person sees says Orla. The name has
 * already moved twice (VendorHub → VenMatch → Orla), so it lives here and no
 * component, page title, or email template may render it from a literal.
 *
 * See design/design-plan/00-README.md.
 */
export const BRAND_NAME = 'Orla';

/** The public domain, used in profile-link previews and transactional email. */
export const BRAND_DOMAIN = 'orla.com';

/**
 * The one-line promise, in the footer, the install manifest and the share
 * card. Approved copy — `design/design-plan/31-content-voice.md`. It is here
 * rather than in the footer because three surfaces now say it, and three
 * copies is how a brand line drifts.
 */
export const BRAND_TAGLINE = 'Made for the people who make the day.';

/**
 * The sentence a search result and a shared link show under the title. It says
 * what the product does and how, in the product's own voice — never a keyword
 * list, and never a claim about size, which would be a number nothing counts.
 */
export const BRAND_DESCRIPTION =
  'Compare real availability and pricing from event vendors near you, send one request, and pay securely once the date is locked in.';

/**
 * Composes a page title as `<page> · <brand>`. Passing nothing yields the brand
 * alone, which is what the root layout's default title wants.
 */
export function pageTitle(page?: string): string {
  return page ? `${page} · ${BRAND_NAME}` : BRAND_NAME;
}
