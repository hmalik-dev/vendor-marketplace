import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { childEnv, parseLaneEnv, readRootEnv, renderLaneEnv, ROOT_ENV_FILE } from './env.js';
import type { LaneManifest } from './manifest.js';

const manifest: LaneManifest = {
  ticket: '42',
  branch: 'lane/42',
  worktreePath: '/repo/.claude/worktrees/42',
  apiPort: 4007,
  webPort: 3007,
  database: 'vendor_marketplace_lane_42',
  prUrl: null,
  state: 'active',
  createdAt: '2026-08-28T00:00:00.000Z',
};

const databaseUrl = 'postgresql://localhost:5432/vendor_marketplace_lane_42';

describe('renderLaneEnv', () => {
  it('points the web app at this lane own API port', () => {
    const parsed = parseLaneEnv(renderLaneEnv(manifest, databaseUrl));
    expect(parsed.NEXT_PUBLIC_API_URL).toBe('http://localhost:4007');
    expect(parsed.PORT).toBe('4007');
    expect(parsed.WEB_PORT).toBe('3007');
  });

  it('lets the API accept this lane own web origin, so a browser can drive it', () => {
    const parsed = parseLaneEnv(renderLaneEnv(manifest, databaseUrl));
    // `allowedOrigins()` splits WEB_URL; without it the lane refuses its own
    // web app and every client-side call fails CORS.
    expect(parsed.WEB_URL).toBe('http://localhost:3007');
  });

  it('points the database at this lane own database', () => {
    const parsed = parseLaneEnv(renderLaneEnv(manifest, databaseUrl));
    expect(parsed.DATABASE_URL).toBe(databaseUrl);
  });

  it('never writes the Neon-only variables, which must stay unset locally', () => {
    // The env registry marks both optional for `local`; setting them against
    // the Docker container fails `pnpm preflight` on a correct configuration.
    const parsed = parseLaneEnv(renderLaneEnv(manifest, databaseUrl));
    expect(parsed.DATABASE_URL_UNPOOLED).toBeUndefined();
    expect(parsed.NEON_BRANCH).toBeUndefined();
  });
});

describe('parseLaneEnv', () => {
  it('ignores comments and blank lines', () => {
    expect(parseLaneEnv('# a comment\n\nPORT=4007\n')).toEqual({ PORT: '4007' });
  });

  it('keeps everything after the first equals sign', () => {
    expect(parseLaneEnv('DATABASE_URL=postgresql://h.invalid/db?a=b')).toEqual({
      DATABASE_URL: 'postgresql://h.invalid/db?a=b',
    });
  });
});

describe('childEnv', () => {
  it('lets the lane file win over an inherited value of the same name', () => {
    expect(childEnv({ PORT: '4000' }, 'PORT=4007').PORT).toBe('4007');
  });

  it('preserves inherited variables the lane file does not mention', () => {
    expect(childEnv({ HOME: '/home/dev' }, 'PORT=4007').HOME).toBe('/home/dev');
  });
});

describe('readRootEnv', () => {
  it('reads the worktree root .env, so `lane up` can derive the lane database', () => {
    const worktree = mkdtempSync(path.join(tmpdir(), 'lane-env-'));
    writeFileSync(
      path.join(worktree, ROOT_ENV_FILE),
      '# comment\nDATABASE_URL="postgresql://localhost:5432/vendor_marketplace"\nPORT=4000\n',
    );

    expect(readRootEnv(worktree)).toEqual({
      DATABASE_URL: 'postgresql://localhost:5432/vendor_marketplace',
      PORT: '4000',
    });
  });

  it('returns nothing when there is no .env, leaving the caller to report the variable', () => {
    expect(readRootEnv(mkdtempSync(path.join(tmpdir(), 'lane-env-')))).toEqual({});
  });
});
