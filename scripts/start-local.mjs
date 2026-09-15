/**
 * The checks `pnpm start` runs before it installs anything (VEN-410).
 *
 * `pnpm start` is the one command the README gives a non-technical teammate,
 * and each of its steps used to fail as a stack trace: an old Node as an engine
 * error from pnpm, a closed Docker Desktop as a daemon socket error, a fresh
 * clone as a migrator refusing `postgresql://...`. So this runs first, in plain
 * Node with no dependencies, and stops with one plain sentence instead:
 *
 *   1. Node is at least `engines.node` from `package.json`.
 *   2. `docker info` answers, which it only does once Docker Desktop is running.
 *   3. `.env` exists. A missing one is created from `.env.example` with the
 *      compose Postgres URL filled in; the storage rows already carry the MinIO
 *      values there. An existing `.env` is only ever read.
 *   4. No key the apps refuse to boot without still holds its placeholder.
 *
 * Exit 0 lets the rest of the `start` chain run; anything else stops it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { argv, exit, stderr, version } from 'node:process';
import { pathToFileURL } from 'node:url';

/*
 * Rows with a placeholder that `apps/api` or `apps/web` validate at boot, so
 * the app does not start while any of them is unfilled. Held against the
 * registry by `start-local.test.mjs`, because the registry is TypeScript and
 * nothing that loads it is installed yet when this runs.
 */
export const REQUIRED_KEYS = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'Clerk, the sign-in service',
  CLERK_SECRET_KEY: 'Clerk, the sign-in service',
  CLERK_WEBHOOK_SECRET: 'Clerk, the sign-in service',
  STRIPE_SECRET_KEY: 'Stripe, test-mode payments',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'Stripe, test-mode payments',
  STRIPE_WEBHOOK_SECRET: 'Stripe, test-mode payments',
  RESEND_API_KEY: 'Resend, email sending',
};

/* Rows with a placeholder that nothing validates at boot. */
export const OPTIONAL_KEYS = {
  SENTRY_DSN: 'Sentry, error reporting',
};

/*
 * Rows the registry marks absent-able locally. Their placeholders are not
 * absent, though: the migrator prefers any `DATABASE_URL_UNPOOLED` it is
 * given, and the API's boot schema rejects `operator@...`. Empty is absent to
 * both, so a created `.env` carries them empty.
 */
export const OPTIONAL_PLACEHOLDER_KEYS = [
  'DATABASE_URL_UNPOOLED',
  'NEON_BRANCH',
  'RESEND_WEBHOOK_SECRET',
  'OPERATOR_ALERT_EMAIL',
];

const DOCKER_NOT_INSTALLED =
  'Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/, open it, then run this again.\n';
const DOCKER_NOT_RUNNING =
  'Docker is not running. Open Docker Desktop and wait for the whale icon, then run this again.\n';

function parseVersion(text) {
  return text
    .replace(/^[^\d]*/, '')
    .split('.')
    .map(Number);
}

function isAtLeast(current, minimum) {
  const have = parseVersion(current);
  const need = parseVersion(minimum);

  for (let index = 0; index < need.length; index += 1) {
    const difference = (have[index] ?? 0) - (need[index] ?? 0);

    if (difference !== 0) {
      return difference > 0;
    }
  }

  return true;
}

/** The URL of the `postgres` compose service, as seen from the host. */
export function localDatabaseUrl(composeText) {
  const read = (pattern) => composeText.match(pattern)?.[1];
  const user = read(/POSTGRES_USER: (\S+)/);
  const password = read(/POSTGRES_PASSWORD: (\S+)/);
  const database = read(/POSTGRES_DB: (\S+)/);
  const port = read(/- '(\d+):5432'/);

  if (!user || !password || !database || !port) {
    throw new Error('docker-compose.yml no longer declares the postgres service this reads.');
  }

  return `postgresql://${user}:${password}@localhost:${port}/${database}`;
}

function parseEnv(text) {
  const values = new Map();

  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);

    /* The last assignment wins, as it does for dotenv in the apps. */
    if (match) {
      values.set(match[1], match[2].trim().replace(/^(['"])(.*)\1$/, '$2'));
    }
  }

  return values;
}

function createEnv(exampleText, composeText) {
  const filled = new Map([
    ['DATABASE_URL', localDatabaseUrl(composeText)],
    ...OPTIONAL_PLACEHOLDER_KEYS.map((key) => [key, '']),
  ]);

  return exampleText
    .split('\n')
    .map((line) => {
      const key = line.match(/^([A-Z0-9_]+)=/)?.[1];

      return key && filled.has(key) ? `${key}=${filled.get(key)}` : line;
    })
    .join('\n');
}

function unfilled(keys, env, example) {
  return Object.entries(keys).filter(([key]) => {
    const value = env.get(key) ?? '';

    return value === '' || value === example.get(key);
  });
}

function listKeys(entries) {
  return entries.map(([key, service]) => `  - ${key} (${service})\n`).join('');
}

/**
 * Runs every check against `root`. Returns the exit code; writes only plain
 * sentences through `write`, never an error object.
 */
export function startLocal({ root, nodeVersion, dockerInfo, write }) {
  const read = (file) => readFileSync(path.join(root, file), 'utf8');
  const minimum = JSON.parse(read('package.json')).engines.node.replace(/^>=\s*/, '');

  if (!isAtLeast(nodeVersion, minimum)) {
    write(
      `The app needs Node ${minimum} or newer, and this computer has ${nodeVersion.replace(/^v/, '')}. Install the LTS version from https://nodejs.org, open a new terminal, then run this again.\n`,
    );
    return 1;
  }

  try {
    dockerInfo();
  } catch (error) {
    write(error?.code === 'ENOENT' ? DOCKER_NOT_INSTALLED : DOCKER_NOT_RUNNING);
    return 1;
  }

  const envPath = path.join(root, '.env');
  const exampleText = read('.env.example');

  if (!existsSync(envPath)) {
    writeFileSync(envPath, createEnv(exampleText, read('docker-compose.yml')), { mode: 0o600 });
    write('Created .env with the local database and file storage settings.\n');
  }

  const env = parseEnv(readFileSync(envPath, 'utf8'));
  const example = parseEnv(exampleText);
  const missing = unfilled(REQUIRED_KEYS, env, example);

  if (missing.length === 0) {
    return 0;
  }

  const optional = unfilled(OPTIONAL_KEYS, env, example);

  write(
    `\nThe app will not start until these keys in .env have real values:\n${listKeys(missing)}` +
      (optional.length > 0
        ? `\nThese are optional; the app runs without them:\n${listKeys(optional)}`
        : '') +
      '\nAsk the project owner for the .env file, move it into this folder as step 5 of the README shows, then run pnpm start again.\n',
  );
  return 1;
}

/* Only when run as a command — importing this file must not check anything. */
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  try {
    exit(
      startLocal({
        root: process.cwd(),
        nodeVersion: version,
        dockerInfo: () => execFileSync('docker', ['info'], { stdio: 'ignore' }),
        write: (text) => stderr.write(text),
      }),
    );
  } catch (error) {
    stderr.write(`pnpm start could not check this folder: ${error?.message ?? error}\n`);
    exit(1);
  }
}
