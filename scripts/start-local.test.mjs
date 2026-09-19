/**
 * VEN-410. `pnpm start` is the one command a non-technical teammate runs, so
 * its preconditions are checked here in plain `node` via `pnpm test:agents`.
 * Every case runs against a temp copy of the real `package.json`,
 * `.env.example` and `docker-compose.yml`, so a change to any of them is
 * exercised rather than a fixture that drifted from them.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  OPTIONAL_KEYS,
  OPTIONAL_PLACEHOLDER_KEYS,
  REQUIRED_KEYS,
  localDatabaseUrl,
  startLocal,
} from './start-local.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REQUIRED_NODE = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).engines
  .node;
const COMPOSE = readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
/* A shape-valid stand-in, assembled so no credential-shaped literal sits in the file. */
const FILLER = 'x'.repeat(24);

const clones = [];

after(() => {
  for (const dir of clones) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function cloneRoot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'start-local-'));
  clones.push(dir);

  for (const file of ['package.json', '.env.example', 'docker-compose.yml']) {
    copyFileSync(path.join(ROOT, file), path.join(dir, file));
  }

  return dir;
}

function run(dir, overrides = {}) {
  let output = '';
  const code = startLocal({
    root: dir,
    nodeVersion: '22.22.2',
    dockerInfo: () => {},
    write: (text) => {
      output += text;
    },
    ...overrides,
  });

  return { code, output };
}

function envText(pairs) {
  return `${pairs.map(([key, value]) => [key, value].join('=')).join('\n')}\n`;
}

function envValue(text, key) {
  const line = text.split('\n').find((candidate) => candidate.startsWith(`${key}=`));

  return line?.slice(key.length + 1);
}

function composeValue(name) {
  return COMPOSE.match(new RegExp(`${name}: (\\S+)`))?.[1];
}

test('the compose Postgres service yields a complete local DATABASE_URL', () => {
  const url = new URL(localDatabaseUrl(COMPOSE));

  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.port, '5432');
  assert.equal(url.username, composeValue('POSTGRES_USER'));
  assert.equal(url.password, composeValue('POSTGRES_PASSWORD'));
  assert.equal(url.pathname, `/${composeValue('POSTGRES_DB')}`);
});

test('a clone with no .env gets one with the local database and storage filled in', () => {
  const dir = cloneRoot();
  const { code, output } = run(dir);
  const example = readFileSync(path.join(dir, '.env.example'), 'utf8');
  const created = readFileSync(path.join(dir, '.env'), 'utf8');

  assert.equal(code, 1);
  assert.equal(envValue(created, 'DATABASE_URL'), localDatabaseUrl(COMPOSE));
  assert.equal(envValue(created, 'S3_ENDPOINT'), 'http://localhost:9000');
  assert.equal(envValue(created, 'S3_ACCESS_KEY_ID'), composeValue('MINIO_ROOT_USER'));
  assert.equal(envValue(created, 'S3_SECRET_ACCESS_KEY'), composeValue('MINIO_ROOT_PASSWORD'));

  /*
   * Rows that are absent-able locally are emptied, because their placeholders
   * are not absent: `postgresql://...` in DATABASE_URL_UNPOOLED is what the
   * migrator prefers, and `operator@...` fails the API's boot schema.
   */
  for (const key of OPTIONAL_PLACEHOLDER_KEYS) {
    assert.equal(envValue(created, key), '', key);
  }

  const touched = new Set(['DATABASE_URL', ...OPTIONAL_PLACEHOLDER_KEYS]);
  const exampleLines = example.split('\n');
  const createdLines = created.split('\n');

  assert.equal(createdLines.length, exampleLines.length);
  exampleLines.forEach((line, index) => {
    if (!touched.has(line.split('=')[0])) {
      assert.equal(createdLines[index], line);
    }
  });

  assert.match(output, /Created \.env/);
  assert.equal(statSync(path.join(dir, '.env')).mode & 0o777, 0o600);
  for (const key of Object.keys(REQUIRED_KEYS)) {
    assert.match(output, new RegExp(`^  - ${key} `, 'm'));
  }
  assert.match(output, /ask the project owner/i);
  /*
   * Derived from `OPTIONAL_KEYS`, not spelled out. This read `SENTRY_DSN`
   * literally until VEN-397 made the registry mark it absent-able locally,
   * which moved it to `OPTIONAL_PLACEHOLDER_KEYS` — and a hard-coded key is
   * then a test pinning a categorisation the registry no longer makes.
   */
  for (const key of Object.keys(OPTIONAL_KEYS)) {
    assert.match(output, new RegExp(`^  - ${key} `, 'm'));
  }
  assert.equal(/These are optional/.test(output), Object.keys(OPTIONAL_KEYS).length > 0);
  // The point of the placeholder list: absent-able keys are emptied in `.env`
  // and never named among the ones that must be filled before the app starts.
  for (const key of OPTIONAL_PLACEHOLDER_KEYS) {
    assert.doesNotMatch(output, new RegExp(`^  - ${key} `, 'm'), key);
  }
  assert.doesNotMatch(output, /DATABASE_URL|S3_/);
});

test('an existing, complete .env is never modified and lets the start continue', () => {
  const dir = cloneRoot();
  const complete = envText([
    ['DATABASE_URL', localDatabaseUrl(COMPOSE)],
    ['NEON_AUTH_BASE_URL', 'https://ep-x.neonauth.example.invalid/neondb/auth'],
    ['NEON_AUTH_COOKIE_SECRET', `${FILLER}${FILLER}`],
    ['STRIPE_SECRET_KEY', `sk_test_${FILLER}`],
    ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', `pk_test_${FILLER}`],
    ['STRIPE_WEBHOOK_SECRET', `whsec_${FILLER}`],
    ['RESEND_API_KEY', `re_${FILLER}`],
  ]);
  writeFileSync(path.join(dir, '.env'), complete);

  const { code, output } = run(dir);

  assert.equal(code, 0);
  assert.equal(output, '');
  assert.equal(readFileSync(path.join(dir, '.env'), 'utf8'), complete);
});

test('an existing .env with a placeholder or missing key is reported and left byte-identical', () => {
  const dir = cloneRoot();
  const partial = envText([
    ['DATABASE_URL', localDatabaseUrl(COMPOSE)],
    ['STRIPE_SECRET_KEY', 'sk_test_...'],
    ['RESEND_API_KEY', ''],
  ]);
  writeFileSync(path.join(dir, '.env'), partial);

  const { code, output } = run(dir);

  assert.equal(code, 1);
  assert.match(output, /^  - STRIPE_SECRET_KEY /m);
  assert.match(output, /^  - RESEND_API_KEY /m);
  assert.match(output, /^  - STRIPE_WEBHOOK_SECRET /m);
  assert.doesNotMatch(output, /Created \.env/);
  assert.equal(readFileSync(path.join(dir, '.env'), 'utf8'), partial);
});

/* dotenv, which the apps load `.env` with, keeps the last of a repeated key. */
test('a key assigned twice is judged by its last value, as the apps read it', () => {
  const later = cloneRoot();
  writeFileSync(
    path.join(later, '.env'),
    envText([
      ...Object.keys(REQUIRED_KEYS).map((key) => [key, '']),
      ...Object.keys(REQUIRED_KEYS).map((key) => [key, `real_${FILLER}`]),
    ]),
  );
  assert.equal(run(later).code, 0);

  const earlier = cloneRoot();
  writeFileSync(
    path.join(earlier, '.env'),
    envText([
      ...Object.keys(REQUIRED_KEYS).map((key) => [key, `real_${FILLER}`]),
      ['STRIPE_SECRET_KEY', ''],
    ]),
  );
  const { code, output } = run(earlier);
  assert.equal(code, 1);
  assert.match(output, /^  - STRIPE_SECRET_KEY /m);
});

test('Docker not running stops with a plain Docker Desktop message and no stack', () => {
  const dir = cloneRoot();
  const { code, output } = run(dir, {
    dockerInfo: () => {
      throw new Error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock');
    },
  });

  assert.equal(code, 1);
  assert.match(output, /Open Docker Desktop/);
  assert.doesNotMatch(output, /daemon|\n\s+at /);
  assert.equal(existsSync(path.join(dir, '.env')), false);
});

test('Docker not installed says to install Docker Desktop', () => {
  const dir = cloneRoot();
  const { code, output } = run(dir, {
    dockerInfo: () => {
      throw Object.assign(new Error('spawn docker ENOENT'), { code: 'ENOENT' });
    },
  });

  assert.equal(code, 1);
  assert.match(output, /Install Docker Desktop/);
  assert.doesNotMatch(output, /ENOENT/);
});

test('a Node older than engines stops before Docker and names the required version', () => {
  const dir = cloneRoot();
  let dockerChecked = false;
  const { code, output } = run(dir, {
    nodeVersion: 'v20.11.0',
    dockerInfo: () => {
      dockerChecked = true;
    },
  });

  assert.equal(code, 1);
  assert.ok(output.includes(`Node ${REQUIRED_NODE.replace(/^>=/, '')}`), output);
  assert.match(output, /20\.11\.0/);
  assert.equal(dockerChecked, false);
});

test('Node versions compare numerically, not as strings', () => {
  const dir = cloneRoot();

  for (const version of ['22.22.10', 'v23.0.0', '24.1.0']) {
    assert.doesNotMatch(run(dir, { nodeVersion: version }).output, /needs Node/, version);
  }
  for (const version of ['22.22.1', 'v22.3.99', '22.9.0']) {
    assert.match(run(dir, { nodeVersion: version }).output, /needs Node/, version);
  }
});

/*
 * The key lists cannot be read from the registry at run time — `pnpm start`
 * checks them before `pnpm install`, when nothing that loads TypeScript exists.
 * So they are held against the registry here, where it can be loaded.
 */
test('the key lists agree with the env registry', () => {
  const source = `import('./packages/shared/src/env/registry.ts').then(({ ENV_REGISTRY }) => {
    process.stdout.write(JSON.stringify(ENV_REGISTRY.map((row) => ({
      key: row.key, capability: row.capability,
      placeholder: row.placeholder ?? null, optionalFor: row.optionalFor ?? [],
    }))));
  });`;
  const rows = JSON.parse(
    execFileSync(path.join(ROOT, 'node_modules/.bin/tsx'), ['--eval', source], {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  );
  /* The capabilities `apps/api/src/config/env.ts` and `apps/web/src/config/env.ts` boot with. */
  const bootCapabilities = new Set(['core', 'auth', 'storage', 'stripe', 'email']);
  const withPlaceholder = rows.filter((row) => row.placeholder !== null);
  const supplied = withPlaceholder.filter((row) => !row.optionalFor.includes('baseline'));
  const keys = (list) => list.map((row) => row.key).sort();

  assert.deepEqual(
    [...OPTIONAL_PLACEHOLDER_KEYS].sort(),
    keys(withPlaceholder.filter((row) => row.optionalFor.includes('baseline'))),
  );
  assert.deepEqual(
    Object.keys(REQUIRED_KEYS).sort(),
    keys(
      supplied.filter((row) => bootCapabilities.has(row.capability) && row.key !== 'DATABASE_URL'),
    ),
  );
  assert.deepEqual(
    Object.keys(OPTIONAL_KEYS).sort(),
    keys(supplied.filter((row) => !bootCapabilities.has(row.capability))),
  );
});

test('pnpm start runs this check before installing anything', () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  assert.match(pkg.scripts.start, /^node scripts\/start-local\.mjs && pnpm install && /);
});
