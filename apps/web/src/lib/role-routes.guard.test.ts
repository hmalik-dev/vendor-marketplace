import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { UserRole } from '@vendor-marketplace/shared';
import { ROLE_ROUTE_RULES, roleCanReach } from '@/lib/role-routes';
import { sourceFiles, TS_AND_TSX, WEB_SOURCE, withoutComments } from '@/testing/source-scan';

/**
 * `ROLE_ROUTE_RULES` says which roles a route renders for. The routes themselves
 * say it too, in their `requireRole` calls — and nothing in the type system ties
 * the two together.
 *
 * That gap is the whole reason this file exists. A gate added under a path no
 * rule matches falls through `roleCanReach`'s default, `postSignInPath` forwards
 * a `returnTo` the role will be bounced out of, and the visitor lands on the
 * blank page #410 was filed for — on that route only, with nothing red anywhere.
 * A rule left behind after its gate is deleted is the mirror image: a
 * destination the role could perfectly well have rendered, exchanged for its
 * home for no reason.
 *
 * So the gates are read out of `app/` and checked against the table in both
 * directions. A grep beats a comment asking a future reader to remember.
 */

/** The App Router tree, whose directory layout *is* the URL. */
const APP = path.join(WEB_SOURCE, 'app');

const ROLES: readonly UserRole[] = ['customer', 'vendor', 'admin'];

/** `requireRole('vendor')` — the gate, and the role it admits. */
const REQUIRE_ROLE = /\brequireRole\(\s*['"](customer|vendor|admin)['"]/g;

/** `/`'s own gate. It turns a vendor away without naming a role to admit. */
const VENDOR_BOUNCE = /\bredirectVendorToDashboard\(/;

/** `/messages`' own gate: it turns an admin away without naming a role to admit. */
const ADMIN_BOUNCE = /\brequireNonAdmin\(/;

/**
 * A stand-in for a dynamic segment. Any concrete value does: the rules match
 * segment shapes, never slugs, and a value that changed the answer would be a
 * rule reading an id.
 */
const SAMPLE_SEGMENT = 'sample';

/**
 * The URL a file under `app/` gates — its directory path, with the App Router's
 * own notation resolved: route groups `(hub)` are organisational and contribute
 * no segment, and `[slug]` and `[requestId]` each stand for
 * one.
 */
function routeOf(name: string): string {
  const segments = name
    .split(path.sep)
    .slice(0, -1)
    .filter((segment) => !segment.startsWith('('))
    .map((segment) => (segment.startsWith('[') ? SAMPLE_SEGMENT : segment));

  return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
}

interface Gate {
  /** Repo-relative file the gate is written in, so a failure names it. */
  readonly file: string;
  /** The URLs that file gates — more than one when it gates a whole subtree. */
  readonly routes: readonly string[];
  /** The role the gate admits, or `null` for `/`'s vendor bounce. */
  readonly admits: UserRole | null;
  /** The role the gate turns away, when it names one rather than admitting one. */
  readonly denies: UserRole | null;
}

/**
 * The URLs a gate covers.
 *
 * A gate in a `layout.tsx` runs for **everything beneath it**, not only for the
 * layout's own URL — `/admin` is the only admin route with a gate written in it,
 * and `/admin/reviews` is protected by inheriting that layout. Checking the
 * layout's own URL alone therefore passes a rule far too narrow for what it
 * guards: `/^\/admin$/` satisfies every assertion here while leaving
 * `roleCanReach('customer', '/admin/reviews')` true, which is #410 again on
 * every page of the console. A child path is checked alongside the layout's own.
 */
function routesCoveredBy(name: string, route: string): readonly string[] {
  return path.basename(name).startsWith('layout.')
    ? [route, `${route === '/' ? '' : route}/${SAMPLE_SEGMENT}`]
    : [route];
}

/**
 * The vendor-application screens (VEN-629): each serves a session with no
 * account yet and sends an account holder of any role to their own home with
 * `redirect(DASHBOARD_PATH_BY_ROLE[account.role])`. That gate names no role, so
 * the scan below cannot see it; the files are pinned here and read directly.
 */
const NO_ACCOUNT_PAGES: Readonly<Record<string, string>> = {
  '/waitlist': 'waitlist/page.tsx',
  '/vendors/apply': 'vendors/apply/page.tsx',
  '/sign-up/vendor-details': 'sign-up/vendor-details/page.tsx',
};

const ACCOUNT_BOUNCE = /redirect\(DASHBOARD_PATH_BY_ROLE\[account\.role\]\)/;

let gates: Gate[] = [];

beforeAll(async () => {
  /*
   * `.ts` as well as `.tsx`: a `route.ts` handler is as capable of calling
   * `requireRole` as a page is, and a guard that only walked components would
   * have told the table it was complete while a handler gated a route it had
   * never heard of.
   */
  const files = await sourceFiles(APP, TS_AND_TSX);

  gates = files.flatMap((file) => {
    const routes = routesCoveredBy(file.name, routeOf(file.name));
    const found: Gate[] = [...file.code.matchAll(REQUIRE_ROLE)].map((match) => ({
      file: file.name,
      routes,
      admits: match[1] as UserRole,
      denies: null,
    }));

    if (VENDOR_BOUNCE.test(file.code)) {
      found.push({ file: file.name, routes, admits: null, denies: 'vendor' });
    }

    if (ADMIN_BOUNCE.test(file.code)) {
      found.push({ file: file.name, routes, admits: null, denies: 'admin' });
    }

    return found;
  });
});

describe('the role-route table against the gates in app/', () => {
  /*
   * The scan is the evidence, so it has to be shown to have found something.
   * A walk that silently matched nothing — a renamed helper, a directory moved
   * out from under `WEB_SOURCE` — would make every assertion below vacuous.
   */
  it('finds the gates at all', () => {
    expect(gates.length).toBeGreaterThanOrEqual(10);
    expect(gates.filter((gate) => gate.admits === 'vendor').length).toBeGreaterThan(0);
    expect(gates.filter((gate) => gate.admits === 'customer').length).toBeGreaterThan(0);
    expect(gates.filter((gate) => gate.admits === 'admin').length).toBeGreaterThan(0);
    // `/` and `/for-vendors`, the two `redirectVendorToDashboard` pages.
    expect(gates.filter((gate) => gate.denies === 'vendor').length).toBe(2);
    // `/messages`, the `requireNonAdmin` page.
    expect(gates.filter((gate) => gate.denies === 'admin').length).toBe(1);
  });

  /*
   * Forward: every gate is represented. This is the direction that reproduces
   * #410 when it fails — a gate the table has never heard of.
   */
  it('agrees with every gate about who renders that route', () => {
    const disagreements = gates.flatMap((gate) =>
      gate.routes.flatMap((route) =>
        ROLES.filter((role) => {
          const expected = gate.admits !== null ? role === gate.admits : role !== gate.denies;

          return roleCanReach(role, route) !== expected;
        }).map(
          (role) =>
            `${gate.file} gates ${route} to ${gate.admits ?? `everyone but ${gate.denies}`}, ` +
            `but roleCanReach('${role}', '${route}') is ${roleCanReach(role, route)}`,
        ),
      ),
    );

    expect(disagreements).toEqual([]);
  });

  /*
   * Backward: every rule is backed by a gate. A rule outliving the gate it
   * mirrors quietly exchanges a destination the role could have rendered for
   * its own home.
   */
  it('carries no rule that no gate backs', () => {
    const unbacked = ROLE_ROUTE_RULES.filter(
      (rule) =>
        !gates.some((gate) => gate.routes.some((route) => rule.pattern.test(route))) &&
        !Object.keys(NO_ACCOUNT_PAGES).some((route) => rule.pattern.test(route)),
    ).map((rule) => String(rule.pattern));

    expect(unbacked).toEqual([]);
  });

  /*
   * The no-account pages: each still bounces every account holder, and the table
   * turns every role away from it, so sign-in never forwards to the bounce.
   */
  it.each(Object.entries(NO_ACCOUNT_PAGES))(
    'turns every role away from %s, as its page does',
    async (route, file) => {
      const code = await readFile(path.join(APP, file), 'utf8');

      expect(withoutComments(code)).toMatch(ACCOUNT_BOUNCE);
      expect(ROLES.filter((role) => roleCanReach(role, route))).toEqual([]);
    },
  );
});

/*
 * VEN-532. A layout does not re-run on client navigation, so `/admin`'s own
 * `requireRole('admin')` is not enough: each admin page is role-checked next to
 * its data. A page does that one of two ways — a `requireRole('admin')` of its
 * own, or a call to an `admin-data` read, whose one session helper makes the
 * check. Both halves are pinned: the helper, and each page that leans on it.
 */
describe('every admin page checks the admin role itself', () => {
  const ADMIN_PAGE = /^admin[\\/](?:.*[\\/])?page\.tsx$/;
  const ADMIN_DATA_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/admin-data['"]/;
  const ADMIN_ROLE_CHECK = /\brequireRole\(\s*['"]admin['"]/;

  async function adminDataReads(): Promise<{ session: string; reads: Set<string> }> {
    // Comments stripped, so prose naming `requireRole('admin')` cannot stand in for the call.
    const source = withoutComments(
      await readFile(path.join(WEB_SOURCE, 'lib', 'admin-data.ts'), 'utf8'),
    );
    const session = /async function adminSession\(\)[^{]*\{([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
    const exported = [
      ...source.matchAll(/export (?:async function|function|const) (\w+)[\s\S]*?\n\}/g),
    ];

    // A read that bypasses `adminRead` would skip the session, and the check with it.
    expect(exported.filter((fn) => !/\badminRead\(/.test(fn[0])).map((fn) => fn[1])).toEqual([]);

    return { session, reads: new Set(exported.map((fn) => fn[1] as string)) };
  }

  it('makes the check in the session every admin-data read goes through', async () => {
    const { session, reads } = await adminDataReads();

    expect(session).toMatch(ADMIN_ROLE_CHECK);
    expect(reads.size).toBeGreaterThan(10);
  });

  it('leaves no admin page without a role check', async () => {
    const { reads } = await adminDataReads();
    const pages = (await sourceFiles(APP, TS_AND_TSX)).filter((file) => ADMIN_PAGE.test(file.name));

    expect(pages.length).toBeGreaterThanOrEqual(17);

    const unchecked = pages
      .filter((page) => {
        const imported = (ADMIN_DATA_IMPORT.exec(page.code)?.[1] ?? '')
          .split(',')
          .map((name) => name.trim().split(/\s+as\s+/)[0] ?? '');
        // Imported is not called: a read behind an early return leaves a branch unchecked.
        const called = imported.some(
          (name) => reads.has(name) && new RegExp(`\\b${name}\\(`).test(page.code),
        );

        return !ADMIN_ROLE_CHECK.test(page.code) && !called;
      })
      .map((page) => page.name);

    expect(unchecked).toEqual([]);
  });
});
