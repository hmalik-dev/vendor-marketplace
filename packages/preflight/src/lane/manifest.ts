import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';

export type LaneState = 'active' | 'pending-merge' | 'failed';

export interface LaneManifest {
  readonly ticket: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly apiPort: number;
  readonly webPort: number;
  readonly database: string;
  readonly prUrl: string | null;
  readonly state: LaneState;
  readonly createdAt: string;
}

/**
 * Lane manifests live in the MAIN checkout, never in a worktree: lanes must see
 * each other's claimed ports, and cleanup must still know what to delete after
 * the lane's session has exited.
 */
export function lanesDir(mainCheckout: string): string {
  return path.join(mainCheckout, '.claude', 'lanes');
}

function manifestPath(mainCheckout: string, ticket: string): string {
  return path.join(lanesDir(mainCheckout), `${ticket}.json`);
}

export function readManifest(mainCheckout: string, ticket: string): LaneManifest | null {
  const file = manifestPath(mainCheckout, ticket);

  if (!existsSync(file)) {
    return null;
  }

  return JSON.parse(readFileSync(file, 'utf8')) as LaneManifest;
}

export function readManifests(mainCheckout: string): LaneManifest[] {
  const dir = lanesDir(mainCheckout);

  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as LaneManifest);
}

/**
 * Creates the manifest with O_EXCL, so two lanes racing on the same ticket
 * cannot both believe they own it. Returns false when one already exists —
 * that is a resumed lane, not an error.
 */
export function claimManifest(mainCheckout: string, manifest: LaneManifest): boolean {
  mkdirSync(lanesDir(mainCheckout), { recursive: true });

  let descriptor: number;

  try {
    descriptor = openSync(manifestPath(mainCheckout, manifest.ticket), 'wx');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false;
    }

    throw error;
  }

  try {
    writeSync(descriptor, `${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    closeSync(descriptor);
  }

  return true;
}

export function updateManifest(
  mainCheckout: string,
  ticket: string,
  patch: Partial<LaneManifest>,
): LaneManifest {
  const current = readManifest(mainCheckout, ticket);

  if (!current) {
    throw new Error(`No lane manifest for ticket ${ticket}`);
  }

  const next: LaneManifest = { ...current, ...patch };
  writeFileSync(manifestPath(mainCheckout, ticket), `${JSON.stringify(next, null, 2)}\n`);

  return next;
}

/** Idempotent: removing a lane that is already gone is a success, not an error. */
export function removeManifest(mainCheckout: string, ticket: string): void {
  rmSync(manifestPath(mainCheckout, ticket), { force: true });
}

const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 10_000;

/**
 * `mkdir` is atomic on POSIX, which makes it a correct mutex without a
 * dependency. Guards the read-then-write window in port allocation, where two
 * lanes would otherwise read the same set of claimed ports and pick the same
 * offset.
 */
export async function withLock<T>(mainCheckout: string, fn: () => Promise<T>): Promise<T> {
  const lock = path.join(lanesDir(mainCheckout), '.lock');
  mkdirSync(lanesDir(mainCheckout), { recursive: true });

  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }

      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for the lane allocation lock at ${lock}`, {
          cause: error,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }

  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
