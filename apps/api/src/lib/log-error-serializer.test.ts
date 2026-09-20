import { DrizzleQueryError } from 'drizzle-orm';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { redactErrorValues, redactLogRecord, serializeError } from './log-error-serializer.js';

/**
 * The sink, on its own. #445.
 *
 * Every assertion searches the **whole serialised record** for a sentinel that
 * was bound into the failing statement, rather than inspecting named fields.
 * That is the shape #434's `admin_actions` test uses and it is the same reason:
 * a field-by-field check passes while the payload leaves through a field
 * nobody listed, and here the fields are chosen by a library upgrade rather
 * than by us.
 */
const SENTINEL = 'A-VALUE-NOBODY-ELSE-SHOULD-EVER-READ';

const STATEMENT = 'insert into "cases" ("reference", "message") values ($1, $2)';

/** The driver error drizzle wraps: a `PostgresError`'s shape, not a fake API. */
function driverError(message: string, code: string): Error {
  return Object.assign(new Error(message), { severity: 'ERROR', code });
}

/** What a failed statement actually arrives as, built by drizzle's own class. */
function failedQuery(params: unknown[]): DrizzleQueryError {
  return new DrizzleQueryError(
    STATEMENT,
    params,
    driverError('invalid byte sequence for encoding "UTF8": 0x00', '22021'),
  );
}

/** Everything the logger would write for this error, as one searchable string. */
function serialized(error: Error): string {
  return JSON.stringify(serializeError(error));
}

/**
 * The line a real pino logger writes, wired the way `server.ts` wires it.
 *
 * Not `serializeError`'s return value: `pino-std-serializers` copies an error's
 * `errors` array to `aggregateErrors` *and* writes it again under `errors`, and
 * only the line shows what both copies carried.
 */
function loggedLine(record: Record<string, unknown>): string {
  const lines: string[] = [];
  const logger = pino(
    { formatters: { log: redactLogRecord }, serializers: { err: serializeError } },
    { write: (line: string) => lines.push(line) },
  );

  logger.error(record, 'A nested failure');

  expect(lines).toHaveLength(1);

  return lines[0]!;
}

describe('the API error serialiser', () => {
  it('writes no bound parameter anywhere in the record', () => {
    const record = serialized(failedQuery(['case_9f21', SENTINEL]));

    expect(record).not.toContain(SENTINEL);
    expect(record).not.toContain('case_9f21');
  });

  it('drops the params tail from the message and the stack', () => {
    const written = serializeError(failedQuery([SENTINEL]));

    expect(written.message).toBe(
      `Failed query: ${STATEMENT}: invalid byte sequence for encoding "UTF8": 0x00`,
    );
    expect(written.stack).not.toContain('params:');
  });

  it('keeps the statement, the type, the frames and the driver code', () => {
    const written = serializeError(failedQuery([SENTINEL]));

    expect(written.type).toBe('DrizzleQueryError');
    expect(written.stack).toContain('log-error-serializer.test.ts');
    expect(
      JSON.parse(serialized(failedQuery([SENTINEL]))) as Record<string, unknown>,
    ).toMatchObject({
      query: STATEMENT,
      params: '[redacted]',
      driverCode: '22021',
    });
  });

  it('redacts a failure the caller only reaches through a wrapper', () => {
    const wrapped = new Error('Support case could not be written', {
      cause: failedQuery([SENTINEL]),
    });

    const record = serialized(wrapped);

    // pino composes both the message and the stack from the whole cause chain,
    // so a wrapper is the shape that reintroduces the leak one link down.
    expect(record).not.toContain(SENTINEL);
    expect(record).toContain('Support case could not be written');
    expect(record).toContain('invalid byte sequence');
  });

  it('is not defeated by a bound value shaped like a stack frame', () => {
    /*
     * The values are typed by a stranger into a public form, so anything the
     * redaction recognises by pattern is a pattern that stranger can write.
     * This is the payload that beats "cut the message at the next frame line".
     */
    const forged = `${SENTINEL}\n    at NotAFrame (nowhere.ts:1:1)\nparams: decoy`;

    expect(serialized(failedQuery([forged]))).not.toContain(SENTINEL);
  });

  it('leaves an error with nothing to strip exactly as it was', () => {
    const ordinary = new Error('Stripe refused the transfer');

    const written = serializeError(ordinary);

    expect(written.message).toBe('Stripe refused the transfer');
    expect(written.stack).toBe(ordinary.stack);
    expect(written.raw).toBe(ordinary);
  });

  it('follows every route pino takes to a nested error, not only cause', () => {
    /*
     * pino recurses into `errors` and into any own enumerable error-valued
     * property — each through its *own* serialiser, which does not redact. One
     * `Promise.any` over two reads, or one `Object.assign(error, { inner })`,
     * puts the statement's values back without touching `cause` at all.
     */
    const aggregated = new AggregateError([failedQuery([SENTINEL])], 'Every read failed');
    const attached = Object.assign(new Error('Could not load the dashboard'), {
      inner: failedQuery([SENTINEL]),
    });

    expect(serialized(aggregated)).not.toContain(SENTINEL);
    expect(serialized(attached)).not.toContain(SENTINEL);
  });

  it('redacts every entry of an errors array, not only the ones pino calls errors', () => {
    /*
     * pino hands `errors` entries that are not error-like straight through, into
     * both `aggregateErrors` and `errors`. A driver's field record, a query
     * payload, an array of failures or a record wrapping one reaches the line
     * raw unless the sink walks it. Each carries the sentinel somewhere the
     * redaction already withholds on an error.
     */
    class FieldRecord {
      detail = SENTINEL;
    }

    const entries = [
      { detail: `Key (reference)=(${SENTINEL}) already exists.` },
      { query: STATEMENT, params: [SENTINEL] },
      [failedQuery([SENTINEL])],
      { failure: failedQuery([SENTINEL]) },
      // A class instance is written field by field exactly as a literal is.
      new FieldRecord(),
      // An entry pino does call an error still carries raw records of its own.
      { message: 'Write failed', payload: { query: STATEMENT, params: [SENTINEL] } },
    ];

    for (const entry of entries) {
      const failure = Object.assign(new Error('Every write failed'), { errors: [entry] });

      for (const key of ['err', 'failure']) {
        const line = loggedLine({ [key]: failure });

        expect(line, `${key}: ${JSON.stringify(entry)}`).not.toContain(SENTINEL);
        // The entry is still written, withheld — not dropped from the line.
        expect(line).toContain('[redacted]');
      }
    }
  });

  it("withholds a failure carried in a provider SDK error's errors array", () => {
    /*
     * The shape an identity or payment SDK gives its API error: an `Error` whose
     * own enumerable `errors` is an array of `Error` subclasses that pino files
     * under both `aggregateErrors` and `errors`. One entry is a plain response
     * entry; the other carries a record — the entry shape pino calls an error and
     * serialises field by field.
     */
    class ApiEntry extends Error {
      constructor(
        readonly code: string,
        message: string,
        readonly longMessage: string,
      ) {
        super(message);
      }
    }

    class ApiResponseError extends Error {
      readonly status = 422;
      constructor(readonly errors: ApiEntry[]) {
        super('Unprocessable Entity');
      }
    }

    const failure = new ApiResponseError([
      new ApiEntry('form_identifier_exists', 'Taken', 'That email is taken.'),
      new ApiEntry('form_param_invalid', 'Invalid', 'Not written.'),
    ]);
    Object.assign(failure.errors[1]!, { payload: { query: STATEMENT, params: [SENTINEL] } });

    for (const key of ['err', 'failure']) {
      const line = loggedLine({ [key]: failure });

      expect(line).not.toContain(SENTINEL);
      // What says what went wrong survives, under every key pino wrote it to.
      expect(JSON.parse(line)).toMatchObject({
        [key]: {
          status: 422,
          errors: [
            { code: 'form_identifier_exists' },
            { code: 'form_param_invalid', payload: { query: STATEMENT, params: '[redacted]' } },
          ],
          ...(key === 'err'
            ? {
                aggregateErrors: [
                  { code: 'form_identifier_exists', longMessage: 'That email is taken.' },
                  { code: 'form_param_invalid', payload: { params: '[redacted]' } },
                ],
              }
            : {}),
        },
      });
    }
  });

  it('terminates on an errors array that contains itself', () => {
    const entries: unknown[] = [{ params: [SENTINEL], query: STATEMENT }];
    entries.push(entries);

    const line = loggedLine({ err: Object.assign(new Error('Looped'), { errors: entries }) });

    expect(line).not.toContain(SENTINEL);
    // Withheld at the first repeat, not eight levels down at the depth bound.
    expect((JSON.parse(line) as { err: { errors: unknown[] } }).err.errors[1]).toBe('[redacted]');
  });

  it('keeps a record two entries share, because sharing is not a cycle', () => {
    const shared = { code: 'form_identifier_exists', field: 'email' };
    const failure = Object.assign(new Error('Two fields failed'), {
      errors: [shared, { meta: shared }, failedQuery([SENTINEL])],
    });

    const line = JSON.parse(loggedLine({ err: failure })) as {
      err: { errors: unknown[]; aggregateErrors: unknown[] };
    };

    expect(JSON.stringify(line)).not.toContain(SENTINEL);
    expect(line.err.errors.slice(0, 2)).toEqual([shared, { meta: shared }]);
    expect(line.err.aggregateErrors.slice(0, 2)).toEqual([shared, { meta: shared }]);
  });

  it('redacts an error that is not an Error, because pino serialises it anyway', () => {
    // pino's own test is `typeof err.message === 'string'` and nothing else.
    const duckTyped = {
      message: `Failed query: ${STATEMENT}\nparams: ${SENTINEL}`,
      query: STATEMENT,
      params: [SENTINEL],
    };

    expect(JSON.stringify(serializeError(duckTyped as unknown as Error))).not.toContain(SENTINEL);
  });

  it('redacts a failure logged under a name other than err', () => {
    // `serializeError` is bound to one key; this is what covers the rest.
    const record = redactLogRecord({
      reference: 'case_9f21',
      failure: failedQuery([SENTINEL]),
    });

    /*
     * Stringified as pino stringifies a value no serialiser claims — **not**
     * pushed back through `serializeError`, which redacts on its own and would
     * pass this test even if `redactLogRecord` returned its argument untouched.
     */
    expect(JSON.stringify(record.failure)).not.toContain(SENTINEL);
    expect(record.reference).toBe('case_9f21');
  });

  it('withholds the value Postgres quotes back in the driver error', () => {
    // `params` is not the only place a bound value lives: a 23505's `detail`
    // is `Key (email)=(<the value>) already exists.`
    const violation = new DrizzleQueryError(
      STATEMENT,
      ['case_9f21'],
      Object.assign(new Error('duplicate key value violates unique constraint "cases_ref"'), {
        code: '23505',
        constraint: 'cases_ref',
        detail: `Key (reference)=(${SENTINEL}) already exists.`,
      }),
    );

    const record = JSON.stringify(redactLogRecord({ failure: violation }));

    expect(record).not.toContain(SENTINEL);
    // The half that says what to fix.
    expect(record).toContain('cases_ref');
    expect(record).toContain('23505');
  });

  it('leaves a record with nothing to redact as the very object it was given', () => {
    const record = { reference: 'case_9f21', route: '/support/messages' };

    expect(redactLogRecord(record)).toBe(record);
  });

  it('costs a log line its detail rather than throwing out of the log call', () => {
    // The contract `log-redaction.ts` states: this runs while a request is
    // being answered, so an odd error shape must never take the request down.
    const malformed = Object.assign(new Error('Failed query: …'), {
      query: STATEMENT,
      params: [SENTINEL],
      stack: null,
    });

    expect(() => serializeError(malformed)).not.toThrow();
    expect(JSON.stringify(serializeError(malformed))).not.toContain(SENTINEL);
  });

  it('terminates on a cause chain that points back at itself', () => {
    const failed = failedQuery([SENTINEL]);
    // A self-referencing cause is what a retry wrapper produces by accident,
    // and an unguarded walk of the chain would hang the process rather than
    // fail a request.
    Object.defineProperty(failed, 'cause', { value: failed, configurable: true });

    expect(serialized(failed)).not.toContain(SENTINEL);
  });

  describe('a Postgres driver error that owns a non-configurable `parameters`', () => {
    function postgresError(): Error {
      const error = Object.assign(new Error('column "refund_state" does not exist'), {
        severity: 'ERROR',
        code: '42703',
        detail: `Key (email)=(${SENTINEL}) is wrong.`,
      });

      Object.defineProperty(error, 'parameters', {
        value: [SENTINEL],
        enumerable: true,
        configurable: false,
      });

      return error;
    }

    it('logs its message and SQLSTATE with no bound value', () => {
      const record = serializeError(postgresError());

      expect(record.message).toBe('column "refund_state" does not exist');
      expect(record.code).toBe('42703');
      // Only the redaction path produces these; the fallback carries none.
      expect(record.stack).toContain('log-error-serializer.test.ts');
      expect(record).toMatchObject({
        severity: 'ERROR',
        detail: '[redacted]',
        parameters: '[redacted]',
      });
      expect(JSON.stringify(record)).not.toContain(SENTINEL);
    });

    it('survives a frozen source error', () => {
      const frozen = Object.freeze(postgresError());

      expect(serializeError(frozen).code).toBe('42703');
      expect(serializeError(frozen)).toMatchObject({ parameters: '[redacted]' });
      expect(JSON.stringify(serializeError(frozen))).not.toContain(SENTINEL);
    });
  });

  it('falls back to the original message and code when redaction itself throws', () => {
    const broken = Object.assign(new Error(`Failed query: ${STATEMENT}\nparams: ${SENTINEL}`), {
      code: '22021',
      query: STATEMENT,
      params: [SENTINEL],
    });

    Object.defineProperty(broken, 'payload', {
      enumerable: true,
      get() {
        throw new Error('getter exploded');
      },
    });

    const record = serializeError(broken);

    expect(record.message).toBe(`Failed query: ${STATEMENT}`);
    expect(record.code).toBe('22021');
    expect(record.type).toBe('Error');
    expect(record.stack).toContain('log-error-serializer.test.ts');
    expect(JSON.stringify(record)).not.toContain(SENTINEL);
  });

  it('holds the same fallback for a failure logged under another key and for Sentry', () => {
    const broken = Object.assign(new Error(`Failed query: ${STATEMENT}\nparams: ${SENTINEL}`), {
      code: '22021',
      query: STATEMENT,
      params: [SENTINEL],
    });

    Object.defineProperty(broken, 'payload', {
      enumerable: true,
      get() {
        throw new Error('getter exploded');
      },
    });

    const logged = redactLogRecord({ failure: broken });
    const reported = redactErrorValues(broken);

    expect(logged.failure).toMatchObject({ message: `Failed query: ${STATEMENT}`, code: '22021' });
    expect(reported).toMatchObject({ message: `Failed query: ${STATEMENT}`, code: '22021' });
    expect(JSON.stringify([logged, reported])).not.toContain(SENTINEL);
  });
});
