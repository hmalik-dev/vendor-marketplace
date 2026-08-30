import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseLaneEnv } from './env.js';
import {
  adoptOwnModules,
  baseDatabaseUrl,
  currentBranch,
  laneDown,
  laneEnqueued,
  laneEnvFor,
  laneUp,
  type LaneUpDeps,
  parseLaneArgs,
} from './lane.js';
import { readManifest } from './manifest.js';

let root: string;
let worktree: string;

const databaseUrl = 'postgresql://localhost:5432/vendor_marketplace_lane_42';

const deps = (): LaneUpDeps => ({
  createDatabase: vi.fn().mockResolvedValue(databaseUrl),
  probe: vi.fn().mockResolvedValue(true),
  branchOf: vi.fn().mockReturnValue('worktree-42'),
  install: vi.fn().mockResolvedValue(undefined),
  build: vi.fn().mockResolvedValue(undefined),
  migrate: vi.fn().mockResolvedValue(undefined),
  seed: vi.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'lane-root-'));
  worktree = mkdtempSync(path.join(tmpdir(), 'lane-wt-'));
});

afterEach(() => {
  // These tests stub DATABASE_URL; leaving one set would make the next test
  // read the previous test's value instead of the file it wrote.
  vi.unstubAllEnvs();
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
      branchOf: vi.fn().mockReturnValue('worktree-42'),
      install: record('install'),
      build: record('build'),
      migrate: record('migrate'),
      seed: record('seed'),
    });

    // A migration run before the build cannot resolve the db package, and a
    // seed run before the migration has no tables to write into.
    expect(order).toEqual(['install', 'build', 'migrate', 'seed']);
  });

  /*
   * `git clean -xdf` takes `.env` and `.env.lane` in the same pass, so a lane
   * that needs the base `DATABASE_URL` to resume is one that cannot resume in
   * the case the repair exists for. A lane whose file already agrees with its
   * manifest needs no URL at all.
   */
  it('resumes a lane whose env file is already correct without needing DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', databaseUrl);
    const first = await laneUp(root, worktree, '42', deps());

    vi.stubEnv('DATABASE_URL', '');

    await expect(laneUp(root, worktree, '42', deps())).resolves.toEqual(first);
  });

  it('resumes an existing lane without creating a second database', async () => {
    // Repairing a missing or stale file derives the lane URL from the
    // developer's own, so that path does need the base value.
    vi.stubEnv('DATABASE_URL', databaseUrl);

    const d = deps();
    const first = await laneUp(root, worktree, '42', d);
    const second = await laneUp(root, worktree, '42', d);

    expect(second).toEqual(first);
    expect(d.createDatabase).toHaveBeenCalledTimes(1);
  });

  /*
   * #256. A resumed lane's manifest used to be handed back unexamined: whatever
   * `worktreePath` and `branch` it was provisioned with, even after the caller
   * passed a different, real worktree. `lane:exec` and `lane:pr` both read the
   * manifest rather than their own arguments, so a stale path there is a lane
   * that silently operates on a directory nothing points at any more.
   */
  it("re-derives a resumed lane's worktree path and branch instead of handing back stale ones", async () => {
    vi.stubEnv('DATABASE_URL', databaseUrl);
    const first = await laneUp(root, worktree, '42', deps());

    const rebuilt = mkdtempSync(path.join(tmpdir(), 'lane-wt-rebuilt-'));

    try {
      const resumedDeps: LaneUpDeps = {
        ...deps(),
        branchOf: vi.fn().mockReturnValue('worktree-42-rebuilt'),
      };
      const resumed = await laneUp(root, rebuilt, '42', resumedDeps);

      // The manifest now reports the worktree that actually exists on disk…
      expect(resumed.worktreePath).toBe(rebuilt);
      expect(resumed.branch).toBe('worktree-42-rebuilt');
      expect(existsSync(resumed.worktreePath)).toBe(true);

      // …and the write persisted, so a later read sees the same thing.
      expect(readManifest(root, '42')?.worktreePath).toBe(rebuilt);
      expect(readManifest(root, '42')?.branch).toBe('worktree-42-rebuilt');

      // Ports and the database are unchanged — only location and branch moved.
      expect(resumed.apiPort).toBe(first.apiPort);
      expect(resumed.database).toBe(first.database);
      expect(resumedDeps.branchOf).toHaveBeenCalledWith(rebuilt);
      expect(resumedDeps.createDatabase).not.toHaveBeenCalled();
    } finally {
      rmSync(rebuilt, { recursive: true, force: true });
    }
  });

  /*
   * The manifest lives in the main checkout and the env file in the worktree,
   * so the two can part company: the env file is gitignored and a clean takes
   * it while the manifest survives. Returning the manifest alone left the lane
   * unable to run a single command — `lane:exec` refuses without the file — and
   * a lane is only left in place because it is supposed to be resumable.
   */
  it('rebuilds a lane env file that went missing under an existing manifest', async () => {
    // The rebuild derives the lane URL from the developer's own DATABASE_URL,
    // which `lane:up` reads from the environment or the worktree's `.env`.
    vi.stubEnv('DATABASE_URL', databaseUrl);

    const d = deps();
    const first = await laneUp(root, worktree, '42', d);
    rmSync(path.join(worktree, '.env.lane'));

    const second = await laneUp(root, worktree, '42', d);

    expect(second).toEqual(first);
    expect(d.createDatabase).toHaveBeenCalledTimes(1);

    const parsed = parseLaneEnv(readFileSync(path.join(worktree, '.env.lane'), 'utf8'));
    expect(parsed.PORT).toBe(String(first.apiPort));
    expect(parsed.DATABASE_URL).toContain(first.database);
  });

  /*
   * Existence is not the invariant — agreement with the manifest is. A file
   * left over from an earlier allocation points the lane at another lane's
   * ports, and every check passes against the wrong process.
   */
  it('rewrites a lane env file whose ports disagree with the manifest', async () => {
    vi.stubEnv('DATABASE_URL', databaseUrl);

    const first = await laneUp(root, worktree, '42', deps());
    writeFileSync(path.join(worktree, '.env.lane'), 'PORT=4000\nWEB_PORT=3000\n');

    await laneUp(root, worktree, '42', deps());

    const parsed = parseLaneEnv(readFileSync(path.join(worktree, '.env.lane'), 'utf8'));
    expect(parsed.PORT).toBe(String(first.apiPort));
    expect(parsed.WEB_PORT).toBe(String(first.webPort));
  });

  /*
   * `writeFileSync`'s `mode` applies only when it creates the file, so a
   * `.env.lane` that already existed world-readable would have kept that mode
   * through every repair — and it holds a live connection string.
   */
  it.each([
    ['creating the file', false],
    ['repairing one left world-readable', true],
  ])('leaves the lane env file readable only by its owner when %s', async (_label, preexisting) => {
    vi.stubEnv('DATABASE_URL', databaseUrl);
    const file = path.join(worktree, '.env.lane');

    if (preexisting) {
      writeFileSync(file, 'PORT=4000\n', { mode: 0o644 });
    }

    await laneUp(root, worktree, '42', deps());

    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  /*
   * A migrated database is an empty one, and an empty one is not a usable lane:
   * with no categories every vendor and search surface answers 404 and
   * redirects, so a browser pass reports the ticket under test as broken when
   * the fixture is.
   */
  it('seeds the lane, because a migrated database is still an empty one', async () => {
    vi.stubEnv('DATABASE_URL', databaseUrl);
    const collaborators = deps();

    await laneUp(root, worktree, '42', collaborators);

    expect(collaborators.seed).toHaveBeenCalledWith(worktree);
  });

  it('marks a lane active only once install, build and migrate have all run', async () => {
    const failing: LaneUpDeps = {
      ...deps(),
      migrate: vi.fn().mockRejectedValue(new Error('migrate exploded')),
    };

    await expect(laneUp(root, worktree, '42', failing)).rejects.toThrow(/exploded/);

    expect(readManifest(root, '42')?.state).toBe('provisioning');
  });

  it('finishes provisioning a lane whose first attempt claimed ports and then failed', async () => {
    const failing: LaneUpDeps = {
      ...deps(),
      install: vi.fn().mockRejectedValue(new Error('pnpm install exploded')),
    };

    await expect(laneUp(root, worktree, '42', failing)).rejects.toThrow(/exploded/);

    /*
     * Nothing is cleaned up between the attempts, because nothing cleans up in
     * real life either. `.env.lane` is written before the install so that the
     * install and the migration reach this lane's own database, so it is
     * present during exactly the failures the retry has to detect — which is
     * why the manifest state, not the file, is what the retry reads.
     */
    expect(existsSync(path.join(worktree, '.env.lane'))).toBe(true);

    const retry = deps();
    const manifest = await laneUp(root, worktree, '42', retry);

    // The retry keeps the ports already claimed and does the work that never ran.
    expect(manifest.apiPort).toBe(readManifest(root, '42')?.apiPort);
    expect(manifest.state).toBe('active');
    expect(retry.install).toHaveBeenCalledTimes(1);
    expect(retry.build).toHaveBeenCalledTimes(1);
    expect(retry.migrate).toHaveBeenCalledTimes(1);
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

describe('baseDatabaseUrl', () => {
  const exported = 'postgresql://localhost:5432/vendor_marketplace_exported';
  const inFile = 'postgresql://localhost:5432/vendor_marketplace_from_file';

  it('reads DATABASE_URL from the worktree .env when the shell exported none', () => {
    writeFileSync(path.join(worktree, '.env'), `NODE_ENV=development\nDATABASE_URL=${inFile}\n`);
    vi.stubEnv('DATABASE_URL', '');

    expect(baseDatabaseUrl(worktree)).toBe(inFile);
  });

  /*
   * The repository `.env` is hand-written and quotes its values. Reading it
   * with the lane file's own parser returned a URL still wrapped in `"`, which
   * `new URL` rejects — `lane:up` failed with a bare "Invalid URL".
   */
  it('strips the quotes a hand-written .env puts around its values', () => {
    writeFileSync(path.join(worktree, '.env'), `DATABASE_URL="${inFile}"\n`);
    vi.stubEnv('DATABASE_URL', '');

    expect(baseDatabaseUrl(worktree)).toBe(inFile);
  });

  it('lets an exported DATABASE_URL win over the worktree .env', () => {
    writeFileSync(path.join(worktree, '.env'), `DATABASE_URL=${inFile}\n`);
    vi.stubEnv('DATABASE_URL', exported);

    expect(baseDatabaseUrl(worktree)).toBe(exported);
  });

  it('names the file it looked in when neither source supplies one', () => {
    vi.stubEnv('DATABASE_URL', '');

    expect(() => baseDatabaseUrl(worktree)).toThrow(/\.env/);
  });
});

/*
 * #232. Every lane worktree was created with `node_modules` symlinked into the
 * main checkout, which is the one thing `~/.claude/orchestration-policy.md`
 * forbids outright: `pnpm install` follows the link and recreates the *target*,
 * so a lane repairing its own resolution writes through into every peer reading
 * that tree. Four lanes on one fleet run shared a single `node_modules`.
 *
 * The setting that created it is gone from `.claude/settings.json`, but the
 * link is repaired here as well, because a worktree can be made without that
 * setting and the ones already on disk still carry it.
 */
describe('adoptOwnModules', () => {
  const target = (): string => path.join(root, 'node_modules');
  const inWorktree = (): string => path.join(worktree, 'node_modules');

  it('removes an inherited symlink and leaves the tree it pointed at intact', () => {
    mkdirSync(path.join(target(), '.pnpm'), { recursive: true });
    writeFileSync(path.join(target(), 'marker.txt'), 'peer data');
    symlinkSync(target(), inWorktree(), 'dir');

    expect(adoptOwnModules(worktree)).toBe(true);

    expect(existsSync(inWorktree())).toBe(false);
    // The point of the fix: the peers' tree is untouched.
    expect(readFileSync(path.join(target(), 'marker.txt'), 'utf8')).toBe('peer data');
    expect(existsSync(path.join(target(), '.pnpm'))).toBe(true);
  });

  /*
   * `lstat`, never `stat`. `stat` follows the link and reports a directory
   * either way, which is exactly why this stayed invisible through four lanes.
   */
  it('sees a symlink pointing at a directory as a symlink', () => {
    mkdirSync(target(), { recursive: true });
    symlinkSync(target(), inWorktree(), 'dir');

    expect(statSync(inWorktree()).isDirectory()).toBe(true);
    expect(lstatSync(inWorktree()).isSymbolicLink()).toBe(true);
    expect(adoptOwnModules(worktree)).toBe(true);
  });

  it('leaves a real node_modules directory alone', () => {
    mkdirSync(path.join(inWorktree(), 'left-alone'), { recursive: true });

    expect(adoptOwnModules(worktree)).toBe(false);

    expect(lstatSync(inWorktree()).isDirectory()).toBe(true);
    expect(existsSync(path.join(inWorktree(), 'left-alone'))).toBe(true);
  });

  it('does nothing when the worktree has no node_modules yet', () => {
    expect(adoptOwnModules(worktree)).toBe(false);
    expect(existsSync(inWorktree())).toBe(false);
  });

  it('runs before the install, so the install cannot write through the link', async () => {
    mkdirSync(target(), { recursive: true });
    symlinkSync(target(), inWorktree(), 'dir');
    writeFileSync(path.join(worktree, '.env'), `DATABASE_URL=${databaseUrl}\n`);

    const seen: boolean[] = [];
    const upDeps = deps();
    const install = vi.fn(async (worktreePath: string) => {
      seen.push(existsSync(path.join(worktreePath, 'node_modules')));
    });

    await laneUp(root, worktree, '232', { ...upDeps, install });

    expect(install).toHaveBeenCalledTimes(1);
    // The link is gone by the time pnpm runs, so it installs here, not there.
    expect(seen).toEqual([false]);
    expect(existsSync(path.join(target(), 'node_modules'))).toBe(false);
  });
});

/*
 * The other half of #232, and the half a written rule cannot hold. The symlink
 * was not something the lane code did — `.claude/settings.json` asked Claude
 * Code for it with `worktree.symlinkDirectories`, so every worktree arrived
 * with one before `lane:up` ran at all. `adoptOwnModules` repairs that, but
 * repairing it on every lane forever is worse than not asking for it.
 */
describe('.claude/settings.json', () => {
  const settings = (): Record<string, unknown> =>
    JSON.parse(
      readFileSync(path.join(process.cwd(), '..', '..', '.claude', 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;

  it('does not ask for node_modules to be symlinked into worktrees', () => {
    const worktree = settings().worktree as { symlinkDirectories?: string[] } | undefined;

    expect(worktree?.symlinkDirectories ?? []).toEqual([]);
  });

  /* The lanes still need their own branch point, so this must survive. */
  it('still branches every worktree from the remote default', () => {
    const worktree = settings().worktree as { baseRef?: string } | undefined;

    expect(worktree?.baseRef).toBe('fresh');
  });
});

/*
 * The manifest recorded `lane/<ticket>`, a branch name nothing creates —
 * `EnterWorktree` names it `worktree-<ticket>`. `/land-lanes` resolves a lane
 * to its PR through this field, so the wrong name reads as a lane whose branch
 * is gone: abandoned work it correctly refuses to touch, leaving a finished
 * ticket on the board. Lane 198 had to hand-edit the JSON to be landable.
 */
describe('manifest branch', () => {
  it('records the branch the worktree is really on', async () => {
    writeFileSync(path.join(worktree, '.env'), `DATABASE_URL=${databaseUrl}\n`);

    const upDeps = deps();
    const manifest = await laneUp(root, worktree, '42', upDeps);

    expect(manifest.branch).toBe('worktree-42');
    expect(readManifest(root, '42')?.branch).toBe('worktree-42');
    expect(upDeps.branchOf).toHaveBeenCalledWith(worktree);
  });

  it('does not invent a branch name from the ticket', async () => {
    writeFileSync(path.join(worktree, '.env'), `DATABASE_URL=${databaseUrl}\n`);

    const manifest = await laneUp(root, worktree, '42', {
      ...deps(),
      branchOf: vi.fn().mockReturnValue('some-other-branch'),
    });

    expect(manifest.branch).toBe('some-other-branch');
    expect(manifest.branch).not.toBe('lane/42');
  });
});

describe('currentBranch', () => {
  it('reads the checked-out branch out of git', () => {
    execFileSync('git', ['-C', worktree, 'init', '--initial-branch=worktree-232'], {
      stdio: 'ignore',
    });

    expect(currentBranch(worktree)).toBe('worktree-232');
  });
});

/*
 * `verify-and-ship` step 5 says to write the PR url into the manifest, and
 * until now nothing could: it was hand-edited JSON, which is how lane 198 left
 * a null `prUrl` behind. `/land-lanes` resolves a lane through that field, so
 * a lane without one reads as work nobody delivered.
 */
describe('laneEnqueued', () => {
  const enqueue = async (): Promise<void> => {
    writeFileSync(path.join(worktree, '.env'), `DATABASE_URL=${databaseUrl}\n`);
    await laneUp(root, worktree, '42', deps());
  };

  it('records the pr url and moves the lane to pending-merge', async () => {
    await enqueue();

    const updated = laneEnqueued(root, '42', 'https://github.com/o/r/pull/16');

    expect(updated.prUrl).toBe('https://github.com/o/r/pull/16');
    expect(updated.state).toBe('pending-merge');
  });

  it('persists it, so a later session can resolve the lane', async () => {
    await enqueue();
    laneEnqueued(root, '42', 'https://github.com/o/r/pull/16');

    const reread = readManifest(root, '42');

    expect(reread?.prUrl).toBe('https://github.com/o/r/pull/16');
    expect(reread?.state).toBe('pending-merge');
    // The branch has to survive too: land-lanes needs both to find the PR.
    expect(reread?.branch).toBe('worktree-42');
  });

  it('refuses a ticket with no lane rather than inventing one', () => {
    expect(() => laneEnqueued(root, '999', 'https://github.com/o/r/pull/1')).toThrow(/999/);
  });
});

describe('parseLaneArgs pr', () => {
  it('parses the ticket and the url', () => {
    expect(parseLaneArgs(['pr', '42', 'https://github.com/o/r/pull/16'])).toEqual({
      kind: 'pr',
      ticket: '42',
      url: 'https://github.com/o/r/pull/16',
    });
  });

  it('names what it needs when the url is missing', () => {
    expect(() => parseLaneArgs(['pr', '42'])).toThrow(/url/);
  });
});
