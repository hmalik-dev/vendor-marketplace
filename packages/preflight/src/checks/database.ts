import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { CATEGORY_SEEDS, TAG_SEEDS } from '@vendor-marketplace/shared';
import { type Check, type CheckContext, type CheckResult, fail, pass } from '../types.js';

const CONNECT_TIMEOUT_SECONDS = 10;
const NEON_HOST = /\.neon\.tech$/i;
/** Branches that hold real customer data and must never back local development. */
const PROTECTED_BRANCHES = /^(production|main|master)$/i;

interface JournalEntry {
  readonly tag: string;
  readonly when: number;
}

interface Journal {
  readonly entries?: readonly JournalEntry[];
}

export function hostOf(connectionString: string | undefined): string | undefined {
  if (!connectionString) {
    return undefined;
  }

  try {
    return new URL(connectionString).hostname;
  } catch {
    return undefined;
  }
}

export interface BranchResolution {
  readonly branch?: string;
  readonly source: 'NEON_BRANCH' | '.neon' | 'none';
}

/**
 * Resolves which Neon branch `DATABASE_URL` points at.
 *
 * `NEON_BRANCH` is only a hint the operator can delete, so the local Neon CLI
 * state file is consulted next. When a Neon host is configured and neither
 * source answers, that is a failure rather than a pass — otherwise the guard
 * would be bypassed by removing one line from `.env`.
 */
export function resolveBranch(context: CheckContext): BranchResolution {
  const declared = context.env.NEON_BRANCH?.trim();

  if (declared) {
    return { branch: declared, source: 'NEON_BRANCH' };
  }

  const stateFile = path.join(context.repoRoot, '.neon');

  if (existsSync(stateFile)) {
    try {
      const state = JSON.parse(readFileSync(stateFile, 'utf8')) as { branch?: unknown };

      if (typeof state.branch === 'string' && state.branch.length > 0) {
        return { branch: state.branch, source: '.neon' };
      }
    } catch {
      // A corrupt state file resolves nothing, which the caller treats as a failure.
    }
  }

  return { source: 'none' };
}

export function evaluateBranchSafety(context: CheckContext): CheckResult {
  const name = 'Database branch is safe for this NODE_ENV';
  const host = hostOf(context.env.DATABASE_URL);
  const nodeEnv = context.env.NODE_ENV ?? 'development';

  if (!host) {
    return fail(
      'core',
      name,
      'DATABASE_URL is absent or unparseable, so the branch cannot be determined',
      'Set DATABASE_URL to a full postgresql:// connection string',
    );
  }

  if (!NEON_HOST.test(host)) {
    return pass('core', name, `${host} is not a Neon endpoint`);
  }

  const { branch, source } = resolveBranch(context);

  if (!branch) {
    return fail(
      'core',
      name,
      `DATABASE_URL points at Neon (${host}) but no branch is recorded in NEON_BRANCH or .neon`,
      'Set NEON_BRANCH in .env, or run `neon set-context --branch dev`',
    );
  }

  if (PROTECTED_BRANCHES.test(branch) && nodeEnv !== 'production') {
    return fail(
      'core',
      name,
      `NODE_ENV=${nodeEnv} but the database is the ${branch} branch (from ${source})`,
      'neon branches create --name dev && neon connection-string dev  # then repoint DATABASE_URL and set NEON_BRANCH=dev',
    );
  }

  return pass('core', name, `branch ${branch} (from ${source}), NODE_ENV=${nodeEnv}`);
}

function unreachable(name: string, reason: string): CheckResult {
  return fail('core', name, `not checked — ${reason}`, 'Fix the database connection first');
}

async function checkMigrations(sql: postgres.Sql, repoRoot: string): Promise<CheckResult> {
  const name = 'Migrations applied';
  const journalPath = path.join(repoRoot, 'packages/db/drizzle/meta/_journal.json');

  if (!existsSync(journalPath)) {
    return fail('core', name, 'packages/db/drizzle/meta/_journal.json is missing', 'pnpm install');
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
  const expected = journal.entries ?? [];

  let applied: ReadonlySet<string>;

  try {
    const rows = await sql<{ created_at: string }[]>`
      select created_at::text as created_at from drizzle.__drizzle_migrations
    `;
    applied = new Set(rows.map((row) => row.created_at));
  } catch {
    // The tracking table only exists after the first successful migration.
    applied = new Set<string>();
  }

  const pending = expected.filter((entry) => !applied.has(String(entry.when)));

  if (pending.length > 0) {
    return fail(
      'core',
      name,
      `${pending.length} pending: ${pending.map((entry) => entry.tag).join(', ')}`,
      'pnpm db:migrate',
    );
  }

  return pass('core', name, `${expected.length} applied`);
}

async function checkSeed(sql: postgres.Sql): Promise<CheckResult> {
  const name = 'Reference data seeded';

  try {
    const [categories] = await sql<
      { count: number }[]
    >`select count(*)::int as count from categories`;
    const [tags] = await sql<{ count: number }[]>`select count(*)::int as count from tags`;
    const categoryCount = categories?.count ?? 0;
    const tagCount = tags?.count ?? 0;

    if (categoryCount < CATEGORY_SEEDS.length || tagCount < TAG_SEEDS.length) {
      return fail(
        'core',
        name,
        `${categoryCount}/${CATEGORY_SEEDS.length} categories, ${tagCount}/${TAG_SEEDS.length} tags`,
        'pnpm db:seed',
      );
    }

    return pass('core', name, `${categoryCount} categories, ${tagCount} tags`);
  } catch (error: unknown) {
    return fail(
      'core',
      name,
      error instanceof Error ? error.message : 'reference tables are unreadable',
      'pnpm db:migrate && pnpm db:seed',
    );
  }
}

export const databaseCheck: Check = {
  id: 3,
  title: 'Database',
  async run(context) {
    const safety = evaluateBranchSafety(context);
    const reachability = 'Database reachable';
    const connectionString = context.env.DATABASE_URL;

    if (!connectionString) {
      return [
        safety,
        unreachable(reachability, 'DATABASE_URL is not set'),
        unreachable('Migrations applied', 'DATABASE_URL is not set'),
        unreachable('Reference data seeded', 'DATABASE_URL is not set'),
      ];
    }

    const sql = postgres(connectionString, {
      max: 1,
      connect_timeout: CONNECT_TIMEOUT_SECONDS,
      onnotice: () => {},
    });

    try {
      await sql`select 1`;
    } catch (error: unknown) {
      await sql.end({ timeout: 5 }).catch(() => undefined);
      const reason = error instanceof Error ? error.message : 'connection refused';

      return [
        safety,
        fail(
          'core',
          reachability,
          reason,
          'Check DATABASE_URL, or run `neon branches create --name dev` and repoint it',
        ),
        unreachable('Migrations applied', 'the database is unreachable'),
        unreachable('Reference data seeded', 'the database is unreachable'),
      ];
    }

    try {
      return [
        safety,
        pass('core', reachability, hostOf(connectionString) ?? 'connected'),
        await checkMigrations(sql, context.repoRoot),
        await checkSeed(sql),
      ];
    } finally {
      await sql.end({ timeout: 5 }).catch(() => undefined);
    }
  },
};
