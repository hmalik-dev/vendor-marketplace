import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseLaneEnv } from './env.js';
import { laneDown, laneEnvFor, laneUp, type LaneUpDeps, parseLaneArgs } from './lane.js';
import { readManifest } from './manifest.js';

let root: string;
let worktree: string;

const databaseUrl = 'postgresql://localhost:5432/vendor_marketplace_lane_42';

const deps = (): LaneUpDeps => ({
  createDatabase: vi.fn().mockResolvedValue(databaseUrl),
  probe: vi.fn().mockResolvedValue(true),
  install: vi.fn().mockResolvedValue(undefined),
  build: vi.fn().mockResolvedValue(undefined),
  migrate: vi.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'lane-root-'));
  worktree = mkdtempSync(path.join(tmpdir(), 'lane-wt-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(worktree, { recursive: true, force: true });
});

describe('parseLaneArgs', () => {
  it('parses up and down', () => {
    expect(parseLaneArgs(['up', '42'])).toEqual({ kind: 'up', ticket: '42' });
    expect(parseLaneArgs(['down', '42'])).toEqual({ kind: 'down', ticket: '42' });
  });

  it('parses exec and keeps the command after the separator', () => {
    expect(parseLaneArgs(['exec', '42', '--', 'pnpm', 'dev'])).toEqual({
      kind: 'exec',
      ticket: '42',
      command: ['pnpm', 'dev'],
    });
  });

  it('accepts exec without an explicit separator', () => {
    expect(parseLaneArgs(['exec', '42', 'pnpm', 'dev'])).toEqual({
      kind: 'exec',
      ticket: '42',
      command: ['pnpm', 'dev'],
    });
  });

  it('rejects an unknown subcommand', () => {
    expect(() => parseLaneArgs(['sideways', '42'])).toThrow(/unknown/i);
  });

  it('rejects a missing ticket', () => {
    expect(() => parseLaneArgs(['up'])).toThrow(/ticket/i);
  });

  it('rejects exec with no command', () => {
    expect(() => parseLaneArgs(['exec', '42', '--'])).toThrow(/command/i);
  });
});

describe('laneUp', () => {
  it('writes a manifest and an env file that agree on the ports', async () => {
    const manifest = await laneUp(root, worktree, '42', deps());

    expect(readManifest(root, '42')).toEqual(manifest);

    const parsed = parseLaneEnv(readFileSync(path.join(worktree, '.env.lane'), 'utf8'));
    expect(parsed.PORT).toBe(String(manifest.apiPort));
    expect(parsed.WEB_PORT).toBe(String(manifest.webPort));
    expect(parsed.NEXT_PUBLIC_API_URL).toBe(`http://localhost:${manifest.apiPort}`);
  });

  it('installs, builds and migrates exactly once, after the env file exists', async () => {
    const d = deps();
    await laneUp(root, worktree, '42', d);

    expect(d.install).toHaveBeenCalledTimes(1);
    expect(d.build).toHaveBeenCalledTimes(1);
    expect(d.migrate).toHaveBeenCalledTimes(1);
  });

  it('builds the workspace packages before migrating', async () => {
    const order: string[] = [];
    const record = (label: string) =>
      vi.fn().mockImplementation(() => {
        order.push(label);
        return Promise.resolve(undefined);
      });

    await laneUp(root, worktree, '42', {
      createDatabase: vi.fn().mockResolvedValue(databaseUrl),
      probe: vi.fn().mockResolvedValue(true),
      install: record('install'),
      build: record('build'),
      migrate: record('migrate'),
    });

    // A migration run before the build cannot resolve the db package.
    expect(order).toEqual(['install', 'build', 'migrate']);
  });

  it('resumes an existing lane without creating a second database', async () => {
    const d = deps();
    const first = await laneUp(root, worktree, '42', d);
    const second = await laneUp(root, worktree, '42', d);

    expect(second).toEqual(first);
    expect(d.createDatabase).toHaveBeenCalledTimes(1);
  });

  it('never hands two lanes the same ports', async () => {
    const first = await laneUp(root, worktree, '42', deps());
    const second = await laneUp(root, worktree, '43', deps());

    expect(first.apiPort).not.toBe(second.apiPort);
    expect(first.webPort).not.toBe(second.webPort);
  });

  it('derives the api url from its own api port, never the shared base', async () => {
    const manifest = await laneUp(root, worktree, '42', deps());
    const parsed = parseLaneEnv(readFileSync(path.join(worktree, '.env.lane'), 'utf8'));

    expect(parsed.NEXT_PUBLIC_API_URL).not.toBe('http://localhost:4000');
    expect(parsed.NEXT_PUBLIC_API_URL).toBe(`http://localhost:${manifest.apiPort}`);
  });
});

describe('laneDown', () => {
  it('drops the database, the env file, and the manifest', async () => {
    await laneUp(root, worktree, '42', deps());

    const dropDatabase = vi.fn().mockResolvedValue(undefined);
    await laneDown(root, worktree, '42', { dropDatabase });

    expect(dropDatabase).toHaveBeenCalledWith('42');
    expect(existsSync(path.join(worktree, '.env.lane'))).toBe(false);
    expect(readManifest(root, '42')).toBeNull();
  });

  it('is idempotent for a lane that was never up', async () => {
    const dropDatabase = vi.fn().mockResolvedValue(undefined);
    await expect(laneDown(root, worktree, 'ghost', { dropDatabase })).resolves.toBeUndefined();
  });
});

describe('laneEnvFor', () => {
  it('lets the lane file override an inherited value', () => {
    writeFileSync(path.join(worktree, '.env.lane'), 'PORT=4007\n');
    const env = laneEnvFor(worktree, { PORT: '4000', HOME: '/home/dev' });

    expect(env.PORT).toBe('4007');
    expect(env.HOME).toBe('/home/dev');
  });

  it('refuses to run when the lane was never brought up', () => {
    expect(() => laneEnvFor(worktree, {})).toThrow(/lane:up/);
  });
});
