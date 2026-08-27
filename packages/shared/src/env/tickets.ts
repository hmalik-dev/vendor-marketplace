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
 * `--ticket 6` and `#22a`/`#22b` are `--ticket 22`. `#7a`/`#7b` were merged
 * back into a single `#7` on 2026-08-27, which is why that row never changed.
 * A split never changes which external services the work needs, so a second
 * entry would only be a second thing to keep in sync.
 *
 * Rows marked RETIRED are ticket numbers that were merged into another ticket
 * and no longer appear on the status board. They keep their rows on purpose:
 * the contiguity test is what catches a live board ticket with no registry row,
 * and `--ticket <old number>` still gates correctly for anyone working from a
 * commit message or branch that predates the merge. They are labelled so nobody
 * mistakes one for outstanding work.
 */
export const TICKET_CAPABILITIES: Readonly<Record<number, readonly Capability[]>> = {
  0: [],
  1: [],
  2: ['auth'],
  3: ['auth', 'storage'],
  4: ['auth', 'storage'],
  5: ['auth'], // RETIRED — merged into #4 (Vendor Service Setup)
  6: ['auth', 'storage'],
  7: ['auth'],
  8: ['auth'],
  9: ['auth', 'stripe'],
  10: ['auth', 'stripe'],
  11: ['auth', 'email'],
  12: ['auth'],
  13: ['auth'], // RETIRED — merged into #8 (Messaging + Notification Center)
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
  25: ['auth'],
  // #26 gained `auth` when the Clerk pin (old #27) merged into it on 2026-08-27:
  // the responsive-header half needs no external service, the Clerk half does.
  26: ['auth'],
  27: ['auth'], // RETIRED — merged into #26 (Chrome Parity)
  28: [],
  29: ['auth', 'storage'],
  30: [],
  31: ['auth'],
  // #32 touches no external service: it decides whether the demo cover files
  // are tracked in the repo or pushed to the bucket, and only the second half
  // would need `storage`. Declared bare so the ticket is never gated on keys it
  // may not end up using.
  32: [],
  33: [],
  // #34 carries `storage` because deciding the upload path — presigned direct-to-R2
  // versus a smaller body cap — is half its scope.
  34: ['storage'],
  35: [],
  // Frames `01` and `18`, revised 2026-08-27. Both are web-tier parity work on
  // imagery and a control shape; neither reaches an external service.
  36: [],
  37: [],
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
