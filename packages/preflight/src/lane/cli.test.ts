import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = fileURLToPath(new URL('./cli.ts', import.meta.url));

/*
 * This package's own `tsx`, never `npx tsx`: `npx` reaches the network when the
 * binary is not already cached, which would make this suite fail on a machine
 * that is merely offline. `packages/preflight/src/lane` → the package root.
 */
const TSX = fileURLToPath(new URL('../../node_modules/.bin/tsx', import.meta.url));

let worktree: string;

beforeEach(() => {
  worktree = mkdtempSync(path.join(tmpdir(), 'lane-cli-'));
  writeFileSync(
    path.join(worktree, '.env.lane'),
    ['PORT=4007', 'WEB_PORT=3007', 'API_URL=http://localhost:4007', ''].join('\n'),
  );
});

afterEach(() => {
  rmSync(worktree, { recursive: true, force: true });
});

/** Runs the real CLI the way `pnpm lane:exec` does, and returns what it printed. */
function laneExec(command: readonly string[]): string {
  return execFileSync(TSX, [CLI, 'exec', '42', '--', ...command], {
    cwd: worktree,
    encoding: 'utf8',
  }).trim();
}

/**
 * #448. `laneChildEnv` is unit-tested, but its only production caller is one
 * argument in `cli.ts` — and deleting that argument restored the original
 * defect exactly while leaving every other test in this package green, because
 * the parameter defaults to an empty command. This is the test that goes red.
 *
 * `sh -c 'echo $PORT'` rather than a real server: the assertion is about which
 * port the child is handed, and a child that binds one would need tearing down.
 */
describe('lane exec', () => {
  it('hands a web-serving child the lane web port', () => {
    // The `apps/web` token is what marks this as the web app, exactly as
    // `pnpm --filter=./apps/web start` would.
    expect(laneExec(['sh', '-c', 'echo $PORT # apps/web'])).toBe('3007');
  });

  it('hands every other child the lane API port', () => {
    expect(laneExec(['sh', '-c', 'echo $PORT'])).toBe('4007');
  });

  it('passes the rest of the lane env through unchanged', () => {
    expect(laneExec(['sh', '-c', 'echo $API_URL'])).toBe('http://localhost:4007');
  });
});
