/**
 * VEN-457. The storage decisions CI and the preview-branch workflow make in
 * code: which values reach a job, and the assertion that none is production's.
 * Runs under plain `node` via `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PRODUCTION_BRANCH_ID,
  parsePulled,
  productionStorageFindings,
  storageRows,
} from './ci-storage.mjs';

const SCRIPT = fileURLToPath(new URL('./ci-storage.mjs', import.meta.url));
const BRANCH_ENDPOINT = 'https://br-ci-run.storage.c-4.us-east-2.aws.neon.tech';
const PRODUCTION_ENDPOINT = `https://${PRODUCTION_BRANCH_ID}.storage.c-4.us-east-2.aws.neon.tech`;

const FIXTURE_ID = 'ci-fixture-id';
const FIXTURE_VALUE = 'ci-fixture-value';

// Fixture values only: what the fake `neon env pull` would have written.
const pulled = (endpoint) => [
  ['AWS_ENDPOINT_URL_S3', endpoint],
  ['AWS_ACCESS_KEY_ID', FIXTURE_ID],
  ['AWS_SECRET_ACCESS_KEY', FIXTURE_VALUE],
  ['AWS_REGION', 'us-east-2'],
];

const asFile = (rows) => rows.map(([name, value]) => `${name}=${value}`).join('\n');

function run(args, env) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });
}

function scratch() {
  return mkdtempSync(path.join(tmpdir(), 'ci-storage-'));
}

test('the branch credential maps onto the STORAGE_* rows the API reads', () => {
  const rows = Object.fromEntries(storageRows(Object.fromEntries(pulled(BRANCH_ENDPOINT))));

  assert.deepEqual(Object.keys(rows), [
    'STORAGE_ENDPOINT',
    'STORAGE_ACCESS_KEY_ID',
    'STORAGE_SECRET_ACCESS_KEY',
    'STORAGE_BUCKET',
    'STORAGE_PUBLIC_URL',
    'NEXT_PUBLIC_STORAGE_PUBLIC_URL',
    'STORAGE_REGION',
  ]);
  assert.equal(rows.STORAGE_ENDPOINT, BRANCH_ENDPOINT);
  assert.equal(rows.STORAGE_ACCESS_KEY_ID, FIXTURE_ID);
  assert.equal(rows.STORAGE_BUCKET, 'uploads');
  assert.equal(rows.STORAGE_PUBLIC_URL, `${BRANCH_ENDPOINT}/uploads`);
  assert.equal(rows.NEXT_PUBLIC_STORAGE_PUBLIC_URL, rows.STORAGE_PUBLIC_URL);
  assert.equal(rows.STORAGE_REGION, 'us-east-2');
});

test('the pulled file parses with or without quotes and ignores other lines', () => {
  assert.deepEqual(parsePulled('# note\nA=1\nB="two words"\nC=\'x\'\n\nnot a row\n'), {
    A: '1',
    B: 'two words',
    C: 'x',
  });
});

test('an incomplete credential is refused rather than half-mapped', () => {
  assert.throws(() => storageRows({ AWS_REGION: 'us-east-2' }), /incomplete/);
});

test('assert passes on a job that holds only its own branch', () => {
  const env = Object.fromEntries(storageRows(Object.fromEntries(pulled(BRANCH_ENDPOINT))));

  assert.deepEqual(productionStorageFindings(env), []);
  assert.equal(run(['assert'], env).status, 0);
});

test('assert fails on a STORAGE_ value that matches the production endpoint, naming only the variable', () => {
  const env = Object.fromEntries(storageRows(Object.fromEntries(pulled(PRODUCTION_ENDPOINT))));
  const result = run(['assert'], env);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /STORAGE_ENDPOINT/);
  assert.match(result.stdout, /STORAGE_PUBLIC_URL/);
  assert.doesNotMatch(result.stdout, /ci-fixture/);
});

test('assert fails when only the AWS_* names carry the production endpoint', () => {
  assert.deepEqual(productionStorageFindings({ AWS_ENDPOINT_URL_S3: PRODUCTION_ENDPOINT }), [
    'AWS_ENDPOINT_URL_S3',
  ]);
});

test('assert fails on a NEON_BRANCH of production', () => {
  assert.deepEqual(productionStorageFindings({ NEON_BRANCH: 'production' }), ['NEON_BRANCH']);
  assert.deepEqual(productionStorageFindings({ NEON_BRANCH: 'preview/pr-4' }), []);
});

test('assert ignores a variable that is not about storage', () => {
  assert.deepEqual(productionStorageFindings({ NOTE: PRODUCTION_BRANCH_ID }), []);
});

test('map masks every value, writes them to GITHUB_ENV and prints no name', () => {
  const dir = scratch();
  const pullFile = path.join(dir, 'pulled.env');
  const githubEnv = path.join(dir, 'github-env');
  writeFileSync(pullFile, asFile(pulled(BRANCH_ENDPOINT)));
  writeFileSync(githubEnv, '');

  const result = run(['map', pullFile], { GITHUB_ENV: githubEnv });

  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(`::add-mask::${FIXTURE_VALUE}`));
  assert.doesNotMatch(result.stdout, /STORAGE_/);

  const written = readFileSync(githubEnv, 'utf8');
  assert.match(written, new RegExp(`^STORAGE_ENDPOINT=${BRANCH_ENDPOINT}$`, 'm'));
  assert.match(written, /^STORAGE_BUCKET=uploads$/m);
});

test('map refuses a credential that belongs to production and writes nothing', () => {
  const dir = scratch();
  const pullFile = path.join(dir, 'pulled.env');
  const githubEnv = path.join(dir, 'github-env');
  writeFileSync(pullFile, asFile(pulled(PRODUCTION_ENDPOINT)));
  writeFileSync(githubEnv, '');

  const result = run(['map', pullFile], { GITHUB_ENV: githubEnv });

  assert.equal(result.status, 1);
  assert.equal(readFileSync(githubEnv, 'utf8'), '');
});
