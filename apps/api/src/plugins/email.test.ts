import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANE_MAILBOX_PATH, emailPlugin } from './email.js';

/**
 * The route suites always inject a fake gateway, so the plugin's own branch —
 * the one `server.ts` reaches in a real deployment — is only exercised here.
 */
describe('emailPlugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  describe('the lane mailbox (VEN-553)', () => {
    async function laneApp(deployEnv: string) {
      const app = Fastify({ logger: false });
      await app.register(emailPlugin, {
        apiKey: 'key',
        from: 'a@b.test',
        deployEnv,
        gateway: { send: async () => ({ providerMessageId: null }) },
      });
      await app.ready();
      return app;
    }

    const message = (to: string, text: string) => ({
      to,
      subject: 's',
      html: 'h',
      text,
      idempotencyKey: 'k',
    });

    it('serves the newest message on local, optionally for one recipient', async () => {
      const app = await laneApp('local');
      await app.email.send(message('op@example.com', 'code 123456'));
      await app.email.send(message('other@example.com', 'code 654321'));

      const latest = await app.inject({ method: 'GET', url: LANE_MAILBOX_PATH });
      expect(latest.json()).toEqual({ to: 'other@example.com', subject: 's', text: 'code 654321' });

      const mine = await app.inject({
        method: 'GET',
        url: `${LANE_MAILBOX_PATH}?to=op@example.com`,
      });
      expect(mine.json()).toMatchObject({ text: 'code 123456' });
    });

    it('answers 404 on local before anything is sent', async () => {
      const app = await laneApp('local');
      const response = await app.inject({ method: 'GET', url: LANE_MAILBOX_PATH });
      expect(response.statusCode).toBe(404);
    });

    it('is absent when DEPLOY_ENV is local on a process that is a deployed runtime', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const app = await laneApp('local');
      await app.email.send(message('op@example.com', 'code 123456'));

      const response = await app.inject({ method: 'GET', url: LANE_MAILBOX_PATH });
      expect(response.statusCode).toBe(404);
      expect(app.hasRoute({ method: 'GET', url: LANE_MAILBOX_PATH })).toBe(false);
    });

    it.each(['staging', 'production'])('is absent when DEPLOY_ENV is %s', async (deployEnv) => {
      const app = await laneApp(deployEnv);
      await app.email.send(message('op@example.com', 'code 123456'));

      const response = await app.inject({ method: 'GET', url: LANE_MAILBOX_PATH });
      expect(response.statusCode).toBe(404);
      expect(response.json()).not.toHaveProperty('text');
      expect(app.hasRoute({ method: 'GET', url: LANE_MAILBOX_PATH })).toBe(false);
    });
  });
});
