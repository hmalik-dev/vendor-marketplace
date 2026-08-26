import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';

describe('GET /health', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('reports the process as live', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
    expect(typeof response.json().timestamp).toBe('string');
  });

  it('needs no authentication', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
  });

  it('answers an unknown route with the structured error shape', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ statusCode: 404, error: 'NOT_FOUND' });
  });
});

describe('GET /ready', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('reports both dependencies up and needs no authentication', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ready',
      database: 'up',
      storage: 'up',
    });
    expect(typeof response.json().timestamp).toBe('string');
  });

  it('answers 503 naming storage when the bucket is unreachable', async () => {
    harness.setStorageAvailable(false);

    try {
      const response = await harness.app.inject({ method: 'GET', url: '/ready' });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        status: 'not_ready',
        database: 'up',
        storage: 'down',
      });
    } finally {
      harness.setStorageAvailable(true);
    }
  });
});

/*
 * Liveness must not depend on the database: a probe that fails while the
 * process is healthy gets the container restarted, which cannot fix a database
 * outage and drops every in-flight request on the way.
 */
describe('probes with the database stopped', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.database.close();
  });

  afterAll(async () => {
    await harness.app.close();
  });

  it('still reports the process live on /health', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('answers 503 naming the database on /ready', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'not_ready', database: 'down' });
  });
});
