import { describe, expect, it } from 'vitest';
import { accountLinksFor, roleHasMessages } from './account-links';

describe('accountLinksFor', () => {
  it.each([
    [
      'customer' as const,
      [
        ['My bookings', '/dashboard'],
        ['My profile', '/customer/profile'],
        ['Account settings', '/account/settings'],
        ['Contact support', '/support'],
      ],
    ],
    [
      'vendor' as const,
      [
        ['Dashboard', '/dashboard'],
        ['Account settings', '/account/settings'],
        ['Contact support', '/support'],
      ],
    ],
    [
      'admin' as const,
      [
        ['Admin', '/admin'],
        ['Account settings', '/account/settings'],
      ],
    ],
  ])('lists exactly the %s rows, in order', (role, rows) => {
    expect(accountLinksFor(role).map((link) => [link.label, link.href])).toEqual(rows);
  });
});

describe('roleHasMessages', () => {
  it('is true for a customer and a vendor, false for an admin', () => {
    expect([
      roleHasMessages('customer'),
      roleHasMessages('vendor'),
      roleHasMessages('admin'),
    ]).toEqual([true, true, false]);
  });
});
