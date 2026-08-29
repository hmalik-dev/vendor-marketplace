/**
 * Makes a fresh lane worktree able to run `pnpm lane:up` at all.
 *
 * `lane:up` is `tsx packages/preflight/src/lane/cli.ts`, and `tsx` resolves out
 * of the worktree's own `node_modules`. A worktree is a fresh checkout with no
 * `node_modules`, so the very first command the lane workflow documents used to
 * fail with `tsx: command not found` — the lane could not bootstrap itself.
 *
 * It ran before only because `.claude/settings.json` symlinked `node_modules`
 * into the main checkout, which is the failure #232 removed: `pnpm install`
 * follows such a link and recreates the **target**, so a lane repairing itself
 * wrote through into every peer reading that tree.
 *
 * So this runs first, in plain Node with no dependencies — it is the one step
 * that cannot assume an installed tree:
 *
 *   1. Drop an inherited `node_modules` symlink, if there is one. `lstat`, not
 *      `stat`: `stat` follows the link and reports a directory either way.
 *      Only the link is unlinked, so the tree it pointed at is untouched.
 *   2. Install this worktree's own, from the content-addressed store.
 *
 * `adoptOwnModules` in `packages/preflight/src/lane/lane.ts` repeats step 1 for
 * callers that reach `laneUp` in-process. The two are deliberate: this one has
 * to work before anything is installed, that one guards the library path.
 */
import { execFileSync } from 'node:child_process';
import { lstatSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { argv, env, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';

/**
 * Drops `<worktreePath>/node_modules` when it is a symlink. Returns whether
 * there was one. The tree it pointed at is never touched.
 */
export function dropInheritedModules(worktreePath = '.') {
  const modules = path.join(worktreePath, 'node_modules');

  try {
    if (!lstatSync(modules).isSymbolicLink()) {
      return false;
    }
  } catch {
    return false;
  }

  unlinkSync(modules);

  return true;
}

export function bootstrap() {
  if (dropInheritedModules()) {
    stdout.write("Dropped an inherited node_modules symlink; installing this worktree's own.\n");
  }

  /*
   * `--frozen-lockfile` for the same reason CI uses it: a lane builds the
   * committed tree, and a lane that quietly resolves something else is a lane
   * whose green checks mean nothing.
   */
  execFileSync('pnpm', ['install', '--frozen-lockfile'], {
    stdio: 'inherit',
    env: { ...env, CI: 'true' },
  });
}

/* Only when run as a command — importing this file must not install anything. */
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  bootstrap();
}
