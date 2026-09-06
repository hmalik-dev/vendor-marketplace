import type postgres from 'postgres';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CheckContext } from '../types.js';
import { CATEGORY_SEEDS, TAG_SEEDS } from '@vendor-marketplace/shared';
import {
  evaluateBranchSafety,
  hostOf,
  resolveBranch,
  checkDemoData,
  checkSeed,
} from './database.js';

const NEON_URL =
  'postgresql://owner:secret@ep-lucky-cherry-1234-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const LOCAL_URL =
  'postgresql://vendor_marketplace:vendor_marketplace_dev@localhost:5432/vendor_marketplace';

function contextWith(
  env: NodeJS.ProcessEnv,
  repoRoot = mkdtempSync(path.join(os.tmpdir(), 'pf-')),
): CheckContext {
  return {
    repoRoot,
    env,
    envFileFound: true,
    capabilities: new Set(['core']),
    target: 'local',
  };
}

describe('hostOf', () => {
  it('extracts the host from a connection string', () => {
    expect(hostOf(NEON_URL)).toBe('ep-lucky-cherry-1234-pooler.c-4.us-east-2.aws.neon.tech');
  });

  it('returns undefined for an absent or unparseable value', () => {
    expect(hostOf(undefined)).toBeUndefined();
    expect(hostOf('not a url')).toBeUndefined();
  });
});

describe('resolveBranch', () => {
  it('prefers NEON_BRANCH', () => {
    expect(resolveBranch(contextWith({ NEON_BRANCH: 'dev' }))).toEqual({
      branch: 'dev',
      source: 'NEON_BRANCH',
    });
  });

  it('falls back to the Neon CLI state file when the variable is deleted', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    writeFileSync(path.join(repoRoot, '.neon'), JSON.stringify({ branch: 'production' }));

    expect(resolveBranch(contextWith({}, repoRoot))).toEqual({
      branch: 'production',
      source: '.neon',
    });
  });

  it('resolves nothing when neither source answers', () => {
    expect(resolveBranch(contextWith({}))).toEqual({ source: 'none' });
  });

  it('resolves nothing from a corrupt state file rather than throwing', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    writeFileSync(path.join(repoRoot, '.neon'), 'not json');

    expect(resolveBranch(contextWith({}, repoRoot))).toEqual({ source: 'none' });
  });
});

describe('evaluateBranchSafety', () => {
  it('fails when development points at the production branch', () => {
    const result = evaluateBranchSafety(
      contextWith({ DATABASE_URL: NEON_URL, NEON_BRANCH: 'production', NODE_ENV: 'development' }),
    );

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('production branch');
    expect(result.fix).toContain('neon branches create --name dev');
  });

  it('fails on `main` too, not just the literal name production', () => {
    const result = evaluateBranchSafety(
      contextWith({ DATABASE_URL: NEON_URL, NEON_BRANCH: 'main', NODE_ENV: 'development' }),
    );

    expect(result.ok).toBe(false);
  });

  it('passes on a dev branch', () => {
    const result = evaluateBranchSafety(
      contextWith({ DATABASE_URL: NEON_URL, NEON_BRANCH: 'dev', NODE_ENV: 'development' }),
    );

    expect(result.ok).toBe(true);
  });

  it('allows the production branch when NODE_ENV really is production', () => {
    const result = evaluateBranchSafety(
      contextWith({ DATABASE_URL: NEON_URL, NEON_BRANCH: 'production', NODE_ENV: 'production' }),
    );

    expect(result.ok).toBe(true);
  });

  it('cannot be bypassed by deleting NEON_BRANCH', () => {
    // The guard resolves from the connection string and the Neon state file, so
    // removing one line from .env fails the check instead of skipping it.
    const result = evaluateBranchSafety(contextWith({ DATABASE_URL: NEON_URL }));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('no branch is recorded');
  });

  it('still catches production when only the state file names it', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    writeFileSync(path.join(repoRoot, '.neon'), JSON.stringify({ branch: 'production' }));

    const result = evaluateBranchSafety(contextWith({ DATABASE_URL: NEON_URL }, repoRoot));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('from .neon');
  });

  it('does not police a non-Neon connection', () => {
    const result = evaluateBranchSafety(contextWith({ DATABASE_URL: LOCAL_URL }));

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('not a Neon endpoint');
  });

  it('fails when DATABASE_URL is absent entirely', () => {
    expect(evaluateBranchSafety(contextWith({})).ok).toBe(false);
  });
});

describe('checkSeed', () => {
  /*
   * Three counts in one check, and the third is the one that needed adding.
   * `us_cities` (#384) is the only reference table whose absence is silent: an
   * unseeded one leaves the City field answering "No US city matches" to every
   * word a customer types, which reads as their typo rather than as a database
   * nobody seeded.
   */
  const counts = (categories: number, tags: number, cities: number): postgres.Sql => {
    const answers = [[{ count: categories }], [{ count: tags }], [{ count: cities }]];
    let at = 0;
    return (() => Promise.resolve(answers[at++] ?? [])) as unknown as postgres.Sql;
  };

  it('passes when all three reference tables are populated', async () => {
    const result = await checkSeed(counts(CATEGORY_SEEDS.length, TAG_SEEDS.length, 35_618));

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('35,618 US cities');
  });

  it('fails when the places table is empty even though the taxonomy is seeded', async () => {
    const result = await checkSeed(counts(CATEGORY_SEEDS.length, TAG_SEEDS.length, 0));

    expect(result.ok).toBe(false);
    expect(result.fix).toBe('pnpm db:seed');
    expect(result.detail).toContain('0 US cities');
  });

  it('fails on a half-inserted places table rather than passing on a truncated seed', async () => {
    const result = await checkSeed(counts(CATEGORY_SEEDS.length, TAG_SEEDS.length, 5_000));

    expect(result.ok).toBe(false);
  });

  it('still fails on a missing taxonomy, with the places count alongside it', async () => {
    const result = await checkSeed(counts(0, 0, 35_618));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('0 categories');
  });

  it('fails rather than throwing when a reference table is unreadable', async () => {
    const sql = (() =>
      Promise.reject(new Error('relation "us_cities" does not exist'))) as unknown as postgres.Sql;

    const result = await checkSeed(sql);

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('us_cities');
  });
});

describe('checkDemoData', () => {
  // A `docker compose` recreate wipes the local database. Reference data is
  // reseeded by `db:migrate`, so the existing seed check still passes and an
  // unattended browser run keeps going against an empty marketplace. This is
  // the guard that stops it.
  const sqlReturning = (rows: unknown) => (() => Promise.resolve(rows)) as unknown as postgres.Sql;

  it('passes when vendor profiles exist', async () => {
    const result = await checkDemoData(sqlReturning([{ count: 16 }]));
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('16');
  });

  it('fails on an empty vendor table and names the seed command', async () => {
    const result = await checkDemoData(sqlReturning([{ count: 0 }]));
    expect(result.ok).toBe(false);
    expect(result.fix).toBe('pnpm db:seed:marketing');
    expect(result.detail).toContain('empty marketplace');
  });

  it('fails rather than throwing when the table is unreadable', async () => {
    const sql = (() =>
      Promise.reject(new Error('relation does not exist'))) as unknown as postgres.Sql;
    const result = await checkDemoData(sql);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('relation does not exist');
  });
});
