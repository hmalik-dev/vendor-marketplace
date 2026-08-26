import {
  BASELINE_CAPABILITIES,
  type Capability,
  capabilitiesForTicket,
} from '@vendorhub/shared/env';
import type { Target } from './types.js';

export interface ParsedArgs {
  readonly ticket?: number;
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

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let ticket: number | undefined;
  let target: Target = 'local';
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--help':
      case '-h':
        help = true;
        break;

      case '--ticket': {
        const value = argv[index + 1];
        index += 1;

        if (!value || !/^\d+$/.test(value)) {
          throw new ArgumentError('--ticket needs a ticket number, e.g. `--ticket 9`.');
        }

        ticket = Number.parseInt(value, 10);
        break;
      }

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

  return ticket === undefined ? { target, help } : { ticket, target, help };
}

/**
 * Capabilities a run checks. Without a ticket that is the baseline only, so a
 * bare `pnpm preflight` never demands credentials for work nobody is doing.
 */
export function resolveCapabilities(args: ParsedArgs): readonly Capability[] {
  return args.ticket === undefined ? BASELINE_CAPABILITIES : capabilitiesForTicket(args.ticket);
}

export const USAGE = `Usage: pnpm preflight [--ticket <n>] [--env local|production]

  --ticket <n>   Check only the capabilities ticket #n declares.
                 Without it, only the baseline (${BASELINE_CAPABILITIES.join(', ')}) is checked.
  --env <target> Value set to check. Defaults to local; production reads
                 .env.production.local and applies the stricter shapes.
  --help         Show this message.

Exits 0 when every check passes, 1 otherwise.`;
