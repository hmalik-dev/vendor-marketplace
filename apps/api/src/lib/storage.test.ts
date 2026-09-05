import { describe, expect, it } from 'vitest';
import { resolveImageUrl } from '@vendor-marketplace/shared';
import {
  assertOwnedImageRefs,
  buildObjectKey,
  ownsObjectKey,
  publicUrlFor,
  thumbnailKeyFor,
} from './storage.js';

describe('buildObjectKey', () => {
  it('namespaces the object by prefix and owner, and keeps the extension', () => {
    const key = buildObjectKey('vendor-profile', 'owner-1', 'webp');

    expect(key).toMatch(/^vendor-profile\/owner-1\/[0-9a-f-]{36}\.webp$/);
  });

  it('never reuses a key', () => {
    const keys = new Set(
      Array.from({ length: 50 }, () => buildObjectKey('portfolio', 'owner-1', 'webp')),
    );

    expect(keys.size).toBe(50);
  });

  it('rejects a prefix that could escape its namespace', () => {
    expect(() => buildObjectKey('../../etc', 'owner-1', 'webp')).toThrow();
  });

  it('rejects an owner that could escape its namespace', () => {
    expect(() => buildObjectKey('portfolio', '../vendor-profile', 'webp')).toThrow();
    expect(() => buildObjectKey('portfolio', '', 'webp')).toThrow();
  });
});

/*
 * The owner segment is the ONLY record of who minted a key — there is no
 * uploads table — and the key on a row is written by the client, from values
 * public vendor pages hand out. Without this, a vendor could claim a rival's
 * key on their own row, delete the row, and take the rival's photo with it.
 */
describe('ownsObjectKey', () => {
  it('accepts a key minted for this owner', () => {
    expect(ownsObjectKey(buildObjectKey('portfolio', 'owner-1', 'webp'), 'owner-1')).toBe(true);
  });

  it('refuses a key minted for someone else', () => {
    expect(ownsObjectKey(buildObjectKey('portfolio', 'owner-2', 'webp'), 'owner-1')).toBe(false);
  });

  /* Pre-owner-segment keys have two parts and are never reaped. */
  it('refuses a legacy key with no owner segment', () => {
    expect(ownsObjectKey('portfolio/abc.webp', 'owner-1')).toBe(false);
  });

  it('refuses an absolute URL, which some seeded rows carry', () => {
    expect(ownsObjectKey('http://cdn.test/portfolio/owner-1/abc.webp', 'owner-1')).toBe(false);
  });

  it('refuses a key whose first segment is not a known prefix', () => {
    expect(ownsObjectKey('not-a-prefix/owner-1/abc.webp', 'owner-1')).toBe(false);
  });
});

/**
 * The write-side question, and deliberately not `!ownsObjectKey` (#407).
 *
 * An image reference is legitimately one of three shapes and only one of them
 * carries an owner, so only one of them can be refused. Asking "is this mine"
 * on the way in would reject every seeded site-relative path and every Clerk
 * avatar, which is why the guard asks "is this someone else's" instead.
 */
describe('assertOwnedImageRefs', () => {
  /** The origin `resolveImageUrl` would build these references against. */
  const CDN_BASE = 'https://cdn.test';
  /**
   * `S3_PUBLIC_URL` is an origin **and a path** — locally
   * `http://localhost:9000/vendor-marketplace-uploads`, and an R2 bucket is
   * addressed the same way. The absolute form of a key therefore carries a
   * bucket segment before the prefix, which is the shape a browser pass found
   * still accepted after the first two fixes.
   */
  const BUCKET_BASE = 'http://localhost:9000/vendor-marketplace-uploads';
  const MINE = 'portfolio/owner-1/abc.webp';
  const THEIRS = 'portfolio/owner-2/abc.webp';

  it('refuses a key minted for another account', () => {
    expect(() => assertOwnedImageRefs([THEIRS], 'owner-1')).toThrow(
      'That image belongs to another account',
    );
  });

  it('refuses it wherever it appears in the list', () => {
    expect(() => assertOwnedImageRefs([MINE, null, THEIRS], 'owner-1')).toThrow();
  });

  /*
   * The bypass a security audit of #407 found, and the reason the guard
   * normalizes before deciding. `keys:from-urls` is a re-runnable normalizer
   * over exactly these columns: it strips the configured public base, so an
   * absolute URL wrapping a foreign key becomes that bare key afterwards — and
   * `findUnreferencedKeys` compares exact strings, so from then on the row
   * pins the owner's own delete for ever.
   */
  it.each([
    ['wrapped in the CDN origin', `${CDN_BASE}/portfolio/owner-2/abc.webp`],
    ['wrapped in some other origin', 'http://evil.example/portfolio/owner-2/abc.webp'],
    ['made site-relative', '/portfolio/owner-2/abc.webp'],
    ['made explicitly relative', './portfolio/owner-2/abc.webp'],
    ['padded with a dot segment', 'portfolio/owner-2/./abc.webp'],
    ['padded with an encoded dot segment', 'portfolio/owner-2/%2e/abc.webp'],
    ['padded with an empty segment', 'portfolio/owner-2//abc.webp'],
    ['walked back up', 'portfolio/owner-2/nested/../abc.webp'],
    ['spelled with backslashes', 'portfolio\\owner-2\\abc.webp'],
    ['spelled with one backslash', 'portfolio/owner-2\\abc.webp'],
    ['with an encoded separator', 'portfolio/owner-2%2Fabc.webp'],
    ['wrapped in the bucket URL', `${BUCKET_BASE}/portfolio/owner-2/abc.webp`],
    ['wrapped in the bucket URL with a dot segment', `${BUCKET_BASE}/portfolio/owner-2/./abc.webp`],
  ])('refuses a foreign key %s', (_label, ref) => {
    expect(() => assertOwnedImageRefs([ref], 'owner-1')).toThrow(
      'That image belongs to another account',
    );
  });

  /*
   * The question that would have caught both bypasses, asked as a check rather
   * than as a list: **does the guard decide on the same object the browser will
   * fetch?** Every spelling a URL parser resolves onto the victim's object has
   * to be refused, however it is punctuated — enumerating spellings is how the
   * next one gets missed.
   */
  it('refuses every spelling that resolves onto another account’s object', () => {
    const victim = 'portfolio/owner-2/abc.webp';
    const target = new URL(`${CDN_BASE}/${victim}`).href;

    const spellings = [
      victim,
      `./${victim}`,
      `${CDN_BASE}/${victim}`,
      'portfolio/owner-2/./abc.webp',
      'portfolio/owner-2/%2e/abc.webp',
      'portfolio/owner-2/%2E/abc.webp',
      'portfolio/owner-2/nested/../abc.webp',
      'portfolio\\owner-2\\abc.webp',
      'portfolio/owner-2\\abc.webp',
    ];

    for (const ref of spellings) {
      /*
       * The premise, asserted rather than assumed: each spelling really does
       * fetch the victim's object once `resolveImageUrl` has joined it to the
       * base and a URL parser has normalised the result.
       */
      expect(new URL(resolveImageUrl(CDN_BASE, ref)!).href, ref).toBe(target);
      expect(() => assertOwnedImageRefs([ref], 'owner-1'), ref).toThrow(
        'That image belongs to another account',
      );
    }
  });

  /* The caller's own key in those same spellings is still theirs. */
  it.each([
    `${CDN_BASE}/portfolio/owner-1/abc.webp`,
    `${BUCKET_BASE}/portfolio/owner-1/abc.webp`,
    `${BUCKET_BASE}/customer-profile/owner-1/abc.webp`,
    '/portfolio/owner-1/abc.webp',
    './portfolio/owner-1/abc.webp',
  ])('still accepts the caller’s own key spelled as %s', (ref) => {
    expect(() => assertOwnedImageRefs([ref], 'owner-1')).not.toThrow();
  });

  /*
   * `ownsObjectKey` is deliberately NOT widened to match. Refusing more on the
   * way in costs a caller nothing; reaping more on the way out deletes bytes an
   * absolute URL still points at, and that is unrecoverable.
   */
  it('leaves the reap guard deciding on the raw spelling', () => {
    expect(ownsObjectKey(`${CDN_BASE}/portfolio/owner-1/abc.webp`, 'owner-1')).toBe(false);
  });

  it('answers 403 rather than a validation error', () => {
    expect(() => assertOwnedImageRefs([THEIRS], 'owner-1')).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it.each([
    ['the caller’s own key', MINE],
    ['a legacy key with no owner segment', 'portfolio/abc.webp'],
    ['seeded site-relative art', '/images/marketing/hero.webp'],
    ['a Clerk avatar on a host that is not ours', 'https://img.clerk.com/a.png'],
    ['a path under a prefix this API never writes', 'not-a-prefix/owner-2/abc.webp'],
  ])('accepts %s', (_label, ref) => {
    expect(() => assertOwnedImageRefs([ref], 'owner-1')).not.toThrow();
  });

  /*
   * The scan is for the key's *shape*, not for the word. A path that merely
   * contains a prefix segment names no owner, or the guard would start refusing
   * unrelated art on a foreign host.
   */
  it.each([
    ['a prefix segment too deep in the path', 'https://img.example/portfolio/a/b/c.webp'],
    ['a prefix segment with nothing after it', 'https://img.example/gallery/portfolio'],
    ['a prefix as a filename', 'https://img.example/albums/portfolio.webp'],
    ['a Clerk avatar with a multi-segment path', 'https://img.clerk.com/eyJ0eXAi/user/abc.png'],
  ])('reads no owner from %s', (_label, ref) => {
    expect(() => assertOwnedImageRefs([ref], 'owner-1')).not.toThrow();
  });

  it('accepts an absent reference', () => {
    expect(() => assertOwnedImageRefs([null, undefined], 'owner-1')).not.toThrow();
  });
});

describe('publicUrlFor', () => {
  it('joins the public base URL and the object key', () => {
    expect(publicUrlFor('http://cdn.test', 'vendor-profile/abc.webp')).toBe(
      'http://cdn.test/vendor-profile/abc.webp',
    );
  });

  it('does not double up on a slash', () => {
    expect(publicUrlFor('http://cdn.test/', 'vendor-profile/abc.webp')).toBe(
      'http://cdn.test/vendor-profile/abc.webp',
    );
  });
});

/**
 * The upload route writes `<name>.webp` and `<name>-thumb.webp` for every
 * prefix, but only `portfolio_items` has a column for the second one. For a
 * profile image or a cover this derivation is the *only* record that the
 * sibling exists, so it has to agree with the writer exactly — disagree and the
 * reap removes nothing while believing it removed everything.
 */
describe('thumbnailKeyFor', () => {
  it('names the sibling the upload route writes beside the image', () => {
    expect(thumbnailKeyFor('vendor-profile/owner-1/abc.webp')).toBe(
      'vendor-profile/owner-1/abc-thumb.webp',
    );
  });

  it('touches only the extension, never the owner segment', () => {
    const derived = thumbnailKeyFor('portfolio/owner-1/abc.webp');

    expect(ownsObjectKey(derived, 'owner-1')).toBe(true);
  });

  it('leaves a key that is not a WebP alone rather than inventing one', () => {
    expect(thumbnailKeyFor('portfolio/owner-1/abc.png')).toBe('portfolio/owner-1/abc.png');
  });
});
