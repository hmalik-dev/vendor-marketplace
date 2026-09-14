interface ErrorLike {
  readonly code?: unknown;
  /** PGlite's spelling — what the suites run on. */
  readonly constraint?: unknown;
  /** postgres.js's spelling — the one production raises. */
  readonly constraint_name?: unknown;
  readonly cause?: unknown;
}

/** The error and everything it was wrapped in, outermost first. */
function chainOf(error: unknown): ErrorLike[] {
  const links: ErrorLike[] = [];

  for (let link = error; isErrorLike(link) && links.length < 8; link = link.cause) {
    links.push(link);
  }

  return links;
}

function isErrorLike(value: unknown): value is ErrorLike & { cause: unknown } {
  return typeof value === 'object' && value !== null;
}

/**
 * The constraint the driver blamed, under either driver's spelling.
 *
 * **`constraint_name` is the one production actually uses** (#462, VEN-385).
 * postgres.js maps Postgres error field `n` to `constraint_name` and assigns it
 * onto the error verbatim (`postgres/src/connection.js`), while PGlite spells it
 * `constraint`. An earlier repair read `constraintName`, which no driver writes,
 * and passed every test because those tests built the error by hand. Both
 * spellings are now pinned by a genuine violation through each driver.
 */
function named(link: ErrorLike): string | null {
  if (typeof link.constraint === 'string') {
    return link.constraint;
  }

  return typeof link.constraint_name === 'string' ? link.constraint_name : null;
}

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = '23505';

/**
 * Whether Postgres refused a write **because that named unique index already
 * holds the value** — and not for any other reason.
 *
 * Checked along the whole `cause` chain, because Drizzle 0.45 wraps a failed
 * query in a `DrizzleQueryError` and leaves the driver's fields on `cause`
 * (#399).
 *
 * It matches on the two things a driver cannot be talked into — the SQLSTATE
 * and an exact constraint name — and **never on message text**. Drizzle's
 * wrapper message inlines the bound parameters
 * (`Failed query: ${query}\nparams: ${params}` in `drizzle-orm/errors.js`), so a
 * person whose name, address or review text contained an index's name would
 * turn every failure of that statement — a deadlock, a timeout, a cancelled or
 * dropped connection — into a match. A generous message-reading variant existed
 * until VEN-385 and was the only arm that fired against postgres.js;
 * `error-message-control-flow-guard.test.ts` keeps it from coming back.
 */
export function violatesUniqueConstraint(error: unknown, constraint: string): boolean {
  return chainOf(error).some(
    (link) => link.code === UNIQUE_VIOLATION && named(link) === constraint,
  );
}
