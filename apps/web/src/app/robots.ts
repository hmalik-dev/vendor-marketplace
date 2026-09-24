import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/config/env';
import { searchIndexed } from '@/config/indexing';

/**
 * Everything a signed-in person sees is disallowed, and everything a visitor
 * can reach without an account is allowed.
 *
 * The private paths are not secret — they are all behind sign-in — but a crawler
 * following them only ever reaches a sign-in redirect, which wastes crawl
 * budget on a site whose growth depends on vendor profiles being indexed.
 */
const PRIVATE_PATHS = [
  // The operations console. Every URL under it already 403s or redirects for a
  // stranger, and the layout sets `robots: { index: false }` — this is the
  // crawl-budget half, and the rule above says "everything a signed-in person
  // sees", which includes an admin.
  '/admin',
  '/vendor/',
  '/customer/',
  '/dashboard',
  '/after-sign-in',
  '/suspended',
  '/sign-in',
  '/sign-up',
];

export default function robots(): MetadataRoute.Robots {
  // Outside production nothing is crawled and no sitemap is advertised (VEN-606).
  if (!searchIndexed()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  const origin = siteOrigin();

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE_PATHS }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
