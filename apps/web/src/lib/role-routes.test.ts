import { describe, expect, it } from 'vitest';
import type { UserRole } from '@vendor-marketplace/shared';
import {
  DASHBOARD_PATH_BY_ROLE,
  POST_SIGN_IN_PATH_BY_ROLE,
  postSignInPath,
  roleCanReach,
} from './role-routes';

const ROLES: readonly UserRole[] = ['customer', 'vendor', 'admin'];

describe('roleCanReach', () => {
  it.each([
    ['/vendor/dashboard', 'vendor'],
    ['/vendor', 'vendor'],
    ['/vendor/packages?filter=active', 'vendor'],
    ['/customer/profile', 'customer'],
    ['/admin/vendors', 'admin'],
    ['/bookings', 'customer'],
    ['/bookings?tab=history', 'customer'],
    ['/bookings/abc-123/checkout', 'customer'],
    ['/vendors/june-harlow/request?package=p1', 'customer'],
  ] as const)('lets only %s be reached by a %s', (path, allowed) => {
    for (const role of ROLES) {
      expect(roleCanReach(role, path)).toBe(role === allowed);
    }
  });

  /*
   * `/` is the catalogue of other vendors, which `redirectVendorToDashboard`
   * sends a vendor away from. Everybody else renders it.
   */
  it('sends a vendor away from the marketplace home and nobody else', () => {
    expect(roleCanReach('vendor', '/')).toBe(false);
    expect(roleCanReach('customer', '/')).toBe(true);
    expect(roleCanReach('admin', '/')).toBe(true);
  });

  /*
   * The gate is `/vendors/<slug>/request`, not the storefront around it. A
   * prefix match on `/vendor` would have swallowed the whole public catalogue
   * and bounced every customer off every vendor's page.
   */
  it.each([
    '/vendors',
    '/vendors/june-harlow',
    '/vendors/june-harlow?date=2026-06-14',
    '/search',
    '/messages',
    '/vendor-guide',
  ])('leaves %s reachable by every role', (path) => {
    for (const role of ROLES) {
      expect(roleCanReach(role, path)).toBe(true);
    }
  });

  it('matches on the path only, never on the query', () => {
    // A query that merely mentions another route does not change who may render.
    expect(roleCanReach('vendor', '/search?q=%2Fcustomer%2Fprofile')).toBe(true);
    expect(roleCanReach('customer', '/bookings?next=/vendor/dashboard')).toBe(true);
  });

  /*
   * The role bounce redirects to these maps, so a role whose entry it cannot
   * itself render bounces forever. This is the loop guard as an assertion
   * rather than as a comment: an admin whose start was `/bookings` hit
   * ERR_TOO_MANY_REDIRECTS.
   */
  it.each([
    ['DASHBOARD_PATH_BY_ROLE', DASHBOARD_PATH_BY_ROLE],
    ['POST_SIGN_IN_PATH_BY_ROLE', POST_SIGN_IN_PATH_BY_ROLE],
  ] as const)('never points %s at a route that role is bounced out of', (_label, map) => {
    for (const role of ROLES) {
      expect([role, map[role], roleCanReach(role, map[role])]).toEqual([role, map[role], true]);
    }
  });
});

describe('DASHBOARD_PATH_BY_ROLE', () => {
  /*
   * A customer has no dashboard and never did — their home is the list of
   * bookings they have made, which is what #22b put at `/bookings` in place of
   * the placeholder that used to sit under `/customer`.
   */
  it('sends a customer to their bookings and a vendor to their dashboard', () => {
    expect(DASHBOARD_PATH_BY_ROLE.customer).toBe('/bookings');
    expect(DASHBOARD_PATH_BY_ROLE.vendor).toBe('/vendor/dashboard');
  });

  it('sends an admin to the operations console', () => {
    expect(DASHBOARD_PATH_BY_ROLE.admin).toBe('/admin');
  });
});

describe('POST_SIGN_IN_PATH_BY_ROLE', () => {
  it('starts a vendor on their own dashboard', () => {
    expect(POST_SIGN_IN_PATH_BY_ROLE.vendor).toBe(DASHBOARD_PATH_BY_ROLE.vendor);
  });

  it('starts a customer on the marketplace home, not a dashboard', () => {
    // Browsing vendors is the customer's first move; the dashboard is not.
    expect(POST_SIGN_IN_PATH_BY_ROLE.customer).toBe('/');
    expect(POST_SIGN_IN_PATH_BY_ROLE.customer).not.toBe(DASHBOARD_PATH_BY_ROLE.customer);
  });

  /*
   * An operator signs in to operate. Like a vendor, and unlike a customer, they
   * have no use for a catalogue of vendors as a starting place.
   */
  it('starts an admin on the console rather than the marketplace home', () => {
    expect(POST_SIGN_IN_PATH_BY_ROLE.admin).toBe(DASHBOARD_PATH_BY_ROLE.admin);
    expect(POST_SIGN_IN_PATH_BY_ROLE.admin).not.toBe('/');
  });
});

describe('postSignInPath', () => {
  it('keeps a destination the role can render', () => {
    expect(
      postSignInPath('customer', '/vendors/june-harlow/request?package=p1&date=2026-12-05'),
    ).toBe('/vendors/june-harlow/request?package=p1&date=2026-12-05');
    expect(postSignInPath('vendor', '/vendor/packages?filter=active')).toBe(
      '/vendor/packages?filter=active',
    );
    expect(postSignInPath('admin', '/admin/reviews')).toBe('/admin/reviews');
  });

  /*
   * #410, one case per reproduction in the ticket. Each of these used to be
   * forwarded verbatim, and the bounce that met it there was an RSC redirect on
   * a client-side navigation — which left a blank page wearing the signed-out
   * header rather than moving the browser anywhere.
   */
  it.each([
    ['a vendor sent to the booking request form', 'vendor', '/vendors/e2e-test-studio/request'],
    ['a vendor sent to the customer profile', 'vendor', '/customer/profile'],
    ['a vendor sent to the marketplace home', 'vendor', '/'],
    ['a vendor sent to the bookings hub', 'vendor', '/bookings?tab=upcoming'],
    ['a customer sent to the vendor dashboard', 'customer', '/vendor/dashboard'],
    ['a customer sent to the admin console', 'customer', '/admin'],
    ['an admin sent to the vendor dashboard', 'admin', '/vendor/dashboard'],
    ['an admin sent to the bookings hub', 'admin', '/bookings'],
    ['an admin sent to the booking request form', 'admin', '/vendors/june-harlow/request'],
  ] as const)('starts %s on their own home instead', (_label, role, returnTo) => {
    expect(postSignInPath(role, returnTo)).toBe(POST_SIGN_IN_PATH_BY_ROLE[role]);
  });

  it('falls back to the role start when nothing was carried', () => {
    for (const role of ROLES) {
      expect(postSignInPath(role, null)).toBe(POST_SIGN_IN_PATH_BY_ROLE[role]);
      expect(postSignInPath(role, undefined)).toBe(POST_SIGN_IN_PATH_BY_ROLE[role]);
    }
  });

  /*
   * The open-redirect boundary is here as well as in `safeReturnPath`: this is
   * the value that reaches the redirect, so it is re-validated rather than
   * trusted because the sign-in screen looked at it first.
   */
  it.each([
    ['an absolute URL', 'https://evil.test/steal'],
    ['a scheme-relative URL', '//evil.test'],
    ['a path that normalises scheme-relative', '/x/..//evil.test'],
    ['a dot-segment loop back into sign-in', '/x/../sign-in'],
    ['a bare loop back into sign-up', '/sign-up'],
    ['a control character', '/bookings\nLocation: https://evil.test'],
  ])('rejects %s and uses the role start', (_label, value) => {
    expect(postSignInPath('customer', value)).toBe(POST_SIGN_IN_PATH_BY_ROLE.customer);
  });

  /*
   * Whatever it returns is somewhere the role renders, for every input — which
   * is the property the three reproductions in #410 all violated.
   */
  it.each(['/vendor/dashboard', '/customer/profile', '/admin', '/bookings', '/', '//evil.test'])(
    'never returns a route the role is bounced out of, for %s',
    (returnTo) => {
      for (const role of ROLES) {
        expect([returnTo, role, roleCanReach(role, postSignInPath(role, returnTo))]).toEqual([
          returnTo,
          role,
          true,
        ]);
      }
    },
  );
});
