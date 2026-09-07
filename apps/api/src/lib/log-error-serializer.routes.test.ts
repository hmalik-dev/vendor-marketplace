import { categories } from '@vendor-marketplace/db/schema';
import { eq, sql } from 'drizzle-orm';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../testing/test-server.js';

/**
 * The sink, driven through a real route. #445.
 *
 * `cases.service.ts` proves its own write path never hands the error to the
 * logger. This file proves the *other* half — that a query failure which nobody
 * guarded still leaks nothing — because that is what makes the fix a law rather
 * than a third hand-written guard.
 *
 * `POST /vendor/profile` is chosen for one reason: nothing on that path catches.
 * The insert fails, the `DrizzleQueryError` travels to `error-handler.ts`, and
 * the last line of that file logs `{ err }` — the exact shape any future author
 * writes without thinking about it. Before the serialiser existed, this test
 * found the vendor's whole bio in the log stream.
 */
const VENDOR = 'user_vendor_serialiser';

/**
 * A caller-chosen failure. `freeText()` strips bidi controls and trims; neither
 * removes `U+0000`, and Postgres refuses a null byte with `22021`.
 */
const NULL_BYTE = '\u0000';

/** Bound into the failing statement, and searched for across the whole record. */
const SENTINEL_BIO = 'A-BIO-NOBODY-ELSE-SHOULD-EVER-READ';

describe('a query failure that reaches the logger unguarded', () => {
  let harness: TestHarness;
  const captured: string[] = [];
  const collector = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      captured.push(chunk.toString());
      callback();
    },
  });

  beforeAll(async () => {
    harness = await createTestHarness({ env: { LOG_LEVEL: 'trace' }, loggerStream: collector });

    harness.clerkUsers.set(VENDOR, {
      clerkUserId: VENDOR,
      email: `${VENDOR}@example.com`,
      firstName: 'Test',
      lastName: 'Vendor',
      roleHint: 'vendor',
      avatarUrl: null,
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('writes no bound parameter anywhere in the record it emits', async () => {
    const [category] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    captured.length = 0;

    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Serialiser Studio',
        categoryIds: [category!.id],
        city: 'Austin',
        state: 'TX',
        bio: `${SENTINEL_BIO}${NULL_BYTE}`,
      },
    });

    // The write really failed — otherwise this test proves nothing about the log.
    expect(created.statusCode).toBe(500);

    const written = captured.join('\n');

    expect(written).toContain('Unhandled error');
    // Not `toContain(SENTINEL_BIO)` on a named field: the prohibition is that no
    // bound value appears *anywhere*, which is what a whole-record search says.
    expect(written).not.toContain(SENTINEL_BIO);
    expect(written).not.toContain('Serialiser Studio');
    // And the half that says what to fix survives.
    expect(written).toContain('22021');
    // The statement's identity, quoted as JSON escapes it inside the record.
    expect(written).toContain('insert into \\"vendor_profiles\\"');
    // Frames, not an empty stack: a clone that loses them costs the diagnosis.
    expect(written).toContain('vendors.dao.ts');
  });

  it('writes none of them under a field name that is not err either', async () => {
    /*
     * The wiring, not the function. A serialiser is bound to one key, so
     * `formatters.log` is what covers the rest — and this is the test that
     * fails if a later edit drops it from `server.ts`, which no assertion on
     * `redactLogRecord` itself can do.
     */
    let failure: unknown;

    try {
      await harness.database.db.execute(sql`select ${`${SENTINEL_BIO}${NULL_BYTE}`}::text`);
    } catch (error) {
      failure = error;
    }

    expect(failure, 'the statement did not fail, so this test proves nothing').toBeDefined();

    captured.length = 0;
    harness.app.log.error({ failure }, 'A write nobody guarded failed');

    const written = captured.join('\n');

    expect(written).toContain('A write nobody guarded failed');
    expect(written).not.toContain(SENTINEL_BIO);
  });
});
