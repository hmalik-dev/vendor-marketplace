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
 * and no longer appear on the status board. Rows marked MERGED are the same idea
 * from the 2026-08-29 backlog consolidation, except that those tickets do still
 * appear on the board, carrying `Superseded` and a pointer to their replacement.
 * They keep their rows on purpose:
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
  48: [], // MERGED — superseded by #19 (2026-08-29 consolidation)
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
  64: [], // MERGED — superseded by #316 (2026-08-29 consolidation)
  65: [],
  66: [],
  // #67 is a database constraint plus a route dedupe — no Stripe call — but the
  // flow it fixes is only reachable signed in, so it carries `auth` and not `stripe`.
  67: ['auth'],
  // #68 reaches checkout, so unlike #67 it does need Stripe credentials.
  68: ['auth', 'stripe'], // MERGED — superseded by #309 (2026-08-29 consolidation)
  69: [], // MERGED — superseded by #304 (2026-08-29 consolidation)
  70: [], // MERGED — superseded by #304 (2026-08-29 consolidation)
  71: [], // MERGED — superseded by #310 (2026-08-29 consolidation)
  72: [], // MERGED — superseded by #305 (2026-08-29 consolidation)
  73: [],
  74: [],
  75: [], // MERGED — superseded by #296 (2026-08-29 consolidation)
  76: ['auth'],
  77: [], // MERGED — superseded by #314 (2026-08-29 consolidation)
  78: [], // MERGED — superseded by #314 (2026-08-29 consolidation)
  79: [], // MERGED — superseded by #300 (2026-08-29 consolidation)
  80: [], // MERGED — superseded by #306 (2026-08-29 consolidation)
  81: [], // MERGED — superseded by #305 (2026-08-29 consolidation)
  82: [],
  83: [],
  84: [],
  85: [],
  86: [],
  87: [],
  88: [], // MERGED — superseded by #296 (2026-08-29 consolidation)
  89: [],
  90: [],
  91: [],
  92: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  93: [],
  94: [],
  95: [],
  96: [],
  97: [],
  98: [],
  99: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  100: [],
  101: [],
  102: [],
  103: [],
  104: [],
  105: [],
  106: [], // MERGED — superseded by #298 (2026-08-29 consolidation)
  107: [],
  108: [],
  109: [],
  110: [], // MERGED — superseded by #298 (2026-08-29 consolidation)
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
  124: [], // MERGED — superseded by #300 (2026-08-29 consolidation)
  125: [],
  126: [],
  127: [], // MERGED — superseded by #300 (2026-08-29 consolidation)
  128: [],
  129: [],
  130: [],
  131: [],
  132: [],
  133: [],
  134: [],
  135: [], // MERGED — superseded by #300 (2026-08-29 consolidation)
  136: [],
  137: [], // MERGED — superseded by #299 (2026-08-29 consolidation)
  138: [], // MERGED — superseded by #299 (2026-08-29 consolidation)
  139: [],
  140: [], // MERGED — superseded by #299 (2026-08-29 consolidation)
  141: [], // MERGED — superseded by #299 (2026-08-29 consolidation)
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
  152: [], // MERGED — superseded by #299 (2026-08-29 consolidation)
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
  166: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  167: [],
  168: [],
  169: [], // MERGED — superseded by #304 (2026-08-29 consolidation)
  // #170-#185 are the upload/imagery batch from the 2026-08-28 sweep; every one
  // of them reads or writes objects, so the whole run needs `storage`.
  170: ['storage'],
  171: ['storage'],
  172: ['storage'], // MERGED — superseded by #311 (2026-08-29 consolidation)
  173: ['storage'],
  174: ['storage'], // MERGED — superseded by #312 (2026-08-29 consolidation)
  175: ['storage'], // MERGED — superseded by #312 (2026-08-29 consolidation)
  176: ['storage'], // MERGED — superseded by #311 (2026-08-29 consolidation)
  177: ['storage'], // MERGED — superseded by #312 (2026-08-29 consolidation)
  178: ['storage'], // MERGED — superseded by #311 (2026-08-29 consolidation)
  179: ['storage'], // MERGED — superseded by #311 (2026-08-29 consolidation)
  180: ['storage'], // MERGED — superseded by #311 (2026-08-29 consolidation)
  181: ['storage'], // MERGED — superseded by #312 (2026-08-29 consolidation)
  182: ['storage'], // MERGED — superseded by #312 (2026-08-29 consolidation)
  183: ['storage'], // MERGED — superseded by #311 (2026-08-29 consolidation)
  184: ['storage'], // MERGED — superseded by #311 (2026-08-29 consolidation)
  185: ['storage'], // MERGED — superseded by #312 (2026-08-29 consolidation)
  186: [], // MERGED — superseded by #296 (2026-08-29 consolidation)
  187: [], // MERGED — superseded by #302 (2026-08-29 consolidation)
  188: [], // MERGED — superseded by #302 (2026-08-29 consolidation)
  189: [], // MERGED — superseded by #302 (2026-08-29 consolidation)
  190: [], // MERGED — superseded by #302 (2026-08-29 consolidation)
  191: [], // MERGED — superseded by #302 (2026-08-29 consolidation)
  192: [], // MERGED — superseded by #302 (2026-08-29 consolidation)
  193: [], // MERGED — superseded by #302 (2026-08-29 consolidation)
  194: [], // MERGED — superseded by #313 (2026-08-29 consolidation)
  195: [],
  196: [],
  197: [], // MERGED — superseded by #313 (2026-08-29 consolidation)
  198: [],
  199: [], // MERGED — superseded by #306 (2026-08-29 consolidation)
  200: [],
  201: [],
  202: [],
  203: [],
  204: [],
  205: [],
  206: [],
  207: [], // MERGED — superseded by #315 (2026-08-29 consolidation)
  208: [], // NEVER FILED — no ticket #208 was ever opened; row exists only to keep the range contiguous
  209: [], // NEVER FILED — no ticket #209 was ever opened; row exists only to keep the range contiguous
  210: [], // MERGED — superseded by #307 (2026-08-29 consolidation)
  211: [], // MERGED — superseded by #307 (2026-08-29 consolidation)
  212: [], // MERGED — superseded by #307 (2026-08-29 consolidation)
  213: [], // MERGED — superseded by #307 (2026-08-29 consolidation)
  214: [], // MERGED — superseded by #309 (2026-08-29 consolidation)
  215: [],
  216: [], // MERGED — superseded by #308 (2026-08-29 consolidation)
  217: [], // MERGED — superseded by #308 (2026-08-29 consolidation)
  218: [], // MERGED — superseded by #308 (2026-08-29 consolidation)
  219: [], // MERGED — superseded by #310 (2026-08-29 consolidation)
  220: [], // MERGED — superseded by #10 (2026-08-29 consolidation)
  221: [], // MERGED — superseded by #308 (2026-08-29 consolidation)
  222: [],
  223: [], // MERGED — superseded by #308 (2026-08-29 consolidation)
  224: [], // MERGED — superseded by #308 (2026-08-29 consolidation)
  225: [], // MERGED — superseded by #305 (2026-08-29 consolidation)
  226: [], // MERGED — superseded by #313 (2026-08-29 consolidation)
  227: [], // MERGED — superseded by #305 (2026-08-29 consolidation)
  228: [], // MERGED — superseded by #305 (2026-08-29 consolidation)
  229: [], // MERGED — superseded by #310 (2026-08-29 consolidation)
  230: [], // MERGED — superseded by #303 (2026-08-29 consolidation)
  231: [],
  232: [],
  233: [], // MERGED — superseded by #14 (2026-08-29 consolidation)
  234: ['auth'], // MERGED — superseded by #313 (2026-08-29 consolidation)
  235: [],
  236: [], // MERGED — superseded by #314 (2026-08-29 consolidation)
  237: [], // MERGED — superseded by #314 (2026-08-29 consolidation)
  238: ['auth'],
  239: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  240: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  241: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  242: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  243: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  244: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  245: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  246: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  247: [], // MERGED — superseded by #303 (2026-08-29 consolidation)
  248: [], // MERGED — superseded by #306 (2026-08-29 consolidation)
  249: [], // MERGED — superseded by #296 (2026-08-29 consolidation)
  250: [], // MERGED — superseded by #296 (2026-08-29 consolidation)
  251: [],
  252: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  253: [],
  254: [], // MERGED — superseded by #298 (2026-08-29 consolidation)
  255: ['auth'], // MERGED — superseded by #310 (2026-08-29 consolidation)
  256: [], // MERGED — superseded by #316 (2026-08-29 consolidation)
  // #257 onward were filed by detached lanes that each restarted numbering at
  // #254, which main had already issued. Renumbered on merge, per the collision
  // rule in `.claude/plans/lane-handoff-2026-08-29.md`.
  // Lane 137 filed #254-#255:
  257: [], // MERGED — superseded by #299 (2026-08-29 consolidation)
  258: [], // MERGED — superseded by #299 (2026-08-29 consolidation)
  // Lane 124 filed #254-#256:
  259: [], // MERGED — superseded by #313 (2026-08-29 consolidation)
  260: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  261: [], // MERGED — superseded by #305 (2026-08-29 consolidation)
  // Lane 153 filed #254-#270:
  262: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  263: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  264: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  265: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  266: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  267: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  268: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  269: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  270: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  271: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  272: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  273: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  274: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  275: [], // MERGED — superseded by #306 (2026-08-29 consolidation)
  276: [], // MERGED — superseded by #306 (2026-08-29 consolidation)
  277: [], // MERGED — superseded by #303 (2026-08-29 consolidation)
  278: [], // MERGED — superseded by #306 (2026-08-29 consolidation)
  279: [], // MERGED — superseded by #301 (2026-08-29 consolidation)
  280: [], // MERGED — superseded by #296 (2026-08-29 consolidation)
  281: [], // MERGED — superseded by #297 (2026-08-29 consolidation)
  282: [], // MERGED — superseded by #296 (2026-08-29 consolidation)
  283: [], // MERGED — superseded by #306 (2026-08-29 consolidation)
  284: [], // MERGED — superseded by #298 (2026-08-29 consolidation)
  285: [], // MERGED — superseded by #298 (2026-08-29 consolidation)
  286: [], // MERGED — superseded by #298 (2026-08-29 consolidation)
  287: ['storage'], // MERGED — superseded by #298 (2026-08-29 consolidation)
  288: ['storage'], // MERGED — superseded by #299 (2026-08-29 consolidation)
  289: [], // MERGED — superseded by #298 (2026-08-29 consolidation)
  290: [], // MERGED — superseded by #304 (2026-08-29 consolidation)
  291: [], // MERGED — superseded by #306 (2026-08-29 consolidation)
  292: [], // MERGED — superseded by #306 (2026-08-29 consolidation)
  293: ['core'], // MERGED — superseded by #315 (2026-08-29 consolidation)
  294: ['core'],
  295: ['core'], // MERGED — superseded by #306 (2026-08-29 consolidation)
  // #296-#316 are the 2026-08-29 backlog consolidation: 130 open tickets merged
  // into 21. Every merged ticket keeps its own row above, labelled MERGED, for
  // the same reason RETIRED rows are kept — `--ticket <old number>` still gates
  // correctly for anyone on a branch or commit message that predates the merge.
  296: [],
  297: [],
  298: ['storage'],
  299: ['storage'],
  300: [],
  301: [],
  302: [],
  303: [],
  304: [],
  305: [],
  306: [],
  307: [],
  308: [],
  309: ['auth', 'stripe'],
  310: ['auth'],
  311: ['storage'],
  312: ['storage'],
  313: ['auth'],
  314: [],
  315: [],
  316: [],
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
