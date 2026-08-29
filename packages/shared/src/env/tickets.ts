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
  38: [],
  39: [],
  40: [],
  41: [],
  42: [],
  43: [],
  44: [],
  45: [],
  46: ['auth'],
  47: ['storage'],
  48: [],
  49: ['auth'],
  50: [],
  51: ['storage'],
  52: [],
  53: ['storage'],
  54: [],
  55: ['auth'],
  56: [],
  57: [],
  58: [],
  59: [],
  60: ['storage'],
  // #61 hardens the key-shape checks themselves, so it needs a real Clerk key
  // and a real Stripe key present to assert the live-key refusal fires.
  61: ['auth', 'stripe'],
  62: ['stripe'],
  63: [],
  64: [],
  65: [],
  66: [],
  // #67 is a database constraint plus a route dedupe — no Stripe call — but the
  // flow it fixes is only reachable signed in, so it carries `auth` and not `stripe`.
  67: ['auth'],
  // #68 reaches checkout, so unlike #67 it does need Stripe credentials.
  68: ['auth', 'stripe'],
  69: [],
  70: [],
  71: [],
  72: [],
  73: [],
  74: [],
  75: [],
  76: ['auth'],
  77: [],
  78: [],
  79: [],
  80: [],
  81: [],
  82: [],
  83: [],
  84: [],
  85: [],
  86: [],
  87: [],
  88: [],
  89: [],
  90: [],
  91: [],
  92: [],
  93: [],
  94: [],
  95: [],
  96: [],
  97: [],
  98: [],
  99: [],
  100: [],
  101: [],
  102: [],
  103: [],
  104: [],
  105: [],
  106: [],
  107: [],
  108: [],
  109: [],
  110: [],
  111: [],
  112: [],
  113: [],
  114: [],
  115: [],
  116: [],
  117: [],
  118: [],
  119: [],
  120: [],
  121: [],
  122: [],
  123: [],
  124: [],
  125: [],
  126: [],
  127: [],
  128: [],
  129: [],
  130: [],
  131: [],
  132: [],
  133: [],
  134: [],
  135: [],
  136: [],
  137: [],
  138: [],
  139: [],
  140: [],
  141: [],
  142: [],
  143: [],
  144: [],
  145: [],
  146: [],
  147: [],
  148: [],
  149: [],
  150: [],
  151: [],
  152: [],
  153: [],
  154: [],
  155: [],
  156: [],
  157: [],
  158: [],
  159: [],
  160: [],
  161: [],
  162: [],
  163: [],
  164: [],
  165: [],
  166: [],
  167: [],
  168: [],
  169: [],
  // #170-#185 are the upload/imagery batch from the 2026-08-28 sweep; every one
  // of them reads or writes objects, so the whole run needs `storage`.
  170: ['storage'],
  171: ['storage'],
  172: ['storage'],
  173: ['storage'],
  174: ['storage'],
  175: ['storage'],
  176: ['storage'],
  177: ['storage'],
  178: ['storage'],
  179: ['storage'],
  180: ['storage'],
  181: ['storage'],
  182: ['storage'],
  183: ['storage'],
  184: ['storage'],
  185: ['storage'],
  186: [],
  187: [],
  188: [],
  189: [],
  190: [],
  191: [],
  192: [],
  193: [],
  194: [],
  195: [],
  196: [],
  197: [],
  198: [],
  199: [],
  200: [],
  201: [],
  202: [],
  203: [],
  204: [],
  205: [],
  206: [],
  207: [],
  208: [], // NEVER FILED — no ticket #208 was ever opened; row exists only to keep the range contiguous
  209: [], // NEVER FILED — no ticket #209 was ever opened; row exists only to keep the range contiguous
  210: [],
  211: [],
  212: [],
  213: [],
  214: [],
  215: [],
  216: [],
  217: [],
  218: [],
  219: [],
  220: [],
  221: [],
  222: [],
  223: [],
  224: [],
  225: [],
  226: [],
  227: [],
  228: [],
  229: [],
  230: [],
  231: [],
  232: [],
  233: [],
  234: ['auth'],
  235: [],
  236: [],
  237: [],
  238: ['auth'],
};

/** Capabilities checked when preflight runs without a `--ticket`. */
export const BASELINE_CAPABILITIES: readonly Capability[] = ['core', 'e2e'];

/** Highest ticket number the registry declares. */
export const HIGHEST_REGISTERED_TICKET = Object.keys(TICKET_CAPABILITIES).reduce(
  (highest, key) => Math.max(highest, Number(key)),
  0,
);

/** Whether the registry declares a row for this ticket number. */
export function isRegisteredTicket(ticket: number): boolean {
  return Object.hasOwn(TICKET_CAPABILITIES, ticket);
}

/**
 * Resolves a ticket number to the capabilities preflight must check.
 *
 * An unregistered number resolves to the **baseline** rather than throwing.
 * Throwing was the original choice, on the reasoning that a gate which checks
 * nothing is worse than no gate — but it made the registry a hard dependency of
 * starting any work, and the registry fell 192 rows behind the board precisely
 * because nothing forced it forward. A ticket filed after the last commit to
 * this file would then block the gate rather than the gate blocking bad work.
 *
 * Baseline is not a silent pass: `core` and `e2e` are still checked, the caller
 * learns the row is missing from `isRegisteredTicket`, and `tickets.board.test.ts`
 * fails as soon as the board carries a ticket this file does not. The test is
 * what keeps the registry honest; the throw only ever punished the operator.
 */
export function capabilitiesForTicket(ticket: number): readonly Capability[] {
  const declared = TICKET_CAPABILITIES[ticket];
  const resolved = new Set<Capability>([...BASELINE_CAPABILITIES, ...(declared ?? [])]);
  return CAPABILITIES.filter((capability) => resolved.has(capability));
}
