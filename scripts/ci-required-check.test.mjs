/**
 * VEN-716. The required check is named in branch protection, which a person owns,
 * so the job that carries the name must survive the suites being sharded across
 * other jobs — and must fail when any of them does. Runs under plain `node` via
 * `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI = parse(readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8'));
const REQUIRED = 'Typecheck, lint, build, test';

test('exactly one job carries the required check name, and it is `verify`', () => {
  const named = Object.entries(CI.jobs).filter(([, job]) => job.name === REQUIRED);
  assert.deepEqual(
    named.map(([id]) => id),
    ['verify'],
  );
});

test('the required check waits for every job that runs a check, and runs even when one fails', () => {
  const { verify } = CI.jobs;
  const gated = Object.entries(CI.jobs)
    .filter(([id]) => !['verify', 'secrets', 'e2e'].includes(id))
    .map(([id]) => id)
    .sort();
  assert.deepEqual([...verify.needs].sort(), gated);
  // Without `always()` a failed shard skips this job, and a skipped required check reads as passing.
  assert.equal(verify.if, 'always()');
  assert.equal(CI.jobs.e2e.needs, 'verify');
});

// VEN-593. The scoping lives in the job's steps, so each mutation below is a
// step a refactor could quietly drop: none of them turns the suite red on its own.
test('the e2e job keeps its check name and scopes the run without skipping the job', () => {
  const { e2e } = CI.jobs;
  assert.equal(e2e.name, 'End-to-end journeys');
  assert.equal(e2e.if, undefined, 'a job-level condition would skip a required check');
  const [checkout, select, secrets] = e2e.steps;
  // The pull request diff is the merge commit against its first parent.
  assert.equal(checkout.with['fetch-depth'], 2);
  assert.equal(select.id, 'select');
  assert.match(select.run, /HEAD\^1 HEAD/);
  assert.match(select.run, /node scripts\/e2e-ci\.mjs select /);
  // A diff that cannot be read, and a release, must reach the full suite.
  assert.match(select.run, /<diff unavailable>/);
  assert.match(select.run, /BASE_REF" = production/);
  assert.equal(e2e.permissions.actions, 'read');
  // `none` ends the job green: every later step reads this step's output.
  assert.equal(secrets.id, 'secrets');
  assert.equal(secrets.if, "steps.select.outputs.suite != 'none'");
});

test('the journeys step runs the scoped list only for an explicit `scoped`, else the full suite', () => {
  const run = CI.jobs.e2e.steps.find((step) => step.name === 'Run the journeys');
  assert.equal(run.env.SUITE, '${{ steps.select.outputs.suite }}');
  assert.equal(run.env.SPECS, '${{ steps.select.outputs.specs }}');
  assert.match(run.run, /\[ "\$SUITE" = scoped \] && \[ -n "\$SPECS" \]/);
  assert.match(run.run, /playwright test --pass-with-no-tests "\$\{files\[@\]\}"/);
  assert.match(run.run, /else\n\s+pnpm --filter @vendor-marketplace\/web test:e2e\n/);
});

test('every step of the e2e job that uses an action pins it to a commit', () => {
  for (const { uses } of CI.jobs.e2e.steps.filter((step) => step.uses)) {
    assert.match(uses, /@[0-9a-f]{40}$/);
  }
});

test('every test package is covered by a shard, and each shard set is complete', () => {
  const sets = new Map();
  for (const { pkg, shard } of CI.jobs.test.strategy.matrix.include) {
    const [i, n] = shard.split('/').map(Number);
    sets.set(pkg, [...(sets.get(pkg) ?? []), { i, n }]);
  }
  // What `turbo run test` used to find by itself: every workspace package with a
  // `test` script. The shards call vitest directly, so that script must be
  // exactly that, or whatever else it did would silently stop running in CI.
  const testPackages = ['apps', 'packages'].flatMap((dir) =>
    readdirSync(path.join(ROOT, dir))
      .map((name) => path.join(ROOT, dir, name, 'package.json'))
      .filter((file) => existsSync(file))
      .map((file) => JSON.parse(readFileSync(file, 'utf8')))
      .filter((manifest) => manifest.scripts?.test !== undefined),
  );
  assert.ok(testPackages.length >= 5, 'expected the workspace packages to be found');
  for (const { name, scripts } of testPackages) {
    assert.equal(scripts.test, 'vitest run', `${name}: the shards run vitest, not this script`);
  }
  assert.deepEqual([...sets.keys()].sort(), testPackages.map((manifest) => manifest.name).sort());
  for (const [pkg, shards] of sets) {
    const total = shards[0].n;
    assert.ok(
      shards.every(({ n }) => n === total),
      `${pkg}: shards disagree on the total`,
    );
    assert.deepEqual(
      shards.map(({ i }) => i).sort(),
      Array.from({ length: total }, (_, k) => k + 1),
      `${pkg}: a shard is missing or repeated`,
    );
  }
  assert.equal(CI.jobs.test.strategy['fail-fast'], false);
});
