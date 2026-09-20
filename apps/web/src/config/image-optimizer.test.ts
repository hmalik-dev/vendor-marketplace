import { describe, expect, it } from 'vitest';
import {
  IMAGE_MINIMUM_CACHE_TTL,
  IMAGE_QUALITY,
  imageRemotePatterns,
  optimizedImageProps,
} from './image-optimizer';

const BASE = 'https://ep-abc.storage.us-east-2.aws.neon.tech/uploads';
const KEY = `${BASE}/vendors/v1/cover.jpg`;

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
    expect(optimizedImageProps(KEY, BASE, 3000)).toContain('&w=3840&q=75');
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
    ['no configured base', KEY, undefined],
  ])('leaves %s to be served raw', (_name, src, base) => {
    expect(optimizedImageProps(src, base, 400)).toBeNull();
  });
});

describe('imageRemotePatterns', () => {
  it('allow-lists exactly the configured storage host, port and path — no other Neon tenant', () => {
    expect(imageRemotePatterns(BASE)).toEqual([
      {
        protocol: 'https',
        hostname: 'ep-abc.storage.us-east-2.aws.neon.tech',
        port: '',
        pathname: '/uploads/**',
      },
    ]);
  });

  it('pins a non-default port', () => {
    expect(imageRemotePatterns('https://media.example.com:8443/bucket')).toEqual([
      { protocol: 'https', hostname: 'media.example.com', port: '8443', pathname: '/bucket/**' },
    ]);
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
