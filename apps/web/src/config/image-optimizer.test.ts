import { describe, expect, it } from 'vitest';
import { UPLOAD_PREFIXES } from '@vendor-marketplace/shared';
import { AVATAR_SIZES } from '@/components/ui/avatar';
import { matchRemotePattern } from 'next/dist/shared/lib/match-remote-pattern';
import { elements, sourceFiles } from '@/testing/source-scan';
import {
  DEVICE_SIZES,
  IMAGE_MINIMUM_CACHE_TTL,
  IMAGE_SIZES,
  IMAGE_QUALITY,
  imageRemotePatterns,
  optimizedImageProps,
} from './image-optimizer';

const BASE = 'https://ep-abc.storage.us-east-2.aws.neon.tech/uploads';
const KEY = `${BASE}/portfolio/v1/cover.jpg`;

function decodedUrl(optimizerSrc: string): string | null {
  return new URL(optimizerSrc, 'https://web.example').searchParams.get('url');
}

describe('optimizedImageProps', () => {
  it('routes an uploaded key through /_next/image, url decoding to base plus key', () => {
    const src = optimizedImageProps(KEY, BASE, 400);

    expect(src?.startsWith('/_next/image?url=')).toBe(true);
    expect(decodedUrl(src!)).toBe(KEY);
  });

  it('asks for twice the rendered width, snapped up to a configured width', () => {
    expect(optimizedImageProps(KEY, BASE, 400)).toBe(
      `/_next/image?url=${encodeURIComponent(KEY)}&w=828&q=75`,
    );
  });

  it('caps at the largest configured width', () => {
    expect(optimizedImageProps(KEY, BASE, 3000)).toContain('&w=2400&q=75');
  });

  it('tolerates a trailing slash on the base', () => {
    expect(optimizedImageProps(KEY, `${BASE}/`, 96)).not.toBeNull();
  });

  it.each([
    ['site-relative art', '/demo/cover.jpg', BASE],
    ['another host', 'https://evil.example/uploads/x.jpg', BASE],
    ['a host that merely starts like the base', `${BASE}-other/x.jpg`, BASE],
    [
      'plain-http local storage',
      'http://localhost:9000/bucket/x.jpg',
      'http://localhost:9000/bucket',
    ],
    ['an object outside the upload prefixes', `${BASE}/private/v1/x.jpg`, BASE],
    ['no configured base', KEY, undefined],
  ])('leaves %s to be served raw', (_name, src, base) => {
    expect(optimizedImageProps(src, base, 400)).toBeNull();
  });
});

describe('imageRemotePatterns', () => {
  it('allow-lists exactly the configured storage host and each upload prefix — no other Neon tenant, no other path', () => {
    expect(imageRemotePatterns(BASE).map((p) => p.pathname)).toEqual([
      '/uploads/vendor-profile/**',
      '/uploads/vendor-cover/**',
      '/uploads/portfolio/**',
      '/uploads/customer-profile/**',
    ]);
    expect(imageRemotePatterns(BASE)).toEqual(
      UPLOAD_PREFIXES.map((prefix) => ({
        protocol: 'https',
        hostname: 'ep-abc.storage.us-east-2.aws.neon.tech',
        port: '',
        pathname: `/uploads/${prefix}/**`,
      })),
    );
  });

  it('refuses a URL on the same host outside the upload prefixes', () => {
    // Next's own matcher, so this checks the glob as `/_next/image` reads it.
    const admits = (pathname: string) =>
      imageRemotePatterns(BASE).some((p) =>
        matchRemotePattern(p, new URL(`https://ep-abc.storage.us-east-2.aws.neon.tech${pathname}`)),
      );

    expect(admits('/uploads/portfolio/v1/cover.jpg')).toBe(true);
    expect(admits('/uploads/private/v1/cover.jpg')).toBe(false);
    expect(admits('/uploads/cover.jpg')).toBe(false);
    expect(admits('/uploads/portfolio-x/v1/cover.jpg')).toBe(false);
    expect(admits('/other/portfolio/v1/cover.jpg')).toBe(false);
  });

  it('pins a non-default port', () => {
    expect(imageRemotePatterns('https://media.example.com:8443/bucket')[0]).toEqual({
      protocol: 'https',
      hostname: 'media.example.com',
      port: '8443',
      pathname: '/bucket/vendor-profile/**',
    });
  });

  it('allow-lists nothing for a plain-http origin', () => {
    expect(imageRemotePatterns('http://localhost:9000/bucket')).toEqual([]);
  });
});

describe('optimizer limits', () => {
  it('asks for the one quality the config pins', () => {
    expect(IMAGE_QUALITY).toBe(75);
    expect(optimizedImageProps(KEY, BASE, 400)).toContain(`&q=${IMAGE_QUALITY}`);
  });

  it('is a year, matching immutable object keys', () => {
    expect(IMAGE_MINIMUM_CACHE_TTL).toBe(31_536_000);
  });
});

/** The literal `width={N}` every `FallbackImage` site passes, read from source. */
async function fallbackImageCssWidths(): Promise<number[]> {
  const widths = new Set<number>();

  for (const { code } of await sourceFiles()) {
    for (const el of elements(code, 'FallbackImage')) {
      const literal = /\bwidth=\{(\d+)\}/.exec(el.attributes);

      if (literal) widths.add(Number(literal[1]));
    }
  }

  return [...widths].sort((a, b) => a - b);
}

describe('the widths the pages render (VEN-486)', () => {
  /** Rendered widths of every shipped site. `Avatar` passes a variable, so it is read from its table. */
  async function cssWidths(): Promise<number[]> {
    return [...(await fallbackImageCssWidths()), ...Object.values(AVATAR_SIZES)];
  }

  function servedWidth(css: number): number {
    const src = optimizedImageProps(KEY, BASE, css)!;

    return Number(new URL(src, 'https://web.example').searchParams.get('w'));
  }

  it('reads the call sites it claims to (a scan that finds nothing proves nothing)', async () => {
    expect(await fallbackImageCssWidths()).toEqual([38, 58, 104, 320, 360, 400, 800, 1200]);
  });

  it('configures no width larger than the largest a shipped site can ask for', async () => {
    const largest = Math.max(...(await cssWidths())) * 2;

    expect(largest).toBe(2400);
    expect(Math.max(...IMAGE_SIZES, ...DEVICE_SIZES)).toBe(largest);
  });

  it('serves every site within a third of the 2x width it asked for — a dropped width fails here', async () => {
    for (const css of await cssWidths()) {
      expect(servedWidth(css), `${css}px`).toBeGreaterThanOrEqual(css * 2);
      expect(servedWidth(css), `${css}px`).toBeLessThanOrEqual(css * 2 * 1.34);
    }
  });

  it('configures no width that no shipped site is served', async () => {
    const served = new Set((await cssWidths()).map(servedWidth));

    expect([...IMAGE_SIZES, ...DEVICE_SIZES].filter((w) => !served.has(w))).toEqual([]);
  });

  it('keeps the two lists ascending, small ones below the device ones, as Next requires', () => {
    expect(IMAGE_SIZES).toEqual([...IMAGE_SIZES].sort((a, b) => a - b));
    expect(DEVICE_SIZES).toEqual([...DEVICE_SIZES].sort((a, b) => a - b));
    expect(Math.max(...IMAGE_SIZES)).toBeLessThan(Math.min(...DEVICE_SIZES));
  });
});
