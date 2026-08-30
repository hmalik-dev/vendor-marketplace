import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const NEON_HOST = /\.neon\.tech$/i;
/** Branches that hold real data. Fabricated rows must never reach one. */
const PROTECTED_BRANCHES = /^(production|main|master)$/i;

/**
 * Resolves the Neon branch behind `DATABASE_URL`.
 *
 * This repeats a little of `packages/preflight/src/checks/database.ts` on
 * purpose: `packages/db` sits upstream of `packages/preflight`, and importing
 * downstream would invert the one-way `apps → packages` dependency the repo
 * holds to. Fifteen duplicated lines are cheaper than that inversion.
 */
function resolveBranch(): { branch?: string; source: string } {
  const declared = process.env.NEON_BRANCH?.trim();
  if (declared) {
    return { branch: declared, source: 'NEON_BRANCH' };
  }

  const stateFile = path.join(REPO_ROOT, '.neon');
  if (existsSync(stateFile)) {
    try {
      const state = JSON.parse(readFileSync(stateFile, 'utf8')) as { branch?: unknown };
      if (typeof state.branch === 'string' && state.branch.length > 0) {
        return { branch: state.branch, source: '.neon' };
      }
    } catch {
      // A corrupt state file resolves nothing, which is treated as unknown.
    }
  }

  return { source: 'none' };
}

/**
 * Refuses to run anywhere the data could be mistaken for real.
 *
 * Deliberately stricter than the preflight branch check, which permits the
 * production branch when `NODE_ENV=production`. No seed that fabricates rows
 * belongs in the production database under any circumstance, so this guard has
 * no such escape hatch.
 *
 * Shared by every fabricating seed. It was written for the marketing seed and
 * lifted out when the end-to-end fixture needed exactly the same protection —
 * more so, in fact, since that one also grants a role and marks a vendor able
 * to take payment.
 *
 * @param what names the data in the refusal, so the message says what was stopped.
 */
export function assertSafeTarget(what: string): void {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Run `pnpm preflight` for the fix.');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Refusing to seed ${what} with NODE_ENV=production.`);
  }

  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a parseable connection string.');
  }

  if (!NEON_HOST.test(host)) {
    return;
  }

  const { branch, source } = resolveBranch();

  if (!branch) {
    throw new Error(
      `DATABASE_URL points at Neon (${host}) but no branch is recorded in NEON_BRANCH or .neon. ` +
        `Refusing to seed ${what} into an unidentified branch.`,
    );
  }

  if (PROTECTED_BRANCHES.test(branch)) {
    throw new Error(
      `Refusing to seed ${what} into the ${branch} branch (from ${source}). ` +
        'Point DATABASE_URL at a development branch first.',
    );
  }
}
