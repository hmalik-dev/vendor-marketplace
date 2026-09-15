import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const NEON_HOST = /\.neon\.tech$/i;
/** Branches that hold real data. Fabricated rows must never reach one. */
const PROTECTED_BRANCHES = /^(production|main|master)$/i;
/** `prod` or `production` as a whole word of a host or database name — not `products`. */
const PRODUCTION_NAMED = /(^|[^a-z])prod(uction)?([^a-z]|$)/i;

export interface SafeTargetOptions {
  /** The verb the refusal uses. */
  action?: 'seed' | 'restore';
  /** The variable holding the target connection string. */
  connectionVariable?: string;
  /**
   * The variable declaring that target's Neon branch. `.neon` is consulted only
   * for `NEON_BRANCH`, because it records the branch behind `DATABASE_URL` and
   * says nothing about any other connection string.
   */
  branchVariable?: string;
}

/**
 * Resolves the Neon branch behind `DATABASE_URL`.
 *
 * This repeats a little of `packages/preflight/src/checks/database.ts` on
 * purpose: `packages/db` sits upstream of `packages/preflight`, and importing
 * downstream would invert the one-way `apps → packages` dependency the repo
 * holds to. Fifteen duplicated lines are cheaper than that inversion.
 */
function resolveBranch(
  repoRoot: string,
  branchVariable: string,
): { branch?: string; source: string } {
  const declared = process.env[branchVariable]?.trim();
  if (declared) {
    return { branch: declared, source: branchVariable };
  }

  if (branchVariable !== 'NEON_BRANCH') {
    return { source: 'none' };
  }

  const stateFile = path.join(repoRoot, '.neon');
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
 * The restore drill uses it too: it must never overwrite anything that could be
 * production, and it passes its own target and branch variables to say so.
 *
 * @param what names the data in the refusal, so the message says what was stopped.
 * @param repoRoot where `.neon` is looked for. Injectable so the suite can point
 * at an empty directory: `.worktreeinclude` copies `.neon` into every worktree,
 * so a test that depended on the real root would pass or fail by accident.
 */
export function assertSafeTarget(
  what: string,
  repoRoot: string = REPO_ROOT,
  options: SafeTargetOptions = {},
): void {
  const {
    action = 'seed',
    connectionVariable = 'DATABASE_URL',
    branchVariable = 'NEON_BRANCH',
  } = options;
  const connectionString = process.env[connectionVariable];

  if (!connectionString) {
    throw new Error(`${connectionVariable} is not set. Run \`pnpm preflight\` for the fix.`);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Refusing to ${action} ${what} with NODE_ENV=production.`);
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`${connectionVariable} is not a parseable connection string.`);
  }
  const host = url.hostname;

  if (PRODUCTION_NAMED.test(host) || PRODUCTION_NAMED.test(url.pathname.slice(1))) {
    throw new Error(`Refusing to ${action} ${what} into a production-named database.`);
  }

  if (!NEON_HOST.test(host)) {
    return;
  }

  const { branch, source } = resolveBranch(repoRoot, branchVariable);

  if (!branch) {
    throw new Error(
      `${connectionVariable} points at Neon (${host}) but no branch is recorded in ${branchVariable}${branchVariable === 'NEON_BRANCH' ? ' or .neon' : ''}. ` +
        `Refusing to ${action} ${what} into an unidentified branch.`,
    );
  }

  if (PROTECTED_BRANCHES.test(branch)) {
    throw new Error(
      `Refusing to ${action} ${what} into the ${branch} branch (from ${source}). ` +
        `Point ${connectionVariable} at a development branch first.`,
    );
  }
}
