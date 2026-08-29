import { describe, expect, it, vi } from 'vitest';
import type { CommandOutcome } from '../exec.js';
import {
  type CommandRunner,
  createLaneDatabase,
  dropLaneDatabase,
  laneDatabaseName,
  laneDatabaseUrl,
  POSTGRES_CONTAINER,
  POSTGRES_USER,
} from './database.js';

const ok = (stdout = ''): CommandOutcome => ({ status: 'ok', stdout, stderr: '' });
const failed = (stderr: string): CommandOutcome => ({ status: 'failed', stdout: '', stderr });
const missing = (): CommandOutcome => ({ status: 'missing', stdout: '', stderr: '' });

// No userinfo component: fixtures must never be credential-shaped.
const BASE = 'postgresql://localhost:5432/vendor_marketplace';

describe('laneDatabaseName', () => {
  it('namespaces the database under the lane prefix', () => {
    expect(laneDatabaseName('42')).toBe('vendor_marketplace_lane_42');
  });

  it('reduces a ticket identifier to a safe SQL identifier', () => {
    expect(laneDatabaseName('ORL-12')).toBe('vendor_marketplace_lane_orl_12');
    expect(laneDatabaseName('feat/a.b')).toBe('vendor_marketplace_lane_feat_a_b');
  });

  it('rejects a ticket that reduces to nothing', () => {
    expect(() => laneDatabaseName('---')).toThrow(/identifier/i);
  });
});

describe('laneDatabaseUrl', () => {
  it('swaps only the database name, preserving host and port', () => {
    expect(laneDatabaseUrl(BASE, 'vendor_marketplace_lane_42')).toBe(
      'postgresql://localhost:5432/vendor_marketplace_lane_42',
    );
  });

  it('preserves query parameters', () => {
    expect(laneDatabaseUrl(`${BASE}?sslmode=disable`, 'lane_db')).toBe(
      'postgresql://localhost:5432/lane_db?sslmode=disable',
    );
  });

  it('rejects a base url that is not a postgres URI', () => {
    expect(() => laneDatabaseUrl('https://example.com/db', 'lane_db')).toThrow(/postgres/i);
  });
});

describe('createLaneDatabase', () => {
  it('creates the database inside the local container', async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(ok());
    const url = await createLaneDatabase('42', BASE, run);

    expect(run).toHaveBeenCalledWith('docker', [
      'exec',
      POSTGRES_CONTAINER,
      'createdb',
      '-U',
      POSTGRES_USER,
      'vendor_marketplace_lane_42',
    ]);
    expect(url).toBe('postgresql://localhost:5432/vendor_marketplace_lane_42');
  });

  it('never touches Neon', async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(ok());
    await createLaneDatabase('42', BASE, run);

    for (const [command, args] of run.mock.calls) {
      expect(command).not.toBe('neonctl');
      expect(args.join(' ')).not.toMatch(/neon/i);
    }
  });

  it('is idempotent when the database already exists', async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(failed('database "x" already exists'));
    await expect(createLaneDatabase('42', BASE, run)).resolves.toBe(
      'postgresql://localhost:5432/vendor_marketplace_lane_42',
    );
  });

  it('fails loudly when docker is not installed', async () => {
    await expect(createLaneDatabase('42', BASE, async () => missing())).rejects.toThrow(
      /docker is not (installed|running)/i,
    );
  });

  it('fails loudly on any other error', async () => {
    await expect(
      createLaneDatabase('42', BASE, async () => failed('connection refused')),
    ).rejects.toThrow(/connection refused/);
  });
});

describe('dropLaneDatabase', () => {
  it('drops the lane database', async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(ok());
    await dropLaneDatabase('42', run);

    expect(run).toHaveBeenCalledWith('docker', [
      'exec',
      POSTGRES_CONTAINER,
      'dropdb',
      '-U',
      POSTGRES_USER,
      '--if-exists',
      'vendor_marketplace_lane_42',
    ]);
  });

  it('is idempotent when the container is gone', async () => {
    await expect(dropLaneDatabase('42', async () => missing())).resolves.toBeUndefined();
  });

  it('rethrows a failure that is not a missing database', async () => {
    await expect(dropLaneDatabase('42', async () => failed('permission denied'))).rejects.toThrow(
      /permission denied/,
    );
  });
});
