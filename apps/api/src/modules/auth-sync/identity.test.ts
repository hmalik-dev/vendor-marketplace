import { describe, expect, it } from 'vitest';
import { providerAvatarUrl } from './identity.js';

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
