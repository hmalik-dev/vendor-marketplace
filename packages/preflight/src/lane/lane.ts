import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runCommand } from '../exec.js';
import { childEnv, LANE_ENV_FILE, renderLaneEnv } from './env.js';
import {
  claimManifest,
  type LaneManifest,
  readManifest,
  readManifests,
  removeManifest,
  updateManifest,
  withLock,
} from './manifest.js';
import { createLaneDatabase, dropLaneDatabase, laneDatabaseName } from './database.js';
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

const LANE_COMMAND_TIMEOUT_MS = 900_000;

async function pnpmInLane(worktreePath: string, args: readonly string[]): Promise<void> {
  const outcome = await runCommand(
    'pnpm',
    ['-C', worktreePath, ...args],
    LANE_COMMAND_TIMEOUT_MS,
    /*
     * A lane has no TTY, and pnpm refuses to replace an existing
     * `node_modules` without one — which is exactly what a fresh worktree
     * needs. `CI` also pins the install to the committed lockfile, which is
     * what a lane should be building against anyway.
     */
    { ...laneEnvFor(worktreePath), CI: 'true' },
  );

  if (outcome.status !== 'ok') {
    throw new Error(`\`pnpm ${args.join(' ')}\` failed in ${worktreePath}: ${outcome.stderr}`);
  }
}

/** The lane's database lives on the same server as the developer's own. */
function baseDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;

  if (!base) {
    throw new Error('DATABASE_URL is not set, so the lane database cannot be derived from it.');
  }

  return base;
}

export interface LaneUpDeps {
  readonly createDatabase: (ticket: string) => Promise<string>;
  readonly probe?: PortProbe;
  readonly install: (worktreePath: string) => Promise<void>;
  readonly build: (worktreePath: string) => Promise<void>;
  readonly migrate: (worktreePath: string) => Promise<void>;
}

const defaultUpDeps: LaneUpDeps = {
  createDatabase: (ticket) => createLaneDatabase(ticket, baseDatabaseUrl()),
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
  /*
   * A lane is usable only once install, build and migrate have all run, which
   * is what `state: 'active'` records. The manifest's mere existence is not
   * enough — a `lane up` that dies in the install leaves one behind, and
   * trusting it would turn every retry into a silent no-op returning a lane
   * with no `node_modules`, no `dist` and an empty database. Neither is the
   * env file: it has to be written *before* install and migrate so that both
   * run against this lane's own database, so it exists during every failure
   * it would be asked to detect.
   */
  const alreadyUp = readManifest(mainCheckout, ticket);

  if (alreadyUp?.state === 'active') {
    return alreadyUp;
  }

  let provisionHere = false;

  /*
   * The lock covers only read-claimed-ports through write-manifest. Creating
   * the database is deliberately left outside it: holding a mutex across that
   * work would let a fifth lane time out waiting on the allocation.
   */
  const manifest = await withLock(mainCheckout, async () => {
    const raced = readManifest(mainCheckout, ticket);

    if (raced) {
      // Keeps the ports this ticket already claimed, and finishes the
      // provisioning its first attempt did not get through.
      provisionHere = raced.state !== 'active';
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
      state: 'provisioning',
      createdAt: new Date().toISOString(),
    };

    claimManifest(mainCheckout, next);
    provisionHere = true;

    return next;
  });

  if (!provisionHere) {
    return manifest;
  }

  const databaseUrl = await deps.createDatabase(ticket);

  // The env file must exist before install and migrate, so both run against
  // this lane's own database rather than the developer's shared one.
  writeFileSync(path.join(worktreePath, LANE_ENV_FILE), renderLaneEnv(manifest, databaseUrl), {
    mode: 0o600,
  });

  await deps.install(worktreePath);
  await deps.build(worktreePath);
  await deps.migrate(worktreePath);

  // Last, and only on success: this is the flag every retry reads.
  return updateManifest(mainCheckout, ticket, { state: 'active' });
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
