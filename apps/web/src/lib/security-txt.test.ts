import { describe, expect, it } from 'vitest';
import { BRAND_DOMAIN } from '@vendor-marketplace/shared';
import { securityTxt } from './security-txt';

describe('securityTxt', () => {
  const now = new Date('2026-09-21T00:00:00.000Z');
  const body = securityTxt(now, 'https://orla.example.com');

  it('names a contact derived from the brand domain', () => {
    expect(body).toContain(`Contact: mailto:security@${BRAND_DOMAIN}\n`);
  });

  it('expires in the future, under a year out (RFC 9116)', () => {
    const expires = /^Expires: (.+)$/m.exec(body)?.[1] ?? '';
    const days = (Date.parse(expires) - now.getTime()) / 86_400_000;

    expect(days).toBe(182);
  });

  it('names its canonical location and language', () => {
    expect(body).toContain('Canonical: https://orla.example.com/.well-known/security.txt\n');
    expect(body).toContain('Preferred-Languages: en\n');
  });
});
