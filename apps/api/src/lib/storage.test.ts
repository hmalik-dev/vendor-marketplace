import { describe, expect, it } from 'vitest';
import { buildObjectKey, publicUrlFor } from './storage.js';

describe('buildObjectKey', () => {
  it('namespaces the object by prefix and keeps the extension', () => {
    const key = buildObjectKey('vendor-profile', 'webp');

    expect(key).toMatch(/^vendor-profile\/[0-9a-f-]{36}\.webp$/);
  });

  it('never reuses a key', () => {
    const keys = new Set(Array.from({ length: 50 }, () => buildObjectKey('portfolio', 'webp')));

    expect(keys.size).toBe(50);
  });

  it('rejects a prefix that could escape its namespace', () => {
    expect(() => buildObjectKey('../../etc', 'webp')).toThrow();
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
