import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { redactLogRecord, serializeError } from './log-error-serializer.js';

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
});
