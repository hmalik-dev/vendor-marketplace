import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { requiredNodeMajor } from './toolchain.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function read(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), 'utf8');
}

const ENGINE_RANGE = (JSON.parse(read('package.json')) as { engines?: { node?: string } }).engines
  ?.node;

describe('requiredNodeMajor', () => {
  it('reads the major out of a caret-free range', () => {
    expect(requiredNodeMajor('>=22.22.2')).toBe(22);
  });

  it('falls back rather than accepting every version when the range is unreadable', () => {
    expect(requiredNodeMajor('latest')).toBe(22);
    expect(requiredNodeMajor(undefined)).toBe(22);
  });
});

/*
 * CI ran Node 20 against `jsdom@30` (floor ^22.22.2) for the whole life of the
 * project: every `pnpm test` job died in the worker pool with
 * `webidl.util.markAsUncloneable is not a function` before a single web test
 * ran. Four files declared a Node version and no two agreed. `engines.node` is
 * now the only one that decides; these assertions fail if another drifts under
 * it again.
 */
describe('the repository agrees on one Node floor', () => {
  const floor = requiredNodeMajor(ENGINE_RANGE);

  it('declares an engines range at all', () => {
    expect(ENGINE_RANGE).toMatch(/^>=\d+\.\d+\.\d+$/);
    expect(floor).toBeGreaterThanOrEqual(22);
  });

  it('pins .nvmrc at or above the floor', () => {
    const nvmrc = Number.parseInt(read('.nvmrc').trim(), 10);

    expect(Number.isNaN(nvmrc)).toBe(false);
    expect(nvmrc).toBeGreaterThanOrEqual(floor);
  });

  it('has CI take its Node version from .nvmrc rather than a second literal', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow).toContain('node-version-file: .nvmrc');
    expect(workflow).not.toMatch(/^\s*node-version:/m);
  });

  it('builds the API image on a Node major at or above the floor', () => {
    const dockerfile = read('apps/api/Dockerfile');
    const declared = /^ARG NODE_VERSION=(\d+)/m.exec(dockerfile)?.[1];

    expect(declared).toBeDefined();
    expect(Number.parseInt(declared ?? '', 10)).toBeGreaterThanOrEqual(floor);
  });
});

/*
 * The compose Postgres sat at 16 while Neon ran 18 for the life of the project.
 * That gap is invisible locally and only surfaces as a production-only failure,
 * because local never exercises the newer engine. Ticket #200 closed it; these
 * assertions fail if either side drifts again.
 *
 * The mount assertion is not hypothetical: Postgres 18+ images store data in a
 * major-version subdirectory and abort startup when the volume is mounted at
 * `/var/lib/postgresql/data`, which is exactly how the service was configured
 * for 16. See docker-library/postgres#1259.
 */
describe('the local Postgres tracks the hosted major', () => {
  const NEON_POSTGRES_MAJOR = 18;
  const compose = read('docker-compose.yml');

  it('pins the compose service to the Postgres major Neon runs', () => {
    const declared = /image: postgres:(\d+)-alpine/.exec(compose)?.[1];

    expect(declared).toBeDefined();
    expect(Number.parseInt(declared ?? '', 10)).toBe(NEON_POSTGRES_MAJOR);
  });

  it('mounts the data volume where an 18+ image expects it', () => {
    expect(compose).toContain('vendor-marketplace-pgdata:/var/lib/postgresql\n');
    expect(compose).not.toContain('vendor-marketplace-pgdata:/var/lib/postgresql/data');
  });
});
