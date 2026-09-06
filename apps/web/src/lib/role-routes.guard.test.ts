import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { UserRole } from '@vendor-marketplace/shared';
import { ROLE_ROUTE_RULES, roleCanReach } from '@/lib/role-routes';
import { sourceFiles, TS_AND_TSX, WEB_SOURCE } from '@/testing/source-scan';

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

/**
 * A stand-in for a dynamic segment. Any concrete value does: the rules match
 * segment shapes, never slugs, and a value that changed the answer would be a
 * rule reading an id.
 */
const SAMPLE_SEGMENT = 'sample';

/**
 * The URL a file under `app/` gates — its directory path, with the App Router's
 * own notation resolved: route groups `(hub)` are organisational and contribute
 * no segment, and `[slug]`, `[requestId]` and `[[...sign-in]]` each stand for
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
  /** The URL that file gates. */
  readonly route: string;
  /** The role the gate admits, or `null` for `/`'s vendor bounce. */
  readonly admits: UserRole | null;
  /** The role the gate turns away, when it names one rather than admitting one. */
  readonly denies: UserRole | null;
}

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
    const route = routeOf(file.name);
    const found: Gate[] = [...file.code.matchAll(REQUIRE_ROLE)].map((match) => ({
      file: file.name,
      route,
      admits: match[1] as UserRole,
      denies: null,
    }));

    if (VENDOR_BOUNCE.test(file.code)) {
      found.push({ file: file.name, route, admits: null, denies: 'vendor' });
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
    expect(gates.filter((gate) => gate.denies === 'vendor').length).toBe(1);
  });

  /*
   * Forward: every gate is represented. This is the direction that reproduces
   * #410 when it fails — a gate the table has never heard of.
   */
  it('agrees with every gate about who renders that route', () => {
    const disagreements = gates.flatMap((gate) =>
      ROLES.filter((role) => {
        const expected = gate.admits !== null ? role === gate.admits : role !== gate.denies;

        return roleCanReach(role, gate.route) !== expected;
      }).map(
        (role) =>
          `${gate.file} gates ${gate.route} to ${gate.admits ?? `everyone but ${gate.denies}`}, ` +
          `but roleCanReach('${role}', '${gate.route}') is ${roleCanReach(role, gate.route)}`,
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
      (rule) => !gates.some((gate) => rule.pattern.test(gate.route)),
    ).map((rule) => String(rule.pattern));

    expect(unbacked).toEqual([]);
  });
});
