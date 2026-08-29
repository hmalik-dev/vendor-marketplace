import { readFileSync } from 'node:fs';
import path from 'node:path';
import { findVariable } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../context.js';
import { parseLaneEnv, renderLaneEnv } from './env.js';
import type { LaneManifest } from './manifest.js';

/*
 * `lane.test.ts` asserts the manifest — the lane's *intent*. This asserts the
 * one thing that made #231 possible anyway: which port the web app's dev
 * script actually binds. `next dev` reads the ambient `PORT`, `PORT` is the
 * API's, so inside a lane the web app took the API's port and the API died
 * with EADDRINUSE.
 *
 * `preflight/turbo.json` names `apps/web/package.json` as an input to this
 * package's tests, without which reverting the dev script would leave the task
 * cached and this file reporting a green it never ran.
 */

const manifest: LaneManifest = {
  ticket: '231',
  branch: 'lane/231',
  worktreePath: '/repo/.claude/worktrees/231',
  apiPort: 4018,
  webPort: 3018,
  database: 'vendor_marketplace_lane_231',
  prUrl: null,
  state: 'active',
  createdAt: '2026-08-29T00:00:00.000Z',
};

const laneEnv = parseLaneEnv(
  renderLaneEnv(manifest, 'postgresql://localhost:5432/vendor_marketplace_lane_231'),
);

function webDevScript(): string {
  const packageJson: unknown = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'apps/web/package.json'), 'utf8'),
  );
  const script = (packageJson as { scripts?: Record<string, string> }).scripts?.dev;

  if (!script) {
    throw new Error('apps/web has no dev script.');
  }

  return script;
}

describe('the web dev server a lane launches', () => {
  it('binds the port the lane sets, never the API port it would inherit from PORT', () => {
    // The variable is read from the registry rather than spelled here, so the
    // row that reaches globalPassThroughEnv and the script that consumes it
    // cannot drift apart.
    const key = findVariable('WEB_PORT')?.key;

    expect(key).toBe('WEB_PORT');
    expect(webDevScript()).toContain(`\${${key}:+--port $${key}}`);

    // The other half of the contract: the variable the script reads is the one
    // the lane writes, and it is the lane's web port, not its API port.
    expect(laneEnv.WEB_PORT).toBe(String(manifest.webPort));
    expect(laneEnv.PORT).toBe(String(manifest.apiPort));
  });

  it('never pins a literal port, which would bind every lane to the same one', () => {
    /*
     * The conditional form above is what keeps `next dev`'s own
     * retry-to-the-next-free-port behaviour outside a lane: `--port` makes Next
     * treat the port as explicit and exit on EADDRINUSE instead of walking on.
     * That check is the `toContain` above, which pins the exact expansion. This
     * one covers the coarser mistake it cannot — a hard-coded number anywhere in
     * the script.
     */
    expect(webDevScript()).not.toMatch(/--port[= ]*\d/);
  });

  it('keeps WEB_PORT in globalPassThroughEnv, or the lane value never reaches next dev', () => {
    /*
     * Turborepo strips a variable absent from this array, so a lane's WEB_PORT
     * would silently fall back to 3000 under `pnpm dev`. `generate.test.ts`
     * asserts turbo.json matches the registry; this asserts the key itself is
     * still in the registry, which regenerating after deleting the row would
     * otherwise satisfy.
     */
    const turbo: unknown = JSON.parse(readFileSync(path.join(REPO_ROOT, 'turbo.json'), 'utf8'));

    expect((turbo as { globalPassThroughEnv?: string[] }).globalPassThroughEnv).toContain(
      'WEB_PORT',
    );
  });
});
