import { describe, expect, it } from 'vitest';
import { serialiseJsonLd, stripBidiControls } from './index.js';

/*
 * #398. `JSON.stringify` escapes what JSON needs and nothing HTML needs, and
 * the only way to put JSON-LD on a page is `dangerouslySetInnerHTML` — so a
 * vendor's own business name could close the script element and open another.
 */
describe('serialiseJsonLd', () => {
  it('cannot close the script element that carries it', () => {
    const serialised = serialiseJsonLd({ name: '</script><script>alert(1)</script>' });

    expect(serialised).not.toContain('<');
    expect(serialised).not.toContain('>');
    expect(serialised).toContain('\\u003c');
  });

  it('escapes the ampersand too, so the angle brackets cannot come back as entities', () => {
    expect(serialiseJsonLd({ name: '&lt;script&gt;' })).not.toContain('&');
  });

  /*
   * Legal in a JSON string, a line terminator in JavaScript source: they end
   * the statement they are sitting in.
   */
  it('escapes the two separators that are legal in JSON and illegal in JS', () => {
    const serialised = serialiseJsonLd({ name: `a\u2028b\u2029c` });

    expect(serialised).toContain('\\u2028');
    expect(serialised).toContain('\\u2029');
    expect(serialised).not.toContain('\u2028');
    expect(serialised).not.toContain('\u2029');
  });

  it('still parses back to exactly the object it was handed', () => {
    const payload = {
      '@context': 'https://schema.org',
      name: 'Kessler & Co. </script>',
      rating: 4.9,
      nested: { city: 'Austin', tags: ['<b>', 'plain'] },
    };

    expect(JSON.parse(serialiseJsonLd(payload))).toEqual(payload);
  });

  it('leaves ordinary text alone', () => {
    expect(serialiseJsonLd({ name: 'Salt & Vine Studio' })).toBe(
      '{"name":"Salt \\u0026 Vine Studio"}',
    );
  });
});

/*
 * #398's second half. An override in a venue name reorders the sentence it
 * sits in — the booking reads as one place on screen and another in the row
 * a dispute is settled from.
 */
describe('stripBidiControls', () => {
  it('removes every override and isolate', () => {
    for (const codepoint of [
      0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
    ])
      expect(stripBidiControls(`a${String.fromCodePoint(codepoint)}b`)).toBe('ab');
  });

  it('leaves ordinary right-to-left text alone — the letters carry their own direction', () => {
    expect(stripBidiControls('مرحبا Barr Mansion')).toBe('مرحبا Barr Mansion');
  });

  it('leaves the zero-width joiner alone, which emoji need', () => {
    expect(stripBidiControls('👩‍🚀')).toBe('👩‍🚀');
  });
});
