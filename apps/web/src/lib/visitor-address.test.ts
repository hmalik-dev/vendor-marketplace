import { afterEach, describe, expect, it, vi } from 'vitest';
import { visitorAddress } from './visitor-address';

afterEach(() => vi.unstubAllEnvs());

describe('visitorAddress', () => {
  it('takes the rightmost x-forwarded-for entry, never the leftmost', () => {
    const headers = new Headers({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1, 203.0.113.7' });

    expect(visitorAddress(headers)).toBe('203.0.113.7');
  });

  it('gives the same answer whatever the caller wrote first', () => {
    const a = visitorAddress(new Headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.7' }));
    const b = visitorAddress(new Headers({ 'x-forwarded-for': '2.2.2.2, 203.0.113.7' }));

    expect(a).toBe('203.0.113.7');
    expect(b).toBe(a);
  });

  it('prefers the platform header on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    const headers = new Headers({
      'x-real-ip': '198.51.100.9',
      'x-forwarded-for': '6.6.6.6, 1.2.3.4',
    });

    expect(visitorAddress(headers)).toBe('198.51.100.9');
  });

  it('ignores x-real-ip off Vercel, where nothing overwrites it', () => {
    const headers = new Headers({ 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '203.0.113.7' });

    expect(visitorAddress(headers)).toBe('203.0.113.7');
  });

  it('falls back to x-forwarded-for on Vercel when the platform header is blank', () => {
    vi.stubEnv('VERCEL', '1');
    const headers = new Headers({ 'x-real-ip': ' ', 'x-forwarded-for': '203.0.113.7' });

    expect(visitorAddress(headers)).toBe('203.0.113.7');
  });

  it('names nobody when no header carries an address', () => {
    expect(visitorAddress(new Headers())).toBeNull();
    expect(visitorAddress(new Headers({ 'x-forwarded-for': ' , ' }))).toBeNull();
  });
});
