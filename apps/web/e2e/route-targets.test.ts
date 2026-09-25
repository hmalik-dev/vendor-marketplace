import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { E2E_VENDOR_SLUG } from './fixtures-data.js';
import {
  enumerateRouteTargets,
  refusesWithoutSession,
  SAMPLE_ID,
  type RouteTargetRoots,
} from './route-targets.js';

/** Vitest runs with `apps/web` as cwd. */
const REPO_ROOT = resolve(process.cwd(), '../..');

const REAL_ROOTS: RouteTargetRoots = {
  appDir: join(REPO_ROOT, 'apps/web/src/app'),
  webSourceDir: join(REPO_ROOT, 'apps/web/src'),
  sharedConstantsDir: join(REPO_ROOT, 'packages/shared/src/constants'),
  repoRoot: REPO_ROOT,
};

const scratch = mkdtempSync(join(tmpdir(), 'route-targets-'));

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function tree(files: Record<string, string>): RouteTargetRoots {
  const root = mkdtempSync(join(scratch, 'tree-'));

  for (const [path, code] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, code);
  }

  return {
    appDir: join(root, 'web/src/app'),
    webSourceDir: join(root, 'web/src'),
    sharedConstantsDir: join(root, 'shared/constants'),
    repoRoot: root,
  };
}

const paths = (roots: RouteTargetRoots): string[] =>
  enumerateRouteTargets(roots).map((target) => target.path);

describe('enumerateRouteTargets over a fixture tree', () => {
  const PAGE = 'export default function Page() { return null; }';

  it('collapses groups, private folders and optional catch-alls the way Next routes them', () => {
    const roots = tree({
      'web/src/app/page.tsx': PAGE,
      'web/src/app/bookings/(hub)/page.tsx': PAGE,
      'web/src/app/sign-in/[[...sign-in]]/page.tsx': PAGE,
      'web/src/app/_fonts/page.tsx': PAGE,
      'web/src/app/after-sign-in/route.ts': 'export function GET() {}',
      'web/src/app/bookings/(hub)/loading.tsx': PAGE,
      'shared/constants/index.ts': '',
    });

    expect(paths(roots)).toEqual(['/', '/after-sign-in', '/bookings', '/sign-in']);
  });

  it('fills the storefront slug from the seed and marks every other sample as sampled', () => {
    const roots = tree({
      'web/src/app/vendors/[slug]/request/page.tsx': PAGE,
      'web/src/app/bookings/[requestId]/page.tsx': PAGE,
      'shared/constants/index.ts': '',
    });

    expect(enumerateRouteTargets(roots).map(({ path, sampled }) => ({ path, sampled }))).toEqual([
      { path: `/bookings/${SAMPLE_ID}`, sampled: true },
      { path: `/vendors/${E2E_VENDOR_SLUG}/request`, sampled: false },
    ]);
  });

  /*
   * AC4's reach, in miniature: a destination nobody built becomes a target of
   * its own, so the sweep visits it and meets the 404. The live half of the
   * proof is the spec failing on a planted redirect, recorded in the PR.
   */
  it('turns a literal redirect to a route that does not exist into a target', () => {
    const roots = tree({
      'web/src/app/page.tsx': PAGE,
      'web/src/lib/gate.ts':
        "redirect('/nowhere?x=1');\nNextResponse.redirect(new URL('/also-nowhere', url));",
      'web/src/lib/tables.ts':
        "export const T = {\n  customer: '/bookings',\n  vendor: 'Dashboard',\n};",
      'web/src/lib/terms.ts': "pathReturningTo('/accept-terms', x); redirect(`/vendors/${slug}`);",
      'shared/constants/legal.ts': "export const TERMS_ACCEPTANCE_PATH = '/accept-terms';",
      'shared/constants/index.ts': 'export const SUB_PATH = `${BASE}/return`;',
    });

    const targets = enumerateRouteTargets(roots);

    expect(targets.map((target) => target.path)).toEqual([
      '/',
      '/accept-terms',
      '/also-nowhere',
      '/bookings',
      '/nowhere',
    ]);
    expect(targets.find((target) => target.path === '/nowhere')).toEqual({
      path: '/nowhere',
      sources: ['web/src/lib/gate.ts'],
      kinds: ['redirect'],
      sampled: false,
    });
  });

  it('ignores destinations quoted in comments and in test files', () => {
    const roots = tree({
      'web/src/lib/history.ts':
        "/* it used to redirect('/customer/dashboard') */\n// redirect('/old')\n",
      'web/src/lib/gate.test.ts': "redirect('/from-a-test');",
      'shared/constants/index.ts': '',
      'web/src/app/page.tsx': PAGE,
    });

    expect(paths(roots)).toEqual(['/']);
  });
});

describe('enumerateRouteTargets over this repository', () => {
  const targets = enumerateRouteTargets(REAL_ROOTS);
  const byPath = new Map(targets.map((target) => [target.path, target]));

  it.each([
    ['/after-sign-in', 'segment'],
    ['/dashboard', 'segment'],
    ['/bookings', 'segment'],
    ['/messages', 'segment'],
    ['/sign-in', 'redirect'],
    ['/accept-terms', 'redirect'],
    ['/suspended', 'redirect'],
    ['/vendor/dashboard', 'redirect'],
    ['/admin', 'redirect'],
  ] as const)('reaches %s as a %s target', (path, kind) => {
    expect(byPath.get(path)?.kinds).toContain(kind);
  });

  it('names the role table as a source of the dashboard destinations', () => {
    expect(byPath.get('/vendor/dashboard')?.sources).toContain('apps/web/src/lib/role-routes.ts');
  });

  /*
   * VEN-590: the three VEN-512 screens gate with `getServerSession()` and an
   * `if (!session) redirect(…)`, not a helper. The root layout, `/` and
   * `/account/settings/close` read the session without refusing on it, and
   * `/support` reads the identity without refusing, so these three
   * segment files match — a detector keyed on the call alone would flag them all.
   */
  it('reads the hand-rolled session gate out of the pages that refuse on it, not the ones that only read it', () => {
    const matching = targets
      .filter((target) => target.kinds.includes('segment'))
      .filter((target) =>
        refusesWithoutSession(readFileSync(join(REPO_ROOT, target.sources[0] ?? ''), 'utf8')),
      )
      .map((target) => target.path);

    expect(matching).toEqual(
      expect.arrayContaining(['/waitlist', '/vendors/apply', '/sign-up/vendor-details']),
    );
    expect(matching).not.toContain('/');
    expect(matching).not.toContain('/support');
    expect(matching).not.toContain('/account/settings/close');
  });
});

describe('refusesWithoutSession', () => {
  it.each([
    ['requireRole', "await requireRole('vendor');"],
    ['requireCurrentUser', 'const user = await requireCurrentUser();'],
    [
      'a bound session refused with a block',
      'const session = await getServerSession();\n\n  if (!session) {\n    redirect(VENDOR_SIGN_UP_PATH);\n  }',
    ],
    [
      'a bound session refused on one line',
      "const s = await getServerSession();\nif (!s) redirect('/sign-in');",
    ],
    [
      'a bound session compared to null and returned',
      "let current = await getServerSession();\nif (current === null) return redirect('/sign-in');",
    ],
    ['an inline read', "if (!(await getServerSession())) redirect('/sign-in');"],
    ['a braced inline read', "if (!(await getServerSession())) {\n  redirect('/sign-in');\n}"],
  ])('matches %s', (_, code) => {
    expect(refusesWithoutSession(code)).toBe(true);
  });

  it.each([
    [
      'a session read for the header',
      'const session = await getServerSession();\nreturn <Header session={session} />;',
    ],
    ['a token read', 'const token = (await getServerSession())?.token ?? null;'],
    ['a signed-out flag', 'const signedOut = (await getServerSession()) === null;'],
    [
      'a refusal on a different binding',
      "const session = await getServerSession();\nif (!account) redirect('/sign-in');",
    ],
    [
      'a gate quoted in a comment',
      "// const session = await getServerSession(); if (!session) redirect('/x');\n/* requireRole('admin') */",
    ],
  ])('ignores %s', (_, code) => {
    expect(refusesWithoutSession(code)).toBe(false);
  });
});
