import { BRAND_DOMAIN } from '@vendor-marketplace/shared';

/** RFC 9116 asks for an `Expires` under a year out; a rolling half-year is never stale. */
const EXPIRES_AFTER_MS = 182 * 24 * 60 * 60 * 1000;

/**
 * The address a researcher reports to. Derived from the brand domain, like
 * every other address in the product, so it moves with the brand.
 */
export const SECURITY_CONTACT = `mailto:security@${BRAND_DOMAIN}`;

export function securityTxt(now: Date, origin: string): string {
  return [
    `Contact: ${SECURITY_CONTACT}`,
    `Expires: ${new Date(now.getTime() + EXPIRES_AFTER_MS).toISOString()}`,
    `Canonical: ${origin}/.well-known/security.txt`,
    'Preferred-Languages: en',
    '',
  ].join('\n');
}
