import { CAPABILITIES, CAPABILITY_LABELS, variablesFor } from './capabilities.js';
import { PLATFORM_ENV_KEYS } from './deployment.js';
import { ENV_REGISTRY, exampleValue } from './registry.js';

const HEADER = `# ---------------------------------------------------------------------------
# Vendor Marketplace environment variables.
#
# GENERATED FROM packages/shared/src/env/registry.ts — DO NOT EDIT BY HAND.
# Add or change a variable there, then run \`pnpm env:example\`.
#
# Copy to \`.env\` and fill in real values. Never commit \`.env\`.
# The end-to-end test account lives in \`.env.e2e.local\`, not here.
# ---------------------------------------------------------------------------`;

const RULE_WIDTH = 77;

function sectionRule(label: string): string {
  const prefix = `# --- ${label} `;
  return prefix.padEnd(Math.max(prefix.length, RULE_WIDTH), '-');
}

/**
 * Renders `.env.example` from the registry: one section per capability, each
 * variable preceded by its description, in registry order.
 */
export function renderEnvExample(): string {
  const sections: string[] = [];

  for (const capability of CAPABILITIES) {
    const variables = variablesFor(capability);

    if (variables.length === 0) {
      continue;
    }

    const lines = [sectionRule(CAPABILITY_LABELS[capability])];

    for (const variable of variables) {
      lines.push(`# ${variable.description}`, `${variable.key}=${exampleValue(variable)}`);
    }

    sections.push(lines.join('\n'));
  }

  return `${[HEADER, ...sections].join('\n\n')}\n`;
}

/**
 * Keys Turborepo must pass through to task processes.
 *
 * `NODE_ENV` is deliberately excluded: it sits in `globalEnv`, where a change
 * busts the task cache, which is the correct behaviour for a value that changes
 * what the build produces.
 */
/**
 * Keys that change what a build *produces*, so they belong in turbo's
 * `globalEnv` (hashed) rather than `globalPassThroughEnv` (visible, unhashed).
 * `CSP_ENFORCE` joined in #396: `next.config.ts` bakes the enforce-or-report
 * choice into the routes manifest at build time, and a pass-through key left
 * the hash identical for `0` and `1` — so `CSP_ENFORCE=1 pnpm build` replayed
 * a cached report-only build and a browser pass against it could not fail.
 */
/**
 * The platform markers are here, hashed, and **not** in the pass-through list.
 *
 * `globalPassThroughEnv` reaches a task without entering its cache key, so a
 * `web#build` on a laptop and one on Vercel would hash identically — and with
 * remote caching on, the platform could restore the laptop's artefact, with
 * `http://localhost:4000` already inlined, without ever running the deployed
 * branch of `assertWebEnv`. The gate has to be part of what the hash describes,
 * because it changes what the build produces.
 */
export const TURBO_GLOBAL_ENV_KEYS: readonly string[] = [
  'NODE_ENV',
  'CSP_ENFORCE',
  ...PLATFORM_ENV_KEYS,
];

/**
 * Every registry key that is not already hashed in `globalEnv`.
 *
 * The platform markers `deployment.ts` reads are deliberately absent: they
 * belong in `TURBO_GLOBAL_ENV_KEYS`, which both reaches the task under strict
 * env mode *and* enters the cache key. A stripped `VERCEL` would leave
 * `next build` believing it was on a laptop; an unhashed one would let a
 * laptop's cached artefact be replayed on the platform. Both restore the
 * localhost defaults this gate exists to refuse.
 */
export function passThroughKeys(): string[] {
  return ENV_REGISTRY.map((variable) => variable.key)
    .filter((key) => !TURBO_GLOBAL_ENV_KEYS.includes(key))
    .sort((left, right) => left.localeCompare(right, 'en'));
}

const PASS_THROUGH_BLOCK = /^ {2}"globalPassThroughEnv": \[\n(?: {4}.*\n)* {2}\],$/m;

/**
 * Rewrites only the `globalPassThroughEnv` array inside `turbo.json`, leaving
 * every other byte alone. Re-serialising the whole document would fight
 * Prettier over how short arrays wrap, and the drift test compares text.
 */
export function renderTurboJson(current: string): string {
  if (!PASS_THROUGH_BLOCK.test(current)) {
    throw new Error(
      'turbo.json has no "globalPassThroughEnv" array formatted as expected; run `pnpm format` and try again.',
    );
  }

  const entries = passThroughKeys()
    .map((key) => `    ${JSON.stringify(key)}`)
    .join(',\n');

  return current.replace(PASS_THROUGH_BLOCK, `  "globalPassThroughEnv": [\n${entries}\n  ],`);
}
