import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { DEVICE_SIZES, IMAGE_QUALITY, IMAGE_SIZES } from '../src/config/image-optimizer';
import { API_REQUEST_TIMEOUT_MS } from '../src/lib/api-client';

/**
 * VEN-655: fills `next start`'s image cache before any journey can abort a cold
 * optimization.
 *
 * Under `next start`, a `/_next/image` request whose client goes away before
 * its *first* optimization finishes wedges that image, width and format for the
 * life of the server: the optimizer's in-flight entry never settles, and every
 * later request for the same key waits on it forever. Reproduced on a lane by
 * aborting uncached requests at 0–40ms — one key in fifty-four never answered
 * again. A cached key cannot wedge: it is served from `.next/cache/images`.
 *
 * The journeys abort cold optimizations all the time — a test that ends while
 * `/`'s lazy category art is still being transformed closes its context under
 * it. Lazy images never hold up `load`, so the next visit to `/` passes; but
 * its nine wedged requests take all six of Chromium's connections to the host,
 * and the page's *next* navigation waits for a socket until Playwright's 60s
 * timeout. That is the `image-fallback` reload and the `route-landing`
 * `/accept-terms` goto, for every persona that sweeps `/` first — and never the
 * vendor, whom `/` redirects before any art is drawn.
 *
 * Vercel serves `/_next/image` from its own optimizer, so the deployed tiers do
 * not run this code; it is the suite's server that needs the cache warm.
 */

/** Every raster `next/image` could be handed from `public/`. */
const RASTER = /\.(avif|gif|jpe?g|png|webp)$/i;

/**
 * Chromium's `Accept` for an `<img>`. The optimizer's cache key includes the
 * format it negotiates from this header, so warming without it would fill the
 * JPEG entry and leave the WebP one a browser asks for cold.
 */
const BROWSER_IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';

/** Small enough not to starve a two-core runner, large enough to finish in seconds. */
const CONCURRENCY = 4;

function rastersUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && RASTER.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Each `/_next/image` path `next/image`'s default loader can build for a file in `publicDir`. */
export function optimizerWarmupPaths(publicDir: string): string[] {
  const widths = [...IMAGE_SIZES, ...DEVICE_SIZES];

  return rastersUnder(publicDir)
    .map((file) => `/${relative(publicDir, file).split(sep).join('/')}`)
    .sort()
    .flatMap((src) =>
      widths.map(
        (width) => `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${IMAGE_QUALITY}`,
      ),
    );
}

async function warmOne(origin: string, path: string, timeoutMs: number): Promise<string | null> {
  try {
    const response = await fetch(`${origin}${path}`, {
      headers: { accept: BROWSER_IMAGE_ACCEPT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.arrayBuffer();
    return response.ok ? null : `answered HTTP ${response.status}: ${path}`;
  } catch (error) {
    return (error as Error).name === 'TimeoutError'
      ? `did not answer within ${timeoutMs}ms: ${path}`
      : `failed (${(error as Error).message}): ${path}`;
  }
}

/**
 * Requests every path to completion, each against its own deadline, and throws
 * naming each one that did not come back 2xx — so a wedged optimizer stops the
 * suite here, by URL, instead of as a navigation timeout three specs later.
 */
export async function warmImageOptimizer(
  origin: string,
  paths: readonly string[],
  { timeoutMs = API_REQUEST_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<void> {
  const queue = [...paths];
  const problems: string[] = [];

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
        const problem = await warmOne(origin, path, timeoutMs);
        if (problem) problems.push(problem);
      }
    }),
  );

  if (problems.length > 0) {
    throw new Error(`The image optimizer could not be warmed:\n  ${problems.join('\n  ')}`);
  }
}
