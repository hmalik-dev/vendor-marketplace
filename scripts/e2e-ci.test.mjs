/**
 * VEN-411. The CI `e2e` job's two decisions: whether the suite may run without
 * its secrets, and whether a retried pass is reported. Runs under plain `node`
 * via `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FULL_SUITE,
  REQUIRED_SECRETS,
  renderSelection,
  renderSummary,
  selectSpecs,
  SPEC_SELECTORS,
  secretsVerdict,
  summarizeReport,
} from './e2e-ci.mjs';

const sorted = (list) => [...list].sort();

const ALL_SECRETS = Object.fromEntries(
  REQUIRED_SECRETS.map(([variable]) => [variable, `value-of-${variable}`]),
);

test('every secret present: the suite runs', () => {
  assert.deepEqual(secretsVerdict(ALL_SECRETS), {
    run: true,
    fail: false,
    missing: [],
    message: null,
  });
});

test('a missing secret before the gate is switched on skips with a warning naming it', () => {
  const verdict = secretsVerdict({ ...ALL_SECRETS, STRIPE_SECRET_KEY: '' });
  assert.equal(verdict.run, false);
  assert.equal(verdict.fail, false);
  assert.deepEqual(verdict.missing, ['E2E_STRIPE_SECRET_KEY']);
  assert.match(verdict.message, /NOT run — secrets missing: E2E_STRIPE_SECRET_KEY \(VEN-377\)/);
});

// The first CI run reported `STRIPE_SECRET_KEY`, the job's variable, where the
// operator has to add the secret `E2E_STRIPE_SECRET_KEY`.
test('a missing value is reported under the repository secret someone must add', () => {
  const verdict = secretsVerdict({ ...ALL_SECRETS, STRIPE_SECRET_KEY: '' });
  assert.deepEqual(verdict.missing, ['E2E_STRIPE_SECRET_KEY']);
});

test('a missing secret once E2E_GATE=required fails the job', () => {
  const verdict = secretsVerdict({
    ...ALL_SECRETS,
    E2E_ADMIN_PASSWORD: '  ',
    E2E_GATE: 'required',
  });
  assert.equal(verdict.run, false);
  assert.equal(verdict.fail, true);
  assert.deepEqual(verdict.missing, ['E2E_ADMIN_PASSWORD']);
});

test('the verdict names a missing secret and never carries a present value', () => {
  const verdict = secretsVerdict({ ...ALL_SECRETS, STRIPE_SECRET_KEY: undefined });
  for (const [variable] of REQUIRED_SECRETS.filter(([v]) => v !== 'STRIPE_SECRET_KEY')) {
    assert.ok(!verdict.message.includes(`value-of-${variable}`), `message leaked ${variable}`);
  }
});

// The shape Playwright's JSON reporter writes: nested suites, specs holding one
// test per project, `flaky` for a test that failed once and passed its retry.
const REPORT = {
  stats: { duration: 540_000 },
  suites: [
    {
      file: 'paid-booking.spec.ts',
      specs: [
        {
          file: 'paid-booking.spec.ts',
          title: 'pays with 4242',
          tests: [{ projectName: 'desktop-1440', status: 'flaky' }],
        },
      ],
      suites: [
        {
          file: 'paid-booking.spec.ts',
          specs: [
            {
              file: 'paid-booking.spec.ts',
              title: 'refunds a cancellation',
              tests: [{ projectName: 'desktop-1440', status: 'unexpected' }],
            },
            {
              file: 'paid-booking.spec.ts',
              title: 'declines a card',
              tests: [{ projectName: 'desktop-1440', status: 'expected' }],
            },
          ],
        },
      ],
    },
    {
      file: 'auth.spec.ts',
      specs: [
        {
          file: 'auth.spec.ts',
          title: 'signs in',
          tests: [
            { projectName: 'desktop-1440', status: 'expected' },
            { projectName: 'responsive-390', status: 'skipped' },
          ],
        },
      ],
    },
  ],
};

test('a retried pass is counted and named, not folded into the passes', () => {
  assert.deepEqual(summarizeReport(REPORT), {
    passed: 2,
    failed: ['[desktop-1440] paid-booking.spec.ts › refunds a cancellation'],
    retried: ['[desktop-1440] paid-booking.spec.ts › pays with 4242'],
    skipped: 1,
    durationMs: 540_000,
  });
});

test('the step summary states retries and duration', () => {
  const text = renderSummary(summarizeReport(REPORT));
  assert.match(text, /2 passed · 1 failed · 1 passed only on retry · 1 skipped · 9\.0 min/);
  assert.match(text, /- \[desktop-1440\] paid-booking\.spec\.ts › pays with 4242/);
});

test('a clean run reports zero retries and no retry section', () => {
  const text = renderSummary({
    passed: 3,
    failed: [],
    retried: [],
    skipped: 0,
    durationMs: 60_000,
  });
  assert.match(text, /0 passed only on retry/);
  assert.doesNotMatch(text, /Passed only on retry\*\*/);
});

// VEN-411 AC6-9: which specs a diff and trigger need.

test('a diff touching only admin routes selects the admin specs, not customer or vendor ones', () => {
  const selection = selectSpecs({
    ref: 'refs/pull/42/merge',
    changedPaths: ['apps/web/src/app/admin/customers/[userId]/page.tsx'],
  });
  assert.deepEqual(
    sorted(selection.suite),
    sorted([
      'admin-closed-customers.spec.ts',
      'admin-detail-patterns.spec.ts',
      'admin-filters.spec.ts',
      'admin-lists.spec.ts',
      'admin-operator-closure.spec.ts',
      // /admin/settings toggles both switches below, so an admin change pulls
      // them in too — that is still "the admin specs", not the customer or
      // vendor journeys.
      'launch-switches.spec.ts',
      'vendor-refusal-routing.spec.ts',
      // route-landing.spec.ts sweeps every route at run time, admin's included.
      'route-landing.spec.ts',
    ]),
  );
  for (const excluded of ['messaging.spec.ts', 'booking-request.spec.ts', 'paid-booking.spec.ts']) {
    assert.ok(!selection.suite.includes(excluded), `admin diff should not select ${excluded}`);
  }
});

test('a diff touching only a customer route selects the customer specs, not admin-*', () => {
  const selection = selectSpecs({
    ref: 'refs/pull/42/merge',
    changedPaths: ['apps/web/src/app/messages/page.tsx'],
  });
  assert.deepEqual(
    sorted(selection.suite),
    sorted(['messaging.spec.ts', 'focus-indicator.spec.ts', 'route-landing.spec.ts']),
  );
  assert.ok(!selection.suite.some((spec) => spec.startsWith('admin-')));
});

test('a diff touching a vendor route selects the vendor specs', () => {
  const selection = selectSpecs({
    ref: 'refs/heads/main',
    changedPaths: ['apps/web/src/app/vendor/dashboard/page.tsx'],
  });
  assert.deepEqual(
    sorted(selection.suite),
    sorted([
      'vendor-refusal-routing.spec.ts',
      'focus-indicator.spec.ts',
      'paid-booking.spec.ts',
      'booking-request.spec.ts',
      'image-fallback.spec.ts',
      'route-landing.spec.ts',
    ]),
  );
  assert.ok(!selection.suite.some((spec) => spec.startsWith('admin-')));
});

test('a changed spec file always selects itself', () => {
  const selection = selectSpecs({
    ref: 'refs/pull/42/merge',
    changedPaths: ['apps/web/e2e/focus-indicator.spec.ts'],
  });
  assert.deepEqual(selection.suite, ['focus-indicator.spec.ts']);
});

test('two diffs union their specs, deduplicated', () => {
  const selection = selectSpecs({
    ref: 'refs/pull/42/merge',
    changedPaths: [
      'apps/web/src/app/messages/page.tsx',
      'apps/web/src/app/messages/[threadId]/page.tsx',
      'apps/web/src/app/vendor/dashboard/page.tsx',
    ],
  });
  assert.deepEqual(
    sorted(selection.suite),
    sorted([
      'messaging.spec.ts',
      'focus-indicator.spec.ts',
      'vendor-refusal-routing.spec.ts',
      'paid-booking.spec.ts',
      'booking-request.spec.ts',
      'image-fallback.spec.ts',
      'route-landing.spec.ts',
    ]),
  );
  // focus-indicator.spec.ts is named by both the messaging and vendor
  // entries: deduplicated, so it appears once, not twice.
  assert.equal(selection.suite.filter((spec) => spec === 'focus-indicator.spec.ts').length, 1);
});

test('a path under bookings/[requestId] unions the hub specs and the payments specs', () => {
  const selection = selectSpecs({
    ref: 'refs/pull/42/merge',
    changedPaths: ['apps/web/src/app/bookings/[requestId]/checkout/page.tsx'],
  });
  assert.ok(selection.suite.includes('paid-booking.spec.ts'));
  assert.ok(selection.suite.includes('launch-switches.spec.ts'));
});

test('a diff touching packages/shared selects the full suite', () => {
  const selection = selectSpecs({
    ref: 'refs/pull/42/merge',
    changedPaths: ['packages/shared/src/schemas/booking.ts'],
  });
  assert.deepEqual(selection, {
    suite: FULL_SUITE,
    reason: 'packages/shared/src/schemas/booking.ts is a shared path',
  });
});

test('a diff touching packages/db selects the full suite', () => {
  const selection = selectSpecs({
    ref: 'refs/pull/42/merge',
    changedPaths: ['packages/db/src/schema/booking.ts'],
  });
  assert.equal(selection.suite, FULL_SUITE);
});

test('a path the table does not map selects the full suite, fail-safe', () => {
  const selection = selectSpecs({
    ref: 'refs/pull/42/merge',
    changedPaths: ['apps/web/src/app/support/page.tsx'],
  });
  assert.deepEqual(selection, {
    suite: FULL_SUITE,
    reason: 'apps/web/src/app/support/page.tsx matches no entry in the changed-path table',
  });
});

test('one unmapped path in an otherwise-mapped diff still selects the full suite', () => {
  const selection = selectSpecs({
    ref: 'refs/pull/42/merge',
    changedPaths: ['apps/web/src/app/messages/page.tsx', 'apps/web/src/app/support/page.tsx'],
  });
  assert.equal(selection.suite, FULL_SUITE);
});

test('an empty diff selects nothing', () => {
  const selection = selectSpecs({ ref: 'refs/pull/42/merge', changedPaths: [] });
  assert.deepEqual(selection, { suite: [], reason: 'no changed paths' });
});

test('a push to staging selects the full suite for any diff, including docs-only', () => {
  const selection = selectSpecs({
    ref: 'refs/heads/staging',
    changedPaths: ['README.md'],
  });
  assert.equal(selection.suite, FULL_SUITE);
});

test('a push to production selects the full suite for any diff', () => {
  const selection = selectSpecs({
    ref: 'refs/heads/production',
    changedPaths: [],
  });
  assert.equal(selection.suite, FULL_SUITE);
});

test('a push to main scopes by diff like a pull request', () => {
  const selection = selectSpecs({
    ref: 'refs/heads/main',
    changedPaths: ['apps/web/src/app/messages/page.tsx'],
  });
  assert.deepEqual(
    sorted(selection.suite),
    sorted(['messaging.spec.ts', 'focus-indicator.spec.ts', 'route-landing.spec.ts']),
  );
});

test('every committed spec is reachable from the table or the route sweep', () => {
  const e2eDir = join(dirname(fileURLToPath(import.meta.url)), '../apps/web/e2e');
  // `.staging.spec.ts` files never run under this config — `playwright.config.ts`
  // ignores them and they have their own entry point (VEN-562) — so they are
  // deliberately unreachable from the diff-selection table.
  const committedSpecs = readdirSync(e2eDir).filter(
    (name) => name.endsWith('.spec.ts') && !name.endsWith('.staging.spec.ts'),
  );
  const reachable = new Set([
    'route-landing.spec.ts', // added by the route sweep, not listed in any entry's `specs`
    ...SPEC_SELECTORS.flatMap((selector) => selector.specs),
  ]);

  const orphaned = committedSpecs.filter((spec) => !reachable.has(spec));
  assert.deepEqual(orphaned, [], 'a spec file changed selects itself, but nothing else selects it');
});

test('renderSelection names an empty selection as green with the summary line', () => {
  const text = renderSelection({ suite: [], reason: 'no changed paths' });
  assert.match(text, /no journeys affected by this diff/);
});

test('renderSelection names the full suite and why', () => {
  const text = renderSelection({
    suite: FULL_SUITE,
    reason: 'push to refs/heads/staging: the full suite is the release gate',
  });
  assert.match(text, /Full suite — push to refs\/heads\/staging/);
});

test('renderSelection lists a scoped selection by spec name', () => {
  const text = renderSelection({ suite: ['messaging.spec.ts'], reason: null });
  assert.match(text, /Scoped to: messaging\.spec\.ts/);
});
