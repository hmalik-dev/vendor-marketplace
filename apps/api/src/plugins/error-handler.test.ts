import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { errorHandlerPlugin } from './error-handler.js';

/**
 * The 4xx passthrough exists so a Fastify refusal — an oversized upload, an
 * unsupported media type — reaches the client with the status and the sentence
 * Fastify wrote for it.
 *
 * The danger is that several third-party SDKs also set a numeric `statusCode`,
 * and their messages are written for a developer reading a stack trace rather
 * than for a customer: `stripe-node` names the API key and its mode, Clerk names
 * the instance, the AWS SDK names the bucket. Those must not fall into the same
 * branch and be echoed back to a browser.
 */
describe('error handler 4xx passthrough', () => {
  let app: FastifyInstance | undefined;

  async function serve(thrown: unknown): Promise<FastifyInstance> {
    const instance = Fastify({ logger: false });
    await instance.register(errorHandlerPlugin);
    instance.get('/boom', async () => {
      throw thrown;
    });
    await instance.ready();

    app = instance;
    return instance;
  }

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("passes a Fastify error's own status and sentence through", async () => {
    const instance = await serve(
      Object.assign(new Error('Request file too large'), {
        statusCode: 413,
        code: 'FST_REQ_FILE_TOO_LARGE',
      }),
    );

    const response = await instance.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(413);
    expect(response.json().message).toBe('Request file too large');
  });

  it('keeps the status of an upstream 4xx but never its message', async () => {
    // Shaped exactly like a stripe-node error: numeric statusCode, no FST_ code.
    const instance = await serve(
      Object.assign(new Error('Invalid API Key provided: sk_test_***********abcd'), {
        statusCode: 401,
        type: 'StripeAuthenticationError',
      }),
    );

    const response = await instance.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe('Request failed');
    // The specific disclosure this closes: the key, its mode and its last four.
    expect(response.body).not.toContain('sk_test');
    expect(response.body).not.toContain('Invalid API Key');
  });

  it('still says "Resource not found" for an upstream 404', async () => {
    const instance = await serve(
      Object.assign(new Error('No such customer: cus_internal_id'), { statusCode: 404 }),
    );

    const response = await instance.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe('Resource not found');
    expect(response.body).not.toContain('cus_internal_id');
  });

  it('answers an error with no status at all with an opaque 500', async () => {
    const instance = await serve(new Error('connect ECONNREFUSED 10.0.0.4:5432'));

    const response = await instance.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json().message).toBe('Internal server error');
    expect(response.body).not.toContain('10.0.0.4');
  });
});
