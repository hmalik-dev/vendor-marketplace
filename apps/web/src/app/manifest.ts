import { BRAND_NAME, BRAND_TAGLINE } from '@vendor-marketplace/shared';
import type { MetadataRoute } from 'next';

/**
 * The install manifest. `browser` rather than `standalone`: this is a
 * marketplace people reach from a shared link and a search result, not an app
 * they launch — stripping the browser chrome would take the URL bar away from
 * a page whose whole job is to be shareable.
 *
 * The icons are the rendered `icon` and `apple-icon` routes, so the mark can
 * never go stale against `02-brand-and-logo.md`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_TAGLINE,
    start_url: '/',
    display: 'browser',
    // The cream ground, never pure white — `01-foundations.md`.
    background_color: '#fffdf9',
    theme_color: '#fffdf9',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
