/**
 * Whether this deployment reports page views: production only, by Vercel's own
 * `VERCEL_ENV`. Staging is a preview deployment, so it sends nothing, and
 * neither do lanes and laptops — an unset value is a laptop.
 *
 * Not in `web-analytics.tsx`: the root layout is a server component, and a
 * function exported from a `'use client'` module throws when the server calls it.
 */
export function analyticsEnabled(vercelEnv: string | undefined): boolean {
  return vercelEnv === 'production';
}
