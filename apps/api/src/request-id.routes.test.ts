import { Writable } from 'node:stream';
import { REQUEST_ID_HEADER, WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from './testing/test-server.js';

/** VEN-690 — one id joins the response, the log line and the Sentry tag. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIER_KEY = 'tier-key-for-the-request-id-suite';
const FORWARDED = '5f0c2a52-7d7e-4a52-9f3e-2f6c1f7a9b10';

describe('the request id', () => {
  const lines: string[] = [];
  let harness: TestHarness;

  beforeAll(async () => {
    const loggerStream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    harness = await createTestHarness({
      loggerStream,
      env: { WEB_TIER_KEY: TIER_KEY, LOG_LEVEL: 'info' },
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  const get = (headers: Record<string, string> = {}) =>
    harness.app.inject({ method: 'GET', url: '/v1/categories', headers });

  it('gives two requests distinct UUIDs, and the response carries the one that was logged', async () => {
    lines.length = 0;
    const first = await get();
    const second = await get();
    const ids = [first, second].map((response) => response.headers[REQUEST_ID_HEADER]);

    expect(ids[0]).toMatch(UUID);
    expect(ids[1]).toMatch(UUID);
    expect(ids[0]).not.toBe(ids[1]);
    const logged = lines.map((line) => (JSON.parse(line) as { reqId?: string }).reqId);
    expect(logged).toContain(ids[0]);
    expect(logged).toContain(ids[1]);
  });

  it('honours an inbound id from the web tier when it is a UUID', async () => {
    const response = await get({
      [REQUEST_ID_HEADER]: FORWARDED,
      [WEB_TIER_KEY_HEADER]: TIER_KEY,
    });

    expect(response.headers[REQUEST_ID_HEADER]).toBe(FORWARDED);
  });

  it.each([
    ['no web tier key', { [REQUEST_ID_HEADER]: FORWARDED }],
    ['a wrong web tier key', { [REQUEST_ID_HEADER]: FORWARDED, [WEB_TIER_KEY_HEADER]: 'nope' }],
    [
      'a value that is not a UUID',
      { [REQUEST_ID_HEADER]: 'not-a-uuid-{"forged":1}', [WEB_TIER_KEY_HEADER]: TIER_KEY },
    ],
  ])('mints a fresh id for %s', async (_name, headers) => {
    const response = await get(headers);
    const id = response.headers[REQUEST_ID_HEADER];

    expect(id).toMatch(UUID);
    expect(id).not.toBe(FORWARDED);
  });
});
