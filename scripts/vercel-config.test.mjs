/**
 * VEN-494. Vercel builds only the `staging` and `production` branches: every
 * other branch's deployment is skipped, so pull-request and lane previews stop
 * spending the Hobby daily deployment allowance and stop failing on the web
 * variables they lack. `ignoreCommand` exits 0 to skip a build and 1 to run it;
 * the command is executed here under `sh`, exactly as Vercel runs it. Runs under
 * plain `node` via `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const { ignoreCommand } = JSON.parse(read('vercel.json'));

const exitCodeFor = (branch) =>
  spawnSync('sh', ['-c', ignoreCommand], {
    env: { PATH: process.env.PATH, VERCEL_GIT_COMMIT_REF: branch },
  }).status;

test('the branches that ship are built (exit 1)', () => {
  assert.equal(exitCodeFor('staging'), 1);
  assert.equal(exitCodeFor('production'), 1);
});

test('every other branch is skipped (exit 0)', () => {
  for (const branch of [
    'main',
    'worktree-ven-494',
    'dependabot/npm/x',
    'staging-2',
    'production/x',
    '',
  ]) {
    assert.equal(exitCodeFor(branch), 0, `"${branch}" must be skipped`);
  }
});

test('the web app root carries the same file, since Vercel reads the project root directory', () => {
  assert.equal(read('apps/web/vercel.json'), read('vercel.json'));
});
