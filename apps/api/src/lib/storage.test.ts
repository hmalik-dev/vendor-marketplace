import { describe, expect, it } from 'vitest';
import { buildObjectKey, ownsObjectKey, publicUrlFor } from './storage.js';

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
