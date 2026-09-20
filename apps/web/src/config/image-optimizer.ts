/**
 * Uploaded images travel through Next's image optimizer (`/_next/image`), not
 * straight from the storage host (VEN-456).
 *
 * Neon Object Storage has no CDN in front of it — a warm read costs what a cold
 * one does — so the optimizer's cache is the CDN: the storage host is fetched
 * once per image and width, and every later view is served from
 * `x-vercel-cache: HIT` (or `.next/cache/images` under `next start`).
 *
 * This module is the one place that knows both halves of that contract — what
 * `next.config.ts` allow-lists and what a component may rewrite — so the two
 * cannot disagree. A URL the optimizer would refuse must never be rewritten to
 * it: that renders a 400 where a working image was.
 *
 * A leaf, like `public-env.ts`: client components import it.
 */

import { UPLOAD_PREFIXES } from '@vendor-marketplace/shared';

/**
 * Object keys are immutable — a replaced photograph gets a new key — so a year
 * is honest, and it is what stops the optimizer revalidating against a host
 * that has no cache of its own.
 */
export const IMAGE_MINIMUM_CACHE_TTL = 60 * 60 * 24 * 365;

/**
 * Every width the optimizer will transform, and nothing else (VEN-486). `w` is
 * validated against these two lists, so each is a billable transformation an
 * anonymous caller can force per stored object: Next's sixteen defaults reach
 * 3840, past anything a layout asks for.
 *
 * Derived from the rendered `cssWidth`s (each doubled, then snapped up): the
 * avatars and thumbnails (30-64px -> 64/96/128), the 104px admin tile (256),
 * the 320-400px cards and grids (640-828), the 800px lightbox (1600) and the
 * 1200px profile cover (2400). `image-optimizer.test.ts` recomputes that from
 * the call sites and fails when a list holds a width none of them produces, or
 * a site is served more than a third wider than it asked for (a missing width).
 * `next/image` (`StockPhoto`) draws its srcSet from the same lists, so local art
 * snaps to them too: no 384, hence a 188px card at 2x takes 640.
 */
export const IMAGE_SIZES = [64, 96, 128, 256];
export const DEVICE_SIZES = [640, 750, 828, 1600, 2400];

const ALLOWED_WIDTHS = [...IMAGE_SIZES, ...DEVICE_SIZES].sort((a, b) => a - b);

/**
 * The one quality the app asks for. `next.config.ts` pins `images.qualities` to
 * it: unpinned, `q` is free and each source image can be forced into a hundred
 * cached variants per width by an anonymous request.
 */
export const IMAGE_QUALITY = 75;

export interface RemotePattern {
  protocol: 'https';
  hostname: string;
  port: string;
  pathname: string;
}

/**
 * The only host the optimizer may fetch from: the configured public base, when
 * it is https. `/_next/image` is an anonymous fetcher on our origin, so the
 * list is derived from the same env value `optimizedImageProps` rewrites
 * against and nothing wider — a `*.storage.*.aws.neon.tech` wildcard admits
 * every Neon tenant's bucket, not ours. Plain http (local storage) yields an
 * empty list and is served raw.
 */
export function imageRemotePatterns(publicBaseUrl: string): RemotePattern[] {
  const base = new URL(publicBaseUrl);

  if (base.protocol !== 'https:') {
    return [];
  }

  const basePath = base.pathname.replace(/\/+$/, '');

  // One pattern per upload prefix: `${basePath}/**` would also admit anything
  // else in the bucket, which is not ours to transform.
  return UPLOAD_PREFIXES.map((prefix) => ({
    protocol: 'https' as const,
    hostname: base.hostname,
    port: base.port,
    pathname: `${basePath}/${prefix}/**`,
  }));
}

function snap(width: number): number {
  return (
    ALLOWED_WIDTHS.find((allowed) => allowed >= width) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]!
  );
}

function optimizerUrl(src: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${snap(width)}&q=${IMAGE_QUALITY}`;
}

/**
 * The optimizer URL for `src` rendered `cssWidth` px wide, or `null` when the
 * image is not the optimizer's to serve: not under the configured https public
 * base's upload prefixes (site-relative `/demo/...` art, local storage, any
 * other host, or another path in the same bucket).
 *
 * **One URL at twice the width, deliberately not a `1x, 2x` `srcset`.** With
 * density descriptors the browser divides the chosen candidate's pixel width by
 * its density to get the intrinsic size, and the optimizer never upscales — so
 * an image with no CSS box of its own (the portfolio lightbox, which the
 * photograph sizes) would render smaller, and smaller again on a retina screen.
 * One candidate keeps the intrinsic size the source has, and one width per
 * image is one transformation to bill.
 */
export function optimizedImageProps(
  src: string,
  publicBaseUrl: string | undefined,
  cssWidth: number,
): string | null {
  const base = publicBaseUrl?.replace(/\/+$/, '');

  if (
    !base ||
    !base.startsWith('https://') ||
    !UPLOAD_PREFIXES.some((prefix) => src.startsWith(`${base}/${prefix}/`))
  ) {
    return null;
  }

  return optimizerUrl(src, cssWidth * 2);
}
