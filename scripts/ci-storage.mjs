// The two storage decisions the CI and preview-branch workflows make in code
// rather than in YAML (VEN-457).
//
//   node scripts/ci-storage.mjs map <pulled.env>   the branch's credential, as STORAGE_* rows in GITHUB_ENV
//   node scripts/ci-storage.mjs assert             fail when a production storage value is in the environment
//
// Uploads in CI go to a Neon branch that is not `production`: the per-run
// `ci-<run>` branch, or the pull request's `preview/pr-<n>`. `map` masks every
// value before it writes it, and neither command ever prints one.
import { appendFileSync, readFileSync } from 'node:fs';

/**
 * The production branch's id. Neon derives a branch's storage host from it
 * (`<id>.storage.<region>.aws.neon.tech`), so this names production's endpoint
 * without holding any credential for it. An identifier, not a secret.
 */
export const PRODUCTION_BRANCH_ID = 'br-curly-boat-axhuowvc';

/** The `neon.ts` bucket key; also its name on every branch. */
export const UPLOADS_BUCKET = 'uploads';

/** `KEY=value` lines, optionally quoted: all `neon env pull` writes, and no dependency to install. */
export function parsePulled(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) out[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  return out;
}

const STORAGE_NAME = /(^|_)(STORAGE|AWS)_/;

/**
 * The STORAGE_* rows for a branch, from what `neon env pull -s object-storage`
 * wrote. Same mapping as the lane's (`packages/preflight/src/lane/storage.ts`):
 * the public URL is the bucket path under the branch's storage host.
 */
export function storageRows(pulled) {
  const endpoint = pulled.AWS_ENDPOINT_URL_S3;
  const accessKeyId = pulled.AWS_ACCESS_KEY_ID;
  const secretValue = pulled.AWS_SECRET_ACCESS_KEY;
  const region = pulled.AWS_REGION;

  if (!endpoint || !accessKeyId || !secretValue || !region) {
    throw new Error(
      'the pulled storage credential is incomplete: expected AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION',
    );
  }

  const publicUrl = `${endpoint.replace(/\/+$/, '')}/${UPLOADS_BUCKET}`;

  return [
    ['STORAGE_ENDPOINT', endpoint],
    ['STORAGE_ACCESS_KEY_ID', accessKeyId],
    ['STORAGE_SECRET_ACCESS_KEY', secretValue],
    ['STORAGE_BUCKET', UPLOADS_BUCKET],
    ['STORAGE_PUBLIC_URL', publicUrl],
    ['NEXT_PUBLIC_STORAGE_PUBLIC_URL', publicUrl],
    ['STORAGE_REGION', region],
  ];
}

/**
 * The names of the storage variables that point at production: a value
 * carrying the production branch id, or a `NEON_BRANCH` that is `production`.
 * Names only — the values are credentials.
 */
export function productionStorageFindings(env) {
  const findings = Object.entries(env)
    .filter(
      ([name, value]) => STORAGE_NAME.test(name) && (value ?? '').includes(PRODUCTION_BRANCH_ID),
    )
    .map(([name]) => name);

  if (env.NEON_BRANCH?.trim().toLowerCase() === 'production') findings.push('NEON_BRANCH');

  return findings.sort();
}

function append(file, text) {
  if (file) appendFileSync(file, text);
}

function main([command, pulledPath], env = process.env) {
  if (command === 'map' && pulledPath) {
    const rows = storageRows(parsePulled(readFileSync(pulledPath, 'utf8')));
    const production = productionStorageFindings(Object.fromEntries(rows));

    // Nothing is written for a branch that is production's.
    if (production.length > 0) {
      process.stderr.write(`the pulled branch is production's: ${production.join(', ')}\n`);
      return 1;
    }

    // Masked first: a value written to GITHUB_ENV is otherwise readable in later logs.
    for (const [, value] of rows) process.stdout.write(`::add-mask::${value}\n`);
    append(env.GITHUB_ENV, rows.map(([name, value]) => `${name}=${value}\n`).join(''));
    return 0;
  }

  if (command === 'assert') {
    const findings = productionStorageFindings(env);
    if (findings.length === 0) {
      process.stdout.write('No production storage value is present in this job.\n');
      return 0;
    }
    process.stdout.write(
      `::error::a production storage value is present in this job's environment: ${findings.join(', ')}\n`,
    );
    return 1;
  }

  process.stderr.write('usage: ci-storage.mjs map <pulled.env> | assert\n');
  return 64;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
