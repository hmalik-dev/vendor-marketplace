import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/config/env';

/**
 * Everything a signed-in person sees is disallowed, and everything a visitor
 * can reach without an account is allowed.
 *
 * The private paths are not secret — they are all behind Clerk — but a crawler
 * following them only ever reaches a sign-in redirect, which wastes crawl
 * budget on a site whose growth depends on vendor profiles being indexed.
 */
const PRIVATE_PATHS = [
  '/vendor/',
  '/customer/',
  '/dashboard',
  '/after-sign-in',
  '/suspended',
  '/sign-in',
  '/sign-up',
];

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE_PATHS }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
