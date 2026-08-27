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
 * Composes a page title as `<page> · <brand>`. Passing nothing yields the brand
 * alone, which is what the root layout's default title wants.
 */
export function pageTitle(page?: string): string {
  return page ? `${page} · ${BRAND_NAME}` : BRAND_NAME;
}
