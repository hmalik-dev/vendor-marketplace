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
    laneEnvFor(worktreePath),
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
  const alreadyUp = readManifest(mainCheckout, ticket);

  if (alreadyUp) {
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
