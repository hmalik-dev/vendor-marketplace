/**
 * Whether a thrown error is Postgres rejecting a write for a named constraint.
 *
 * The reason this is a helper and not a regex at the call site: **the driver
 * does not put the constraint name in `error.message` any more.** Drizzle 0.45
 * wraps a failed query in a `DrizzleQueryError` whose message is
 * `Failed query: insert into …`; the `constraint` field and the original
 * `duplicate key value violates unique constraint "…"` text both live on
 * `cause`. A `/name/.test(error.message)` therefore never matches, and the
 * conflict it was written to translate escapes as a 500 (#399).
 *
 * Checked on `cause` first because that is where it is, then on the error
 * itself so an unwrapped driver error still answers, then on the message text
 * of either as the last resort — the exact shape is a driver detail and has
 * already changed once.
 */
export function violatesConstraint(error: unknown, constraint: string): boolean {
  return chainOf(error).some(
    (link) =>
      named(link) === constraint ||
      (typeof link.message === 'string' && link.message.includes(constraint)),
  );
}

interface ErrorLike {
  readonly message?: unknown;
  readonly constraint?: unknown;
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

function named(link: ErrorLike): string | null {
  return typeof link.constraint === 'string' ? link.constraint : null;
}
