import { stdSerializers } from 'pino';
import { REDACTED } from './log-redaction.js';

/**
 * Where a failed statement's bound values begin in its message.
 *
 * `DrizzleQueryError`'s message is `Failed query: <sql>\nparams: <params>` —
 * the SQL is the half worth logging and the tail is every value bound to it.
 */
const PARAMS_TAIL = '\nparams:';

/**
 * How far into a nest of errors this walks.
 *
 * The same ceiling `constraint-violation.ts` puts on its own cause walk, and
 * for the same reason: beyond a few links nothing is diagnostic, and a bound
 * that exists is what keeps a pathological chain from ending a log call in a
 * `RangeError` instead of a line.
 */
const MAX_DEPTH = 8;

/**
 * What pino will treat as an error, which is what this has to treat as one.
 *
 * `pino-std-serializers` tests `typeof err.message === 'string'` and nothing
 * else — not `instanceof Error`. Matching it exactly is the point: anything
 * looser would redact objects pino leaves alone, and anything stricter would
 * leave a duck-typed error for pino to serialise in full.
 */
interface ErrorLike {
  readonly message: string;
  readonly stack?: unknown;
  readonly cause?: unknown;
  readonly [key: string]: unknown;
}

function isErrorLike(value: unknown): value is ErrorLike {
  return value !== null && typeof (value as { message?: unknown } | null)?.message === 'string';
}

/** A failed statement, as any of the drivers in this repository report one. */
interface QueryErrorShape {
  readonly query: string;
  readonly params: unknown[];
}

/**
 * Whether an error carries a statement and the values bound to it.
 *
 * **Structural, not `instanceof DrizzleQueryError`**, and deliberately so.
 * Three shapes reach the logger with this pair on them — drizzle's wrapper,
 * PGlite's own error (which carries `query` and `params` as *own enumerable*
 * properties), and postgres.js's under `debug` — and a check against one class
 * would redact one of the three. A duplicated drizzle copy in the tree would
 * also defeat `instanceof` silently, which is the failure mode this whole
 * ticket exists to stop. An unrelated error that happens to carry both is
 * redacted too; that is the safe direction to be wrong in.
 */
function isQueryError(error: ErrorLike): error is ErrorLike & QueryErrorShape {
  return typeof error.query === 'string' && Array.isArray(error.params);
}

/**
 * The driver's `SQLSTATE`, from wherever in the cause chain it was raised.
 *
 * `null` once the error carries a `code` of its own, because pino logs that
 * one already and a second copy under another name would only be noise.
 */
function driverCodeOf(error: ErrorLike): string | null {
  if (typeof error.code === 'string') {
    return null;
  }

  const seen = new Set<unknown>([error]);
  let current: unknown = error.cause;

  // `seen` rather than a bare walk: a wrapper that names itself as its own
  // cause is a mistake a retry helper makes by accident, and an unguarded walk
  // answers it by hanging the process instead of failing the request.
  for (let depth = 0; depth < MAX_DEPTH && isErrorLike(current) && !seen.has(current); depth += 1) {
    seen.add(current);

    if (typeof current.code === 'string') {
      return current.code;
    }

    current = current.cause;
  }

  return null;
}

/**
 * The message with the bound values removed, and everything before them kept.
 */
function withoutParams(message: string): string {
  const tail = message.indexOf(PARAMS_TAIL);

  return tail === -1 ? message : message.slice(0, tail);
}

/**
 * The stack with the same tail removed from its header.
 *
 * A V8 stack opens with `<name>: <message>` and then its frames, so the
 * original message is spliced out by position rather than matched by pattern.
 * That distinction is load-bearing: the bound values are caller-supplied, so a
 * pattern like "up to the next frame line" is one an attacker can defeat by
 * typing something frame-shaped into a form.
 *
 * A `stack` that is not a string is handed back untouched. This runs while a
 * request is being answered, so an odd error shape must cost a log line's
 * detail rather than throw out of `log.error` and take the request with it —
 * the contract `redactQueryValues` states in `log-redaction.ts`.
 */
function withoutParamsInStack(stack: unknown, message: string, safe: string): unknown {
  if (typeof stack !== 'string') {
    return stack;
  }

  const header = stack.indexOf(message);

  return header === -1
    ? withoutParams(stack)
    : `${stack.slice(0, header)}${safe}${stack.slice(header + message.length)}`;
}

/** The properties `Error` keeps to itself, which pino reads rather than copies. */
const INTRINSIC = new Set(['message', 'stack', 'cause']);

/**
 * The driver's own fields that quote the value the statement failed on.
 *
 * `params` is not the only place a bound value lives. Postgres puts the
 * offending one straight into `detail` — `Key (email)=(someone@example.com)
 * already exists.` for a `23505` — and into `where` and `internal_query` for a
 * failure raised inside a function. They are stripped for the same reason
 * `params` is, and what says *what to fix* survives: `code`, `constraint`,
 * `table`, `column`, `severity`.
 */
const VALUE_BEARING = ['detail', 'where', 'hint', 'internalQuery', 'internal_query', 'parameters'];

/**
 * The same error, with some of its properties replaced.
 *
 * Same prototype, so pino still reports the error's type, and every own
 * property carried over, so nothing diagnostic is lost.
 *
 * The stack is **read from the original and re-defined as a plain value**,
 * because `Error.captureStackTrace` installs it as a lazily formatted accessor
 * bound to the internal slot of the error it was raised on. Copying that
 * descriptor onto a clone, which has no such slot, yields an error whose stack
 * reads back empty — every frame gone, and silently.
 *
 * A replaced property **keeps the visibility it already had**. Publishing one
 * that was hidden is not cosmetic: `AggregateError.errors` is non-enumerable,
 * and a clone that enumerates it makes pino write the whole array a second time
 * as raw objects — each one dumped with its driver `cause` attached, which is
 * how a redaction can end up disclosing more than it withheld.
 */
function cloneError(error: ErrorLike, overrides: Record<string, unknown>): ErrorLike {
  const clone = Object.create(Object.getPrototypeOf(error) as object) as ErrorLike;

  Object.defineProperties(clone, Object.getOwnPropertyDescriptors(error));

  for (const [key, value] of Object.entries({ stack: error.stack, ...overrides })) {
    Object.defineProperty(clone, key, {
      value,
      writable: true,
      enumerable: Object.getOwnPropertyDescriptor(error, key)?.enumerable ?? !INTRINSIC.has(key),
      configurable: true,
    });
  }

  return clone;
}

/**
 * The same error with every value it quotes gone, and everything that says
 * what to fix kept.
 *
 * Two withholdings, and the wider one applies to **any** link in the chain,
 * not only to the one carrying the statement: the `detail` that names the
 * duplicated value hangs off the *driver's* error, which has no `query` or
 * `params` of its own, and pino writes that object whole under any key it has
 * no serialiser for.
 */
function redactValues(error: ErrorLike): ErrorLike {
  const quoted = VALUE_BEARING.filter((field) => error[field] !== undefined).map((field) => [
    field,
    REDACTED,
  ]);

  if (!isQueryError(error)) {
    return quoted.length === 0 ? error : cloneError(error, Object.fromEntries(quoted));
  }

  const message = withoutParams(error.message);
  const driverCode = driverCodeOf(error);

  return cloneError(error, {
    ...Object.fromEntries(quoted),
    message,
    stack: withoutParamsInStack(error.stack, error.message, message),
    params: REDACTED,
    // The half that says what to fix. pino serialises a cause's message and
    // stack but never its own properties, so `22021` or a constraint's `23505`
    // does not otherwise survive the trip from the driver to the log line.
    ...(driverCode === null ? {} : { driverCode }),
  });
}

/**
 * The error a log line may see, with every bound parameter removed from it.
 *
 * Returns the value itself when there is nothing to strip, so the overwhelming
 * majority of logged errors are not cloned.
 *
 * **It follows every route pino takes to a nested error, not just `cause`.**
 * `pino-std-serializers` recurses into `err.cause`, into `err.errors` (an
 * `AggregateError`, or anything `Promise.any` rejects with), and into any own
 * enumerable property whose value is error-like — each through its *own*
 * serialiser, which does not redact. A failed query one link down any of those
 * three is the same leak as a failed query at the top.
 */
function sanitize(value: unknown, seen: Set<unknown>, depth: number): unknown {
  if (!isErrorLike(value)) {
    return value;
  }

  /*
   * Dropped rather than reused. Handing the original back is how a circular
   * chain puts the values in again: pino walks to it and prints its unredacted
   * message. The link carries nothing a reader can use anyway — pino answers a
   * cycle with `causes have become circular...`.
   */
  if (seen.has(value) || depth >= MAX_DEPTH) {
    return undefined;
  }

  seen.add(value);

  const overrides: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    /*
     * `cause` and `errors` are handled below, and skipping them here is not
     * tidiness: `DrizzleQueryError` assigns `this.cause`, which makes it an
     * *own enumerable* property, so this loop reaches it, marks it seen, and
     * the deliberate pass below then reads it as a cycle and drops the link —
     * taking the driver's message and its `SQLSTATE` with it.
     */
    if (key === 'cause' || key === 'errors' || !isErrorLike(nested)) {
      continue;
    }

    const sanitized = sanitize(nested, seen, depth + 1);

    if (sanitized !== nested) {
      overrides[key] = sanitized;
    }
  }

  if (Array.isArray(value.errors)) {
    const errors = value.errors.map((nested) => sanitize(nested, seen, depth + 1));

    if (errors.some((nested, index) => nested !== (value.errors as unknown[])[index])) {
      overrides.errors = errors;
    }
  }

  // `cause` last, and unconditionally: it is the one link that is not an own
  // enumerable property, so the loop above never reaches it.
  const cause = sanitize(value.cause, seen, depth + 1);

  if (cause !== value.cause) {
    overrides.cause = cause;
  }

  const rebuilt = Object.keys(overrides).length === 0 ? value : cloneError(value, overrides);

  return redactValues(rebuilt);
}

/**
 * The API's `err` serialiser: pino's own, over an error that can no longer
 * carry the values a statement was bound with. #445.
 *
 * **The guard is the sink, not the call sites.** A failed statement arrives as
 * a `DrizzleQueryError` whose `message` is `Failed query: … params: <every
 * bound parameter>` and which carries `params` as an own enumerable property;
 * pino's `err` serialiser copies own properties, and `server.ts`'s `redact`
 * list is path-based on `req.headers.*` and never reaches it. So *any*
 * `log.*({ err })` on a query failure wrote every bound value into the log
 * stream — and one of those statements binds up to 4,000 characters somebody
 * typed into the public, unauthenticated support form, failing whenever that
 * stranger chooses (`freeText()` does not strip `U+0000`; Postgres refuses one
 * with `22021`).
 *
 * Two call sites had already been fixed by hand when this was written, which is
 * precisely why the third fix is here instead: at the one place every present
 * and future `{ err }` passes through, so a new one is covered without its
 * author knowing this hazard exists.
 *
 * What survives is what a failure is read for: the statement text, the error
 * type, the frames, and the driver's `SQLSTATE`.
 */
export function serializeError(error: Error): ReturnType<typeof stdSerializers.err> {
  return stdSerializers.err(sanitize(error, new Set(), 0) as Error);
}

/**
 * The same redaction for every *other* key of a log record. #445.
 *
 * `serializeError` above is bound to `err`, and pino applies a serialiser by
 * key — so `log.error({ failure: error })` reaches the stream through a path
 * that serialiser never sees, carrying the bound values with it. That is not a
 * hypothetical shape: the two call sites this ticket did not have to fix both
 * log a failure under a name of their own.
 *
 * pino runs `formatters.log` over the merged record **before** any serialiser,
 * so redacting here covers every key, whatever a future author calls it. The
 * record is copied rather than mutated, and only when something actually
 * changed — the caller's object belongs to the caller.
 */
export function redactLogRecord(record: Record<string, unknown>): Record<string, unknown> {
  let redacted: Record<string, unknown> | null = null;

  for (const [key, value] of Object.entries(record)) {
    // `err` is the serialiser's own key; doing it twice would only cost time.
    if (key === 'err' || !isErrorLike(value)) {
      continue;
    }

    const sanitized = sanitize(value, new Set(), 0);

    if (sanitized !== value) {
      redacted ??= { ...record };
      redacted[key] = sanitized;
    }
  }

  return redacted ?? record;
}
