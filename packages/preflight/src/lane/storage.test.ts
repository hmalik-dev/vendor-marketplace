import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommandOutcome } from '../exec.js';
import {
  assertLaneBranch,
  dropLaneStorage,
  ensureLaneStorage,
  laneStorageBranch,
  type NeonRunner,
  requireNeonAccess,
} from './storage.js';

const ok = (stdout = ''): CommandOutcome => ({ status: 'ok', stdout, stderr: '' });
const failed = (stderr: string): CommandOutcome => ({ status: 'failed', stdout: '', stderr });

const ENDPOINT = 'https://br-lane.storage.c-4.us-east-2.aws.neon.tech';

// Fixture values only: the fake CLI hands these back as the branch's credential.
const FIXTURE_ID = 'lane-fixture-id';
const FIXTURE_VALUE = 'lane-fixture-value';
const PULLED: readonly (readonly [string, string])[] = [
  ['NEON_BRANCH', 'br-lane'],
  ['AWS_ACCESS_KEY_ID', FIXTURE_ID],
  ['AWS_SECRET_ACCESS_KEY', FIXTURE_VALUE],
  ['AWS_ENDPOINT_URL_S3', ENDPOINT],
  ['AWS_REGION', 'us-east-2'],
];

/**
 * A stand-in for the Neon CLI that keeps the one thing the lane step reasons
 * about: which branches exist. `env pull` writes the file the real one would,
 * at the path it was given, so the step's own read of it is exercised.
 */
function fakeNeon(initial: readonly string[] = [], buckets: readonly string[] = ['uploads']) {
  const branches = new Set(initial);
  const calls: string[][] = [];

  const run: NeonRunner = async (args) => {
    calls.push([...args]);
    const [group, verb] = args;
    const flag = (name: string) => args[args.indexOf(name) + 1] ?? '';

    if (group === 'branches' && verb === 'get') {
      return branches.has(args[2] ?? '') ? ok('{}') : failed('ERROR: branch not found (404)');
    }

    if (group === 'branches' && verb === 'create') {
      branches.add(flag('--name'));
      return ok('{}');
    }

    if (group === 'branches' && verb === 'delete') {
      return branches.delete(args[2] ?? '') ? ok('{}') : failed('ERROR: branch not found (404)');
    }

    if (group === 'buckets' && verb === 'list') {
      return ok(JSON.stringify(buckets.map((name) => ({ name, access_level: 'public_read' }))));
    }

    if (group === 'buckets' && verb === 'create') {
      return ok();
    }

    if (group === 'env' && verb === 'pull') {
      const lines = PULLED.map(([key, value]) => `${key}=${value}`);
      writeFileSync(path.resolve(process.cwd(), flag('--file')), `${lines.join('\n')}\n`);
      return ok();
    }

    return failed(`unexpected neon call: ${args.join(' ')}`);
  };

  return { run, calls, branches };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'lane-storage-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('laneStorageBranch', () => {
  it('names the branch after the ticket under a lane- prefix', () => {
    expect(laneStorageBranch('VEN-457')).toBe('lane-ven-457');
    expect(laneStorageBranch('feat/a.b')).toBe('lane-feat-a-b');
  });

  it('rejects a ticket that reduces to nothing', () => {
    expect(() => laneStorageBranch('---')).toThrow(/branch name/i);
  });

  it.each(['production', 'staging', 'dev'])(
    'cannot resolve to %s, whatever the ticket is called',
    (shared) => {
      expect(laneStorageBranch(shared)).toBe(`lane-${shared}`);
    },
  );
});

describe('assertLaneBranch', () => {
  it.each(['production', 'staging', 'dev', 'Production', ' dev '])(
    'refuses %j, which is a shared branch',
    (name) => {
      expect(() => assertLaneBranch(name)).toThrow(/shared branch/i);
    },
  );

  it('refuses a name that is not a lane branch', () => {
    expect(() => assertLaneBranch('preview/pr-12')).toThrow(/lane-/);
  });

  it('accepts a lane branch', () => {
    expect(() => assertLaneBranch('lane-ven-457')).not.toThrow();
  });
});

describe('ensureLaneStorage', () => {
  const at = () => ({ workdir: dir, now: () => new Date('2026-09-20T00:00:00Z') });

  it('creates a storage-only branch off dev, expiring in seven days', async () => {
    const neon = fakeNeon();

    await ensureLaneStorage('VEN-457', neon.run, at());

    expect(neon.calls.find((call) => call[0] === 'branches' && call[1] === 'create')).toEqual([
      'branches',
      'create',
      '--project-id',
      'dark-surf-79137727',
      '--name',
      'lane-ven-457',
      '--parent',
      'dev',
      '--no-compute',
      '--expires-at',
      '2026-09-27T00:00:00.000Z',
      '--no-secrets',
      '-o',
      'json',
    ]);
    expect(neon.branches.has('lane-ven-457')).toBe(true);
  });

  it('maps the branch credentials onto the STORAGE_* keys', async () => {
    const secretRow = 'STORAGE_SECRET_ACCESS_KEY';
    const env = await ensureLaneStorage('VEN-457', fakeNeon().run, at());

    expect(env).toEqual({
      STORAGE_ENDPOINT: ENDPOINT,
      STORAGE_ACCESS_KEY_ID: FIXTURE_ID,
      [secretRow]: FIXTURE_VALUE,
      STORAGE_BUCKET: 'uploads',
      STORAGE_PUBLIC_URL: `${ENDPOINT}/uploads`,
      NEXT_PUBLIC_STORAGE_PUBLIC_URL: `${ENDPOINT}/uploads`,
      STORAGE_REGION: 'us-east-2',
    });
  });

  it('is a no-op on the branch the second time', async () => {
    const neon = fakeNeon();

    await ensureLaneStorage('VEN-457', neon.run, at());
    await ensureLaneStorage('VEN-457', neon.run, at());

    const creates = neon.calls.filter((call) => call[0] === 'branches' && call[1] === 'create');
    expect(creates).toHaveLength(1);
    expect(neon.branches.size).toBe(1);
  });

  it('writes the credential file owner-only and leaves none behind', async () => {
    const neon = fakeNeon();
    let mode = 0;
    const spying: NeonRunner = async (args) => {
      if (args[0] === 'env') {
        mode = statSync(path.resolve(process.cwd(), args[args.indexOf('--file') + 1] ?? '')).mode;
      }
      return neon.run(args);
    };

    await ensureLaneStorage('VEN-457', spying, at());

    expect(mode & 0o777).toBe(0o600);
    expect(() => readFileSync(path.join(dir, '.env.lane-storage-pull'))).toThrow(/ENOENT/);
  });

  it('creates the public_read uploads bucket when the branch has none', async () => {
    const neon = fakeNeon([], []);

    await ensureLaneStorage('VEN-457', neon.run, at());

    expect(neon.calls.find((call) => call[0] === 'buckets' && call[1] === 'create')).toEqual([
      'buckets',
      'create',
      'uploads',
      '--project-id',
      'dark-surf-79137727',
      '--branch',
      'lane-ven-457',
      '--access-level',
      'public_read',
    ]);
  });

  it('leaves the bucket alone when it came across from dev', async () => {
    const neon = fakeNeon();

    await ensureLaneStorage('VEN-457', neon.run, at());

    expect(neon.calls.some((call) => call[0] === 'buckets' && call[1] === 'create')).toBe(false);
  });

  it('fails naming the branch when Neon refuses to create it', async () => {
    const neon = fakeNeon();
    const refusing: NeonRunner = async (args) =>
      args[0] === 'branches' && args[1] === 'create'
        ? failed('ERROR: branches limit exceeded')
        : neon.run(args);

    await expect(ensureLaneStorage('VEN-457', refusing, at())).rejects.toThrow(
      /lane-ven-457.*branches limit exceeded/s,
    );
  });

  it('never calls Neon for a name it refuses', async () => {
    const neon = fakeNeon();

    await expect(
      ensureLaneStorage('VEN-457', neon.run, { ...at(), branch: 'production' }),
    ).rejects.toThrow(/shared branch/i);
    expect(neon.calls).toEqual([]);
  });
});

describe('dropLaneStorage', () => {
  it('deletes the lane branch', async () => {
    const neon = fakeNeon(['lane-ven-457']);

    await dropLaneStorage('VEN-457', neon.run);

    expect(neon.branches.size).toBe(0);
    expect(neon.calls.find((call) => call[1] === 'delete')).toEqual([
      'branches',
      'delete',
      'lane-ven-457',
      '--project-id',
      'dark-surf-79137727',
    ]);
  });

  it('treats a branch that is already gone as done', async () => {
    await expect(dropLaneStorage('VEN-457', fakeNeon().run)).resolves.toBeUndefined();
  });

  it('raises any other refusal, so the manifest stays for a retry', async () => {
    const denied: NeonRunner = async () => failed('ERROR: 403 forbidden');

    await expect(dropLaneStorage('VEN-457', denied)).rejects.toThrow(/lane-ven-457.*403/s);
  });

  it('never deletes a shared branch', async () => {
    const neon = fakeNeon(['production', 'staging', 'dev']);

    for (const branch of ['production', 'staging', 'dev']) {
      await expect(dropLaneStorage('VEN-457', neon.run, branch)).rejects.toThrow(/shared branch/i);
    }

    expect(neon.calls).toEqual([]);
    expect(neon.branches.size).toBe(3);
  });
});

describe('requireNeonAccess', () => {
  const apiKeyName = 'NEON_API_KEY';
  const withKey = { [apiKeyName]: 'present' };

  it('passes when the key is set, without asking the CLI', async () => {
    const run: NeonRunner = async () => failed('must not be called');

    await expect(requireNeonAccess(run, withKey)).resolves.toBeUndefined();
  });

  it('passes when the CLI is logged in without a key', async () => {
    await expect(requireNeonAccess(async () => ok('{}'), {})).resolves.toBeUndefined();
  });

  it('names NEON_API_KEY when there is neither a key nor a login', async () => {
    await expect(requireNeonAccess(async () => failed('not authenticated'), {})).rejects.toThrow(
      /NEON_API_KEY/,
    );
  });

  it('names the CLI when it is not installed', async () => {
    const missing: NeonRunner = async () => ({ status: 'missing', stdout: '', stderr: '' });

    await expect(requireNeonAccess(missing, {})).rejects.toThrow(/neon CLI is not installed/i);
  });
});
