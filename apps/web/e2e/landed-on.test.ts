import { describe, expect, it } from 'vitest';

import { landedOn } from './landed-on.js';

describe('landedOn', () => {
  it('matches the route itself, with or without a query or hash', () => {
    expect(landedOn('http://localhost:3000/bookings', '/bookings')).toBe(true);
    expect(landedOn('http://localhost:3000/bookings?tab=past#top', '/bookings')).toBe(true);
  });

  it('does not treat a route dot as "any character"', () => {
    expect(landedOn('http://localhost:3000/adminXfoo', '/admin.foo')).toBe(false);
    expect(landedOn('http://localhost:3000/admin.foo', '/admin.foo')).toBe(true);
  });

  it('does not match a longer or nested path', () => {
    expect(landedOn('http://localhost:3000/vendor/bookings', '/bookings')).toBe(false);
    expect(landedOn('http://localhost:3000/bookings/42', '/bookings')).toBe(false);
  });
});
