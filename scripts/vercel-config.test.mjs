/**
 * VEN-494, VEN-535. Vercel's own Git integration builds nothing: every branch,
 * `staging` and `production` included, is skipped, and Git deployments are
 * switched off outright. The web ships only through the release workflow's
 * prebuilt deploy, which runs after the migration and the API, so it can never
 * be live ahead of the response contract it parses. `ignoreCommand` exits 0 to
 * skip a build and 1 to run it; the command is executed here under `sh`,
 * exactly as Vercel runs it. Runs under plain `node` via `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const config = JSON.parse(read('vercel.json'));
const { ignoreCommand } = config;

const exitCodeFor = (branch) =>
  spawnSync('sh', ['-c', ignoreCommand], {
    env: { PATH: process.env.PATH, VERCEL_GIT_COMMIT_REF: branch },
  }).status;

test('every branch is skipped by the Git integration (exit 0), the release branches included', () => {
  for (const branch of [
    'staging',
    'production',
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

test('an unset branch is skipped too', () => {
  const { status } = spawnSync('sh', ['-c', ignoreCommand], { env: { PATH: process.env.PATH } });
  assert.equal(status, 0);
});

test('Git deployments are disabled for every branch', () => {
  assert.equal(config.git?.deploymentEnabled, false);
});

test('the web app root carries the same file, since Vercel reads the project root directory', () => {
  assert.equal(read('apps/web/vercel.json'), read('vercel.json'));
});
