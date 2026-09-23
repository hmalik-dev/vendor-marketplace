import { describe, expect, it } from 'vitest';
import { mirroredIdentity, providerAvatarUrl } from './identity.js';

describe('mirroredIdentity (VEN-649)', () => {
  it('stores the address lowercased and trimmed, as the unique index compares it', () => {
    const identity = {
      id: 'auth-1',
      email: '  Ada.Lovelace@Example.COM ',
      name: 'Ada',
      image: null,
    };

    expect(mirroredIdentity(identity).email).toBe('ada.lovelace@example.com');
  });

  it('still reads a blank address as no opinion', () => {
    expect(
      mirroredIdentity({ id: 'auth-1', email: '   ', name: 'Ada', image: null }).email,
    ).toBeNull();
  });
});

describe('providerAvatarUrl (VEN-538)', () => {
  it.each([
    ['https://lh3.example.com/a/photo.png', 'https://lh3.example.com/a/photo.png'],
    ['  http://cdn.example.com/x.jpg  ', 'http://cdn.example.com/x.jpg'],
  ])('keeps %j', (input, expected) => {
    expect(providerAvatarUrl(input)).toBe(expected);
  });

  it.each([
    'javascript:x',
    'data:image/png;base64,AAAA',
    '//evil.com/x.png',
    'https://u:p@evil.com/x',
    'https://evil.com/\\x',
    'https:/evil.com/x.png',
    'ftp://example.com/x.png',
    'https://evil.com/a\tb',
    `https://example.com/${'a'.repeat(500)}`,
    '',
    '   ',
    'uploads/avatar.webp',
  ])('refuses %j', (input) => {
    expect(providerAvatarUrl(input)).toBeNull();
  });

  it('accepts a URL of exactly 500 characters and refuses a non-string', () => {
    const exact = `https://example.com/${'a'.repeat(480)}`;

    expect(exact).toHaveLength(500);
    expect(providerAvatarUrl(exact)).toBe(exact);
    expect(providerAvatarUrl(42)).toBeNull();
    expect(providerAvatarUrl(undefined)).toBeNull();
  });
});
