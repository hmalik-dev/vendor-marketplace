import {
  BASELINE_CAPABILITIES,
  CAPABILITIES,
  type Capability,
  isCapability,
} from '@vendor-marketplace/shared/env';
import type { Target } from './types.js';

export interface ParsedArgs {
  readonly capabilities: readonly Capability[];
  readonly target: Target;
  readonly help: boolean;
}

export class ArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgumentError';
  }
}

const TARGETS: readonly Target[] = ['local', 'production'];

function isTarget(value: string): value is Target {
  return (TARGETS as readonly string[]).includes(value);
}

/**
 * Parses a comma-separated capability list. The ticket's `cap:<name>` labels in
 * Linear are the source; the caller copies them here without the prefix.
 */
function parseCapabilities(value: string | undefined): readonly Capability[] {
  if (!value || value.startsWith('--')) {
    throw new ArgumentError(
      '--capabilities needs a comma-separated list, e.g. `--capabilities auth,stripe`.',
    );
  }

  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const known = names.filter(isCapability);
  const unknown = names.filter((name) => !isCapability(name));

  if (names.length === 0 || unknown.length > 0) {
    throw new ArgumentError(
      `--capabilities accepts only ${CAPABILITIES.join(', ')}` +
        (unknown.length > 0 ? `; got ${unknown.join(', ')}.` : '.'),
    );
  }

  return known;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const requested = new Set<Capability>();
  let target: Target = 'local';
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--help':
      case '-h':
        help = true;
        break;

      case '--capabilities': {
        for (const capability of parseCapabilities(argv[index + 1])) {
          requested.add(capability);
        }
        index += 1;
        break;
      }

      case '--all':
        for (const capability of CAPABILITIES) {
          requested.add(capability);
        }
        break;

      case '--env': {
        const value = argv[index + 1];
        index += 1;

        if (!value || !isTarget(value)) {
          throw new ArgumentError(`--env must be one of: ${TARGETS.join(', ')}.`);
        }

        target = value;
        break;
      }

      default:
        throw new ArgumentError(`Unknown argument \`${String(argument)}\`. Try --help.`);
    }
  }

  return { capabilities: resolveCapabilities(requested), target, help };
}

/**
 * The baseline plus whatever was asked for, in registry order, so a bare
 * `pnpm preflight` never demands credentials for work nobody is doing and no
 * run ever checks less than the baseline.
 */
function resolveCapabilities(requested: ReadonlySet<Capability>): readonly Capability[] {
  const wanted = new Set<Capability>([...BASELINE_CAPABILITIES, ...requested]);
  return CAPABILITIES.filter((capability) => wanted.has(capability));
}

export const USAGE = `Usage: pnpm preflight [--capabilities <a,b>] [--all] [--env local|production]

  --capabilities <a,b>  Also check these capabilities — the ticket's \`cap:*\`
                        labels in Linear, without the prefix. One of:
                        ${CAPABILITIES.join(', ')}.
                        Without it, only the baseline (${BASELINE_CAPABILITIES.join(', ')}) is checked.
  --all                 Check every capability.
  --env <target>        Value set to check. Defaults to local; production reads
                        .env.production.local and applies the stricter shapes.
  --help                Show this message.

Exits 0 when every check passes, 1 otherwise.`;
