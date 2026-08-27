import { CAPABILITIES, type Capability } from './capabilities.js';

/**
 * Capabilities each ticket declares, mirroring the Capabilities column of the
 * status board in `~/.claude/plans/vendor-marketplace-tickets.md`.
 *
 * `core` and `e2e` are implicit on every ticket — every ticket touches the app
 * and every ticket is browser-verified — so they are omitted here and added by
 * `capabilitiesForTicket`.
 *
 * Lettered splits share their parent's number: `#6a`/`#6b`/`#6c` are all
 * `--ticket 6`, `#7a`/`#7b` are `--ticket 7`, `#22a`/`#22b` are `--ticket 22`.
 * A split never changes which external services the work needs, so a second
 * entry would only be a second thing to keep in sync.
 */
export const TICKET_CAPABILITIES: Readonly<Record<number, readonly Capability[]>> = {
  0: [],
  1: [],
  2: ['auth'],
  3: ['auth', 'storage'],
  4: ['auth', 'storage'],
  5: ['auth'],
  6: ['auth', 'storage'],
  7: ['auth'],
  8: ['auth'],
  9: ['auth', 'stripe'],
  10: ['auth', 'stripe'],
  11: ['auth', 'email'],
  12: ['auth'],
  13: ['auth'],
  14: [...CAPABILITIES],
  15: ['auth', 'sentry'],
  16: ['auth', 'storage'],
  17: [],
  18: [],
  19: [...CAPABILITIES],
  20: [],
  21: ['auth'],
  22: ['auth'],
  23: ['auth', 'storage'],
  24: ['auth'],
};

/** Capabilities checked when preflight runs without a `--ticket`. */
export const BASELINE_CAPABILITIES: readonly Capability[] = ['core', 'e2e'];

export class UnknownTicketError extends Error {
  constructor(readonly ticket: number) {
    super(
      `Unknown ticket #${ticket}. Known tickets: ${Object.keys(TICKET_CAPABILITIES).join(', ')}.`,
    );
    this.name = 'UnknownTicketError';
  }
}

/**
 * Resolves a ticket number to the capabilities preflight must check.
 *
 * Throws on an unknown number rather than checking nothing: a gate that
 * silently passes because it recognised no work is worse than no gate at all.
 */
export function capabilitiesForTicket(ticket: number): readonly Capability[] {
  const declared = TICKET_CAPABILITIES[ticket];

  if (!declared) {
    throw new UnknownTicketError(ticket);
  }

  const resolved = new Set<Capability>([...BASELINE_CAPABILITIES, ...declared]);
  return CAPABILITIES.filter((capability) => resolved.has(capability));
}
