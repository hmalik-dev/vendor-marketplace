import { describe, expect, it } from 'vitest';
import { resolveImageUrl, toObjectKey } from './index.js';

const CDN = 'https://cdn.example.com';

describe('resolveImageUrl', () => {
  it('builds a URL from a stored object key', () => {
    expect(resolveImageUrl(CDN, 'vendor-profile/abc.webp')).toBe(
      'https://cdn.example.com/vendor-profile/abc.webp',
    );
  });

  /*
   * The whole point of the ticket: the CDN moves and every image follows, with
   * no row rewritten.
   */
  it('repoints every image when the base changes, with no data change', () => {
    const key = 'portfolio/abc.webp';

    expect(resolveImageUrl(CDN, key)).toBe('https://cdn.example.com/portfolio/abc.webp');
    expect(resolveImageUrl('https://images.orla.test', key)).toBe(
      'https://images.orla.test/portfolio/abc.webp',
    );
  });

  it('tolerates a trailing slash on the base', () => {
    expect(resolveImageUrl(`${CDN}/`, 'portfolio/abc.webp')).toBe(
      'https://cdn.example.com/portfolio/abc.webp',
    );
  });

  /* Neither of these is ours to host, so neither gets a base prepended. */
  it('passes an absolute URL through untouched', () => {
    expect(resolveImageUrl(CDN, 'https://img.auth.com/abc')).toBe('https://img.auth.com/abc');
  });

  /*
   * Storage moved from Cloudflare R2 to Neon. A row written under the old
   * public host would otherwise keep pointing at a bucket nobody serves from.
   */
  it.each([
    ['https://pub-f0933b41.r2.dev/portfolio/a.webp', 'portfolio/a.webp'],
    [
      'https://acct.r2.cloudflarestorage.com/orla-uploads/vendor-cover/u1/b.webp',
      'vendor-cover/u1/b.webp',
    ],
    ['https://pub-f0933b41.r2.dev/customer-profile/u2/c.png?v=2', 'customer-profile/u2/c.png'],
  ])('repoints the old R2 URL %s to the configured base', (stored, key) => {
    expect(resolveImageUrl('https://br-x.storage.example/uploads', stored)).toBe(
      `https://br-x.storage.example/uploads/${key}`,
    );
  });

  it('leaves an R2 URL that names no known key prefix alone', () => {
    expect(resolveImageUrl(CDN, 'https://pub-f0933b41.r2.dev/other/a.webp')).toBe(
      'https://pub-f0933b41.r2.dev/other/a.webp',
    );
  });

  it('passes a site-relative marketing path through untouched', () => {
    expect(resolveImageUrl(CDN, '/marketing/vendors/june-harlow.jpg')).toBe(
      '/marketing/vendors/june-harlow.jpg',
    );
  });

  it.each([null, undefined, '', '   '])('has no URL for %p', (stored) => {
    expect(resolveImageUrl(CDN, stored)).toBeNull();
  });

  /* A bare host would render the bucket root, which is worse than nothing. */
  it('has no URL for a key when no base is configured', () => {
    expect(resolveImageUrl(undefined, 'portfolio/abc.webp')).toBeNull();
    expect(resolveImageUrl('', 'portfolio/abc.webp')).toBeNull();
  });

  it('still resolves an absolute URL when no base is configured', () => {
    expect(resolveImageUrl(undefined, 'https://img.auth.com/abc')).toBe('https://img.auth.com/abc');
  });
});

describe('toObjectKey', () => {
  it('strips a known base so an absolute URL becomes its key', () => {
    expect(toObjectKey(CDN, 'https://cdn.example.com/portfolio/abc.webp')).toBe(
      'portfolio/abc.webp',
    );
  });

  it('tolerates a trailing slash on the base', () => {
    expect(toObjectKey(`${CDN}/`, 'https://cdn.example.com/portfolio/abc.webp')).toBe(
      'portfolio/abc.webp',
    );
  });

  /* An auth avatar is not under our base and must survive the migration. */
  it('leaves a value from another host exactly as it is', () => {
    expect(toObjectKey(CDN, 'https://img.auth.com/abc')).toBe('https://img.auth.com/abc');
    expect(toObjectKey(CDN, '/marketing/vendors/a.jpg')).toBe('/marketing/vendors/a.jpg');
  });

  it('leaves a value that is already a key alone', () => {
    expect(toObjectKey(CDN, 'portfolio/abc.webp')).toBe('portfolio/abc.webp');
  });
});
