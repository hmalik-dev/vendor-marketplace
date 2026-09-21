import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /.well-known/security.txt', () => {
  it('answers 200 text/plain with an Expires in the future', async () => {
    const response = GET();
    const body = await response.text();
    const expires = /^Expires: (.+)$/m.exec(body)?.[1] ?? '';

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(Date.parse(expires)).toBeGreaterThan(Date.now());
    expect(body).toMatch(/^Contact: mailto:security@/m);
  });
});
