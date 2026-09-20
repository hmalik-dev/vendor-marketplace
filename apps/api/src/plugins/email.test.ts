import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emailPlugin } from './email.js';

/**
 * The route suites always inject a fake gateway, so the plugin's own branch —
 * the one `server.ts` reaches in a real deployment — is only exercised here.
 */
describe('emailPlugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function sentTo(deployEnv: string, sinkAddress?: string): Promise<unknown> {
    let to: unknown;
    vi.stubGlobal('fetch', async (_url: unknown, init?: RequestInit) => {
      to = (JSON.parse(init?.body as string) as { to: unknown }).to;
      return new Response('{"id":"x"}', { status: 200 });
    });
    const app = Fastify({ logger: false });
    await app.register(emailPlugin, { apiKey: 'key', from: 'a@b.test', deployEnv, sinkAddress });
    await app.email.send({
      to: 'real@example.com',
      subject: 's',
      html: 'h',
      text: 't',
      idempotencyKey: 'k',
    });
    return to;
  }

  it('sinks mail on staging and passes it through on production', async () => {
    await expect(sentTo('staging', 'sink@orla.test')).resolves.toBe('sink@orla.test');
    await expect(sentTo('production', 'sink@orla.test')).resolves.toBe('real@example.com');
  });
});
