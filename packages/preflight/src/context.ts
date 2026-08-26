import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import type { Capability } from '@vendorhub/shared/env';
import type { CheckContext, Target } from './types.js';

/** `packages/preflight/src` → repository root. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** The file each target reads its values from, relative to the repository root. */
export const ENV_FILES: Readonly<Record<Target, string>> = {
  local: '.env',
  production: '.env.production.local',
};

export interface ContextOptions {
  readonly capabilities: readonly Capability[];
  readonly target: Target;
  readonly repoRoot?: string;
  /** Overridable for tests; defaults to the real process environment. */
  readonly processEnv?: NodeJS.ProcessEnv;
}

/**
 * Builds the merged view the apps themselves see: values from the env file,
 * with real process environment variables winning. `dotenv` never overwrites an
 * already-set variable, so preflight must not either — otherwise it would
 * disagree with the very processes it is gating.
 */
export function loadContext(options: ContextOptions): CheckContext {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const processEnv = options.processEnv ?? process.env;
  const envFile = path.join(repoRoot, ENV_FILES[options.target]);
  const envFileFound = existsSync(envFile);

  const fileValues = envFileFound ? parse(readFileSync(envFile, 'utf8')) : {};
  const env: NodeJS.ProcessEnv = { ...fileValues, ...processEnv };

  return {
    repoRoot,
    env,
    envFileFound,
    capabilities: new Set(options.capabilities),
    target: options.target,
  };
}
