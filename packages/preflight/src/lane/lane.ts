import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runCommand } from '../exec.js';
import { ENV_FILES } from '../context.js';
import { childEnv, LANE_ENV_FILE, parseLaneEnv, renderLaneEnv } from './env.js';
import {
  claimManifest,
  type LaneManifest,
  readManifest,
  readManifests,
  removeManifest,
  withLock,
} from './manifest.js';
import {
  createLaneDatabase,
  dropLaneDatabase,
  laneDatabaseName,
  laneDatabaseUrl,
} from './database.js';
import { allocateOffset, API_BASE, type PortProbe, WEB_BASE } from './ports.js';

/*
 * Each member carries a single literal `kind`. A shared `'up' | 'down'` member
 * reads more compactly but does not discriminate: excluding `'up'` leaves the
 * member in play as `'down'`, so narrowing to `exec` never happens.
 */
export type LaneCommand =
  | { readonly kind: 'up'; readonly ticket: string }
  | { readonly kind: 'down'; readonly ticket: string }
  | { readonly kind: 'exec'; readonly ticket: string; readonly command: readonly string[] };

export function parseLaneArgs(argv: readonly string[]): LaneCommand {
  const [kind, ticket, ...rest] = argv;

  if (kind !== 'up' && kind !== 'down' && kind !== 'exec') {
    throw new Error(`Unknown lane subcommand: ${kind ?? '(none)'}. Expected up, down or exec.`);
  }

  if (!ticket) {
    throw new Error(`lane ${kind} requires a ticket identifier.`);
  }

  if (kind === 'up') {
    return { kind: 'up', ticket };
  }

  if (kind === 'down') {
    return { kind: 'down', ticket };
  }

  // `--` is optional: pnpm swallows one separator before the script's own args.
  const separator = rest.indexOf('--');
  const command = separator === -1 ? rest : rest.slice(separator + 1);

  if (command.length === 0) {
    throw new Error('lane exec requires a command, for example `lane:exec 42 -- pnpm dev`.');
  }

  return { kind, ticket, command };
}

/**
 * The lane's environment, with the lane file winning over anything inherited.
 * This is the opposite of dotenv's precedence, deliberately: a lane launched
 * from a shell that had already sourced the root `.env` would otherwise bind
 * the shared ports and silently lose its isolation.
 */
export function laneEnvFor(
  worktreePath: string,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const file = path.join(worktreePath, LANE_ENV_FILE);

  if (!existsSync(file)) {
    throw new Error(`No ${LANE_ENV_FILE} in ${worktreePath}. Run \`pnpm lane:up <ticket>\` first.`);
  }

  return childEnv(base, readFileSync(file, 'utf8'));
}

/** Owner read/write only: the lane env file holds a live connection string. */
const LANE_ENV_MODE = 0o600;

const LANE_COMMAND_TIMEOUT_MS = 900_000;

async function pnpmInLane(worktreePath: string, args: readonly string[]): Promise<void> {
  const outcome = await runCommand(
    'pnpm',
    ['-C', worktreePath, ...args],
    LANE_COMMAND_TIMEOUT_MS,
    laneEnvFor(worktreePath),
  );

  if (outcome.status !== 'ok') {
    throw new Error(`\`pnpm ${args.join(' ')}\` failed in ${worktreePath}: ${outcome.stderr}`);
  }
}

/**
 * The lane's database lives on the same server as the developer's own.
 *
 * `pnpm lane:up` is the first command a fresh worktree runs, and nothing has
 * loaded the repository `.env` by then: pnpm does not source it, and the lane
 * CLI runs before any app boots. Reading only `process.env` therefore failed
 * every lane whose operator had not exported `DATABASE_URL` by hand. The
 * inherited value still wins, so a shell that did export one keeps control.
 */
export function baseDatabaseUrl(worktreePath: string): string {
  const inherited = process.env.DATABASE_URL;

  if (inherited) {
    return inherited;
  }

  const envFile = path.join(worktreePath, ENV_FILES.local);
  const fromFile = existsSync(envFile)
    ? parseLaneEnv(readFileSync(envFile, 'utf8')).DATABASE_URL
    : undefined;

  if (!fromFile) {
    throw new Error(
      `DATABASE_URL is not set and no DATABASE_URL was found in ${envFile}, so the lane database cannot be derived from it.`,
    );
  }

  return fromFile;
}

/**
 * Makes the lane's env file match its manifest, which is the invariant every
 * path returning a manifest must leave true — `lane:exec` refuses to run
 * without the file, and an app loading only its root and package `.env` never
 * sees a lane any other way.
 *
 * Writes only when the file disagrees with the manifest, so it repairs one
 * that was deleted *and* one left stale by an earlier allocation, without
 * touching the mtime of a lane that is already correct.
 *
 * `resolveDatabaseUrl` is a thunk because resolving it can throw: it reads the
 * worktree's own `.env`, and `git clean -xdf` takes `.env` and `.env.lane` in
 * the same pass. Calling it eagerly made resuming a perfectly good lane fail
 * for a value that lane did not need.
 *
 * The mode is applied on every call, never left to `writeFileSync`'s `mode`.
 * That option takes effect only when the file is created, so a `.env.lane`
 * that already existed with a permissive mode would keep it — and this
 * function now runs against files it did not create. The file holds a live
 * connection string, so on a shared machine that is every local account's to
 * read.
 */
function ensureLaneEnv(
  worktreePath: string,
  manifest: LaneManifest,
  resolveDatabaseUrl: () => string,
): void {
  const file = path.join(worktreePath, LANE_ENV_FILE);

  if (!laneEnvAgreesWith(file, manifest)) {
    writeFileSync(file, renderLaneEnv(manifest, resolveDatabaseUrl()));
  }

  chmodSync(file, LANE_ENV_MODE);
}

/**
 * Whether an existing lane env file describes the lane the manifest describes.
 *
 * Compares the fields rather than the rendered text, so the check needs no
 * base `DATABASE_URL` of its own — only the lane database name, which the
 * manifest already carries.
 */
function laneEnvAgreesWith(file: string, manifest: LaneManifest): boolean {
  if (!existsSync(file)) {
    return false;
  }

  const values = parseLaneEnv(readFileSync(file, 'utf8'));

  return (
    values.PORT === String(manifest.apiPort) &&
    values.WEB_PORT === String(manifest.webPort) &&
    values.NEXT_PUBLIC_API_URL === `http://localhost:${manifest.apiPort}` &&
    (values.DATABASE_URL ?? '').endsWith(`/${manifest.database}`)
  );
}

/** The lane's own connection string, derived from the developer's own. */
function laneUrl(worktreePath: string, manifest: LaneManifest): string {
  return laneDatabaseUrl(baseDatabaseUrl(worktreePath), manifest.database);
}

export interface LaneUpDeps {
  /*
   * Takes the worktree, not a resolved URL: the base `DATABASE_URL` is read
   * from that worktree's own `.env`, and resolving it in `laneUp` instead
   * would make the orchestrator require a real environment even when this
   * collaborator is faked.
   */
  readonly createDatabase: (ticket: string, worktreePath: string) => Promise<string>;
  readonly probe?: PortProbe;
  readonly install: (worktreePath: string) => Promise<void>;
  readonly build: (worktreePath: string) => Promise<void>;
  readonly migrate: (worktreePath: string) => Promise<void>;
}

const defaultUpDeps: LaneUpDeps = {
  createDatabase: (ticket, worktreePath) =>
    createLaneDatabase(ticket, baseDatabaseUrl(worktreePath)),
  install: (worktreePath) => pnpmInLane(worktreePath, ['install']),
  /*
   * A fresh worktree has no `dist/` for the workspace packages, so every
   * import of `@vendor-marketplace/shared` fails to resolve and the lane
   * starts with a broken typecheck and an unrunnable migration. Apps are
   * excluded deliberately: a lane runs dev servers, and building them here
   * would cost minutes for output nothing reads.
   */
  build: (worktreePath) => pnpmInLane(worktreePath, ['build', '--filter=./packages/*']),
  migrate: (worktreePath) => pnpmInLane(worktreePath, ['db:migrate']),
};

export async function laneUp(
  mainCheckout: string,
  worktreePath: string,
  ticket: string,
  deps: LaneUpDeps = defaultUpDeps,
): Promise<LaneManifest> {
  const alreadyUp = readManifest(mainCheckout, ticket);

  /*
   * The manifest is the record that a lane exists; the env file is a
   * projection of it. The two can part company — the env file is gitignored
   * and lives in the worktree, so a clean or a stray removal takes it while
   * the manifest survives in the main checkout. Reconciling it on every
   * resume is what keeps a failed lane resumable with `/ticket <id>`, which is
   * the whole reason a lane is left in place.
   */
  if (alreadyUp) {
    ensureLaneEnv(worktreePath, alreadyUp, () => laneUrl(worktreePath, alreadyUp));

    return alreadyUp;
  }

  let claimedNow = false;

  /*
   * The lock covers only read-claimed-ports through write-manifest. Creating
   * the database is deliberately left outside it: holding a mutex across that
   * work would let a fifth lane time out waiting on the allocation.
   */
  const manifest = await withLock(mainCheckout, async () => {
    const raced = readManifest(mainCheckout, ticket);

    if (raced) {
      return raced;
    }

    const claimed = new Set(readManifests(mainCheckout).map((lane) => lane.apiPort - API_BASE));
    const offset = await allocateOffset(ticket, claimed, deps.probe);

    const next: LaneManifest = {
      ticket,
      branch: `lane/${ticket}`,
      worktreePath,
      apiPort: API_BASE + offset,
      webPort: WEB_BASE + offset,
      database: laneDatabaseName(ticket),
      prUrl: null,
      state: 'active',
      createdAt: new Date().toISOString(),
    };

    claimManifest(mainCheckout, next);
    claimedNow = true;

    return next;
  });

  if (!claimedNow) {
    // Lost the race: another caller owns the setup below, but this one still
    // has to leave with a usable lane.
    ensureLaneEnv(worktreePath, manifest, () => laneUrl(worktreePath, manifest));

    return manifest;
  }

  const databaseUrl = await deps.createDatabase(ticket, worktreePath);

  // The env file must exist before install and migrate, so both run against
  // this lane's own database rather than the developer's shared one.
  ensureLaneEnv(worktreePath, manifest, () => databaseUrl);

  await deps.install(worktreePath);
  await deps.build(worktreePath);
  await deps.migrate(worktreePath);

  return manifest;
}

export interface LaneDownDeps {
  readonly dropDatabase: (ticket: string) => Promise<void>;
}

const defaultDownDeps: LaneDownDeps = { dropDatabase: (ticket) => dropLaneDatabase(ticket) };

/** Idempotent: tearing down a lane that is already gone is the desired end state. */
export async function laneDown(
  mainCheckout: string,
  worktreePath: string,
  ticket: string,
  deps: LaneDownDeps = defaultDownDeps,
): Promise<void> {
  await deps.dropDatabase(ticket);
  rmSync(path.join(worktreePath, LANE_ENV_FILE), { force: true });
  removeManifest(mainCheckout, ticket);
}
