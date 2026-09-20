import { chmodSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { type CommandOutcome, runCommand } from '../exec.js';

/**
 * A lane's uploads live on a storage-only Neon branch of its own.
 *
 * Neon Object Storage has no local emulator, so the alternatives are a shared
 * bucket or a bucket per lane. A shared one puts every lane's keys in one
 * namespace, where one lane's reaper can delete another's objects; a branch per
 * lane costs no compute (`--no-compute`) and no storage until the lane writes,
 * because a branch inherits its parent's buckets copy-on-write.
 *
 * The lane never addresses `production`, `staging` or `dev` for writing. `dev`
 * is only ever the *parent* a lane branch is cut from.
 */

/** The one Neon project this repository belongs to; the same id `preview-branch.yml` names. */
export const NEON_PROJECT_ID = 'dark-surf-79137727';

/** Cut from `dev`, which already holds the `uploads` bucket `neon.ts` declares. */
export const LANE_STORAGE_PARENT = 'dev';

/** Branches a lane must never create, delete or write to. */
export const SHARED_BRANCHES = ['production', 'staging', 'dev'] as const;

export const LANE_BRANCH_PREFIX = 'lane-';

/** A crashed lane cannot strand a branch against the plan's ceiling for longer than this. */
export const LANE_BRANCH_TTL_DAYS = 7;

/** The `neon.ts` bucket key, which is also its name on the branch. */
export const UPLOADS_BUCKET = 'uploads';

/** Holds the branch credential for the length of one `env pull`. Gitignored by `.env.*`. */
export const STORAGE_PULL_FILE = '.env.lane-storage-pull';

/** The keys a lane env file carries for storage, in the order they are written. */
export const LANE_STORAGE_KEYS = [
  'STORAGE_ENDPOINT',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  'STORAGE_BUCKET',
  'STORAGE_PUBLIC_URL',
  'NEXT_PUBLIC_STORAGE_PUBLIC_URL',
  'STORAGE_REGION',
] as const;

export type LaneStorageEnv = Readonly<Record<(typeof LANE_STORAGE_KEYS)[number], string>>;

/** Runs the Neon CLI with these arguments. Injected, so tests never reach the network. */
export type NeonRunner = (args: readonly string[]) => Promise<CommandOutcome>;

const NEON_TIMEOUT_MS = 120_000;

export const defaultNeonRunner: NeonRunner = (args) => runCommand('neon', args, NEON_TIMEOUT_MS);

/** `lane-<ticket>`, a name no shared branch can ever have. */
export function laneStorageBranch(ticket: string): string {
  const slug = ticket
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new Error(`Ticket ${ticket} contains no characters usable in a Neon branch name.`);
  }

  return `${LANE_BRANCH_PREFIX}${slug}`;
}

/** Every create, delete and credential pull passes through this. */
export function assertLaneBranch(name: string): void {
  const normalised = name.trim().toLowerCase();

  if ((SHARED_BRANCHES as readonly string[]).includes(normalised)) {
    throw new Error(
      `Refusing to touch the shared branch "${normalised}": a lane's storage is its own ${LANE_BRANCH_PREFIX}<ticket> branch.`,
    );
  }

  if (!name.startsWith(LANE_BRANCH_PREFIX)) {
    throw new Error(
      `"${name}" is not a lane storage branch; those start with ${LANE_BRANCH_PREFIX}.`,
    );
  }
}

const NOT_FOUND = /not found|404|does not exist/i;

const CLI_MISSING =
  'The neon CLI is not installed, so the lane cannot manage its storage branch. ' +
  'Install it with `npm i -g neonctl` and set NEON_API_KEY.';

function describeFailure(outcome: CommandOutcome): string {
  return outcome.stderr || outcome.stdout || 'no output';
}

function requireRan(outcome: CommandOutcome, action: string): CommandOutcome {
  if (outcome.status === 'missing') {
    throw new Error(CLI_MISSING);
  }

  if (outcome.status === 'failed') {
    throw new Error(`${action} failed: ${describeFailure(outcome)}`);
  }

  return outcome;
}

/**
 * Fails, naming what is missing, before a lane creates anything it could
 * strand. There is no fallback: a lane with no way to reach Neon has no
 * storage, and pointing it at a shared bucket instead would put its uploads
 * where another lane's reaper can delete them.
 */
export async function requireNeonAccess(
  run: NeonRunner = defaultNeonRunner,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.NEON_API_KEY) {
    return;
  }

  const outcome = await run(['me', '-o', 'json']);

  if (outcome.status === 'missing') {
    throw new Error(CLI_MISSING);
  }

  if (outcome.status === 'failed') {
    throw new Error(
      'NEON_API_KEY is not set and the neon CLI is not logged in, so the lane cannot create its storage branch. ' +
        'Export NEON_API_KEY (or run `neon auth`) and re-run `pnpm lane:up`.',
    );
  }
}

export interface EnsureStorageOptions {
  /** Where the credential pull file is written: the lane's worktree. */
  readonly workdir: string;
  readonly now?: () => Date;
  /** Only for tests: the name is otherwise derived from the ticket. */
  readonly branch?: string;
}

/**
 * Creates the lane's storage branch when it does not exist and returns the
 * `STORAGE_*` values for it. Idempotent: a branch that exists is left alone, and
 * only the credential is read again — so a lane whose env file was lost can be
 * repaired with the same call that created it.
 */
export async function ensureLaneStorage(
  ticket: string,
  run: NeonRunner,
  options: EnsureStorageOptions,
): Promise<LaneStorageEnv> {
  const branch = options.branch ?? laneStorageBranch(ticket);
  assertLaneBranch(branch);

  const project = ['--project-id', NEON_PROJECT_ID];
  const existing = await run(['branches', 'get', branch, ...project, '-o', 'json', '--no-secrets']);

  if (existing.status === 'missing') {
    throw new Error(CLI_MISSING);
  }

  if (existing.status === 'failed') {
    if (!NOT_FOUND.test(describeFailure(existing))) {
      throw new Error(`Could not look up the Neon branch ${branch}: ${describeFailure(existing)}`);
    }

    await createLaneBranch(run, branch, project, (options.now ?? (() => new Date()))());
  }

  await ensureUploadsBucket(run, branch, project);

  return pullStorageEnv(run, branch, project, options.workdir);
}

async function createLaneBranch(
  run: NeonRunner,
  branch: string,
  project: readonly string[],
  now: Date,
): Promise<void> {
  const expires = new Date(now.getTime() + LANE_BRANCH_TTL_DAYS * 86_400_000);
  const created = await run([
    'branches',
    'create',
    ...project,
    '--name',
    branch,
    '--parent',
    LANE_STORAGE_PARENT,
    '--no-compute',
    '--expires-at',
    expires.toISOString(),
    '--no-secrets',
    '-o',
    'json',
  ]);

  /*
   * Two `lane:up` calls for one ticket both reach this line. The loser is
   * refused because the winner just made the branch, which is the end state
   * wanted, so a refusal is settled by asking again rather than trusted.
   */
  const raced =
    created.status === 'failed' &&
    (await run(['branches', 'get', branch, ...project, '-o', 'json', '--no-secrets'])).status ===
      'ok';

  if (created.status !== 'ok' && !raced) {
    throw new Error(
      `Could not create the Neon branch ${branch} for this lane's storage: ${describeFailure(created)}. ` +
        'A plan branch ceiling is the usual cause; delete an unused lane or preview branch and re-run `pnpm lane:up`.',
    );
  }
}

/**
 * A branch cut from `dev` carries its buckets across, so this normally does
 * nothing. It exists for the day `dev` loses the bucket, and creates it the way
 * `neon.ts` declares it (`public_read`).
 *
 * Not `neon deploy`: the CLI this repository pins (neonctl 4.11) rejects the
 * `buckets` key `neon.ts` uses ("unknown key"), so applying the file fails.
 * Creating the one bucket directly is the same end state.
 */
async function ensureUploadsBucket(
  run: NeonRunner,
  branch: string,
  project: readonly string[],
): Promise<void> {
  const listed = requireRan(
    await run(['buckets', 'list', ...project, '--branch', branch, '-o', 'json']),
    `Listing the buckets on ${branch}`,
  );
  const buckets = JSON.parse(listed.stdout || '[]') as readonly { readonly name?: string }[];

  if (buckets.some((bucket) => bucket.name === UPLOADS_BUCKET)) {
    return;
  }

  requireRan(
    await run([
      'buckets',
      'create',
      UPLOADS_BUCKET,
      ...project,
      '--branch',
      branch,
      '--access-level',
      'public_read',
    ]),
    `Creating the ${UPLOADS_BUCKET} bucket on ${branch}`,
  );
}

async function pullStorageEnv(
  run: NeonRunner,
  branch: string,
  project: readonly string[],
  workdir: string,
): Promise<LaneStorageEnv> {
  const file = path.join(workdir, STORAGE_PULL_FILE);

  /*
   * The CLI writes the file with the process umask (0644) and keeps an existing
   * file's mode, so it is created owner-only first. It also resolves `--file`
   * against its own cwd, hence the relative path.
   */
  writeFileSync(file, '', { mode: 0o600 });
  chmodSync(file, 0o600);

  try {
    requireRan(
      await run([
        'env',
        'pull',
        ...project,
        '--branch',
        branch,
        '--file',
        path.relative(process.cwd(), file),
        '-s',
        'object-storage',
      ]),
      `Reading the storage credential of ${branch}`,
    );

    return storageEnvFrom(parse(readFileSync(file, 'utf8')), branch);
  } finally {
    rmSync(file, { force: true });
  }
}

function storageEnvFrom(pulled: Record<string, string>, branch: string): LaneStorageEnv {
  const endpoint = pulled.AWS_ENDPOINT_URL_S3;
  const accessKeyId = pulled.AWS_ACCESS_KEY_ID;
  const secretValue = pulled.AWS_SECRET_ACCESS_KEY;
  const region = pulled.AWS_REGION;

  if (!endpoint || !accessKeyId || !secretValue || !region) {
    throw new Error(
      `Neon returned an incomplete storage credential for ${branch}: expected AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION.`,
    );
  }

  // Path-style, which is how a `public_read` bucket is served: `<host>/<bucket>/<key>`.
  const publicUrl = `${endpoint.replace(/\/+$/, '')}/${UPLOADS_BUCKET}`;
  const rows: readonly (readonly [(typeof LANE_STORAGE_KEYS)[number], string])[] = [
    ['STORAGE_ENDPOINT', endpoint],
    ['STORAGE_ACCESS_KEY_ID', accessKeyId],
    ['STORAGE_SECRET_ACCESS_KEY', secretValue],
    ['STORAGE_BUCKET', UPLOADS_BUCKET],
    ['STORAGE_PUBLIC_URL', publicUrl],
    ['NEXT_PUBLIC_STORAGE_PUBLIC_URL', publicUrl],
    ['STORAGE_REGION', region],
  ];

  return Object.fromEntries(rows) as LaneStorageEnv;
}

/**
 * Deletes the lane's storage branch. A branch that is already gone is the
 * desired end state; any other refusal is raised, so the manifest survives and
 * `lane:down` can be run again rather than leaving a branch nothing tracks.
 */
export async function dropLaneStorage(
  ticket: string,
  run: NeonRunner,
  branch: string = laneStorageBranch(ticket),
): Promise<void> {
  assertLaneBranch(branch);

  const outcome = await run(['branches', 'delete', branch, '--project-id', NEON_PROJECT_ID]);

  if (outcome.status === 'failed' && NOT_FOUND.test(describeFailure(outcome))) {
    return;
  }

  requireRan(outcome, `Deleting the Neon branch ${branch}`);
}
