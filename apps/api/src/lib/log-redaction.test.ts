import { describe, expect, it } from 'vitest';
import { redactQueryValues } from './log-redaction.js';

describe('redactQueryValues', () => {
  it('leaves a URL with no query string alone', () => {
    expect(redactQueryValues('/vendors/kessler-and-co')).toBe('/vendors/kessler-and-co');
  });

  /*
   * #215: a session JWT reached the API's own log through the stream URL, 27
   * of them in one lane's dev log. The fix moves the credential out of the
   * URL, but the logger must not be the thing standing between a future
   * mistake and a credential in a logfile.
   */
  it('redacts a token that reaches a URL again', () => {
    expect(redactQueryValues('/events/stream?token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.abc')).toBe(
      '/events/stream?token=[redacted]',
    );
  });

  /*
   * Every value, not a list of known-sensitive names: the parameter that
   * leaks next is by definition the one nobody thought to add to a list.
   */
  it('redacts values it has no particular reason to suspect', () => {
    expect(redactQueryValues('/vendors?category=photography&city=Austin')).toBe(
      '/vendors?category=[redacted]&city=[redacted]',
    );
  });

  /** The shape stays legible, which is what the log was for. */
  it('keeps the path and the parameter names', () => {
    const redacted = redactQueryValues('/vendors?category=photography&page=2');

    expect(redacted.startsWith('/vendors?')).toBe(true);
    expect(redacted).toContain('category=');
    expect(redacted).toContain('page=');
    expect(redacted).not.toContain('photography');
  });

  it('redacts a repeated parameter every time it appears', () => {
    expect(redactQueryValues('/search?tag=a&tag=b')).toBe('/search?tag=[redacted]&tag=[redacted]');
  });

  it('redacts a parameter that has no value', () => {
    expect(redactQueryValues('/search?tag=&q=x')).toBe('/search?tag=[redacted]&q=[redacted]');
  });

  it('handles a bare `?` without inventing a parameter', () => {
    expect(redactQueryValues('/search?')).toBe('/search?');
  });

  /*
   * The leak this function exists to stop, in the shape that walks past a
   * naive implementation: a credential sitting in the NAME position, with no
   * `=` after it. Keeping names verbatim would log it in full.
   */
  it('redacts a bare credential that arrives with no parameter name', () => {
    const jwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIn0.sig';

    expect(redactQueryValues(`/events/stream?${jwt}`)).not.toContain('eyJhbGci');
    expect(redactQueryValues(`/events/stream?${jwt}`)).toBe('/events/stream?[redacted]=[redacted]');
  });

  it('redacts a parameter name that is not an ordinary name', () => {
    expect(redactQueryValues('/search?%%%=x')).not.toContain('%%%');
  });

  /*
   * A malformed query must not throw inside a logger: the log line is written
   * on the request path, so a crash here would take the request with it.
   */
  it('never throws on a query string that does not parse', () => {
    expect(() => redactQueryValues('/search?%%%&=&&x')).not.toThrow();
    expect(redactQueryValues('/search?%%%&=&&x')).not.toContain('%%%');
  });

  it('leaves a fragment-free absolute path untouched apart from its values', () => {
    expect(redactQueryValues('/events/stream?ticket=abc123')).toBe(
      '/events/stream?ticket=[redacted]',
    );
  });
});
