import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../testing/test-server.js';

const LIMIT = 3;

describe('rate limiting ahead of authentication', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ env: { RATE_LIMIT_MAX: LIMIT } });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('counts a flood of invalid bearer tokens and answers 429 past the limit', async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < LIMIT + 2; attempt += 1) {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/v1/users/me',
        headers: { authorization: 'Bearer garbage' },
      });
      statuses.push(response.statusCode);
    }

    expect(statuses).toEqual([401, 401, 401, 429, 429]);
  });
});

describe('rate limiting ahead of authentication, on a route with its own limit', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ env: { RATE_LIMIT_MAX: LIMIT } });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('counts bad tokens in the API-wide bucket and answers 429 past it', async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < LIMIT + 2; attempt += 1) {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/v1/tags/suggest',
        headers: { authorization: 'Bearer garbage' },
        payload: {},
      });
      statuses.push(response.statusCode);
    }

    expect(statuses).toEqual([401, 401, 401, 429, 429]);
  });
});
