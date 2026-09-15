/**
 * VEN-411. The CI `e2e` job's two decisions: whether the suite may run without
 * its secrets, and whether a retried pass is reported. Runs under plain `node`
 * via `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REQUIRED_SECRETS, renderSummary, secretsVerdict, summarizeReport } from './e2e-ci.mjs';

const ALL_SECRETS = Object.fromEntries(REQUIRED_SECRETS.map((name) => [name, `value-of-${name}`]));

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
  assert.deepEqual(verdict.missing, ['STRIPE_SECRET_KEY']);
  assert.match(verdict.message, /NOT run — secrets missing: STRIPE_SECRET_KEY \(VEN-377\)/);
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
  const verdict = secretsVerdict({ ...ALL_SECRETS, CLERK_SECRET_KEY: undefined });
  for (const name of REQUIRED_SECRETS.filter((n) => n !== 'CLERK_SECRET_KEY')) {
    assert.ok(!verdict.message.includes(`value-of-${name}`), `message leaked ${name}`);
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
