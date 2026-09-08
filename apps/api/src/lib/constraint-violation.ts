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
  readonly code?: unknown;
  /** PGlite's spelling. */
  readonly constraint?: unknown;
  /** postgres.js's spelling — the one production raises. */
  readonly constraintName?: unknown;
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
 * The constraint the driver blamed, under either spelling.
 *
 * **`constraint_name` is the one production actually uses** (#462). postgres.js
 * maps Postgres error field `n` to `constraint_name`
 * (`postgres/src/connection.js`), while PGlite — which the suites run on —
 * spells it `constraint`. Reading only `constraint` therefore worked in every
 * test and matched nothing at all against the real driver, leaving the message
 * fallback below as the only arm that ever fired there.
 */
function named(link: ErrorLike): string | null {
  if (typeof link.constraint === 'string') {
    return link.constraint;
  }

  return typeof link.constraintName === 'string' ? link.constraintName : null;
}

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = '23505';

/**
 * Whether Postgres refused a write **because that named unique index already
 * holds the value** — and not for any other reason.
 *
 * `violatesConstraint` above is deliberately generous: it falls back to a
 * substring of the message, because the constraint name has moved between
 * driver versions and a guard that translates a conflict into a 409 is better
 * slightly wide than silently dead. That generosity is unsafe wherever the
 * catch **swallows** the error instead of re-shaping it, and #462 is exactly
 * that case.
 *
 * The reason is that Drizzle's wrapper message inlines the bound parameters —
 * `super(\`Failed query: ${query}\nparams: ${params}\`)` in `drizzle-orm/errors.js`
 * — so a person whose own name or address contained the text `users_email_key`
 * would make **every** failure of that statement match: a deadlock, a
 * serialization failure, a statement timeout, a dropped connection. Each one
 * would be recorded as "another account holds this address", answered 200 so
 * svix never retried the delivery that deserved a retry, and the real error
 * discarded.
 *
 * So this one matches on the two things a driver cannot be talked into: the
 * SQLSTATE, and an exact constraint name. No message text.
 */
export function violatesUniqueConstraint(error: unknown, constraint: string): boolean {
  return chainOf(error).some(
    (link) => link.code === UNIQUE_VIOLATION && named(link) === constraint,
  );
}
