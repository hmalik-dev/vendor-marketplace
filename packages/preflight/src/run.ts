import type { Capability } from '@vendorhub/shared/env';
import { CHECKS } from './checks/index.js';
import { loadContext } from './context.js';
import type { CheckResult, Target } from './types.js';

export interface RunOptions {
  readonly capabilities: readonly Capability[];
  readonly target: Target;
  readonly repoRoot?: string;
  readonly processEnv?: NodeJS.ProcessEnv;
}

/**
 * Runs every check and returns all results. A check that throws becomes a
 * failing result rather than aborting the run, so one broken probe cannot hide
 * the other nine checks' findings.
 */
export async function runChecks(options: RunOptions): Promise<CheckResult[]> {
  const context = loadContext(options);
  const results: CheckResult[] = [];

  for (const check of CHECKS) {
    try {
      results.push(...(await check.run(context)));
    } catch (error: unknown) {
      results.push({
        ok: false,
        capability: 'core',
        name: check.title,
        detail: error instanceof Error ? error.message : 'the check itself failed',
        fix: 'Report this as a preflight bug',
      });
    }
  }

  return results;
}
