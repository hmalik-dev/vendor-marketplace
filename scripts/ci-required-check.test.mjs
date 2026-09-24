/**
 * VEN-716. The required check is named in branch protection, which a person owns,
 * so the job that carries the name must survive the suites being sharded across
 * other jobs — and must fail when any of them does. Runs under plain `node` via
 * `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('every test package is covered by a shard, and each shard set is complete', () => {
  const sets = new Map();
  for (const { pkg, shard } of CI.jobs.test.strategy.matrix.include) {
    const [i, n] = shard.split('/').map(Number);
    sets.set(pkg, [...(sets.get(pkg) ?? []), { i, n }]);
  }
  assert.deepEqual([...sets.keys()].sort(), [
    '@vendor-marketplace/api',
    '@vendor-marketplace/db',
    '@vendor-marketplace/preflight',
    '@vendor-marketplace/shared',
    '@vendor-marketplace/web',
  ]);
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
