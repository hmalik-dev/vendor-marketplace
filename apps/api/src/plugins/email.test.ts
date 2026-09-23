import { emailSendDays } from '@vendor-marketplace/db/schema';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { silentErrorReporter } from '../lib/error-reporting.js';
import { clockPlugin } from './clock.js';
import { databasePlugin } from './database.js';
import { LANE_MAILBOX_PATH, emailPlugin } from './email.js';

let database: TestDatabase;

/** A bare instance with the two plugins the email plugin depends on. */
async function baseApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(clockPlugin, {});
  await app.register(databasePlugin, { db: database.db });
  return app;
}

/**
 * The route suites always inject a fake gateway, so the plugin's own branch —
 * the one `server.ts` reaches in a real deployment — is only exercised here.
 */
describe('emailPlugin', () => {
  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
  });

  afterAll(async () => {
    await database.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function sentTo(
    deployEnv: string,
    sinkAddress?: string,
    dailyCap?: number,
  ): Promise<unknown> {
    let to: unknown;
    vi.stubGlobal('fetch', async (_url: unknown, init?: RequestInit) => {
      to = (JSON.parse(init?.body as string) as { to: unknown }).to;
      return new Response('{"id":"x"}', { status: 200 });
    });
    const app = await baseApp();
    await app.register(emailPlugin, {
      apiKey: 'key',
      from: 'a@b.test',
      deployEnv,
      sinkAddress,
      dailyCap,
      reporter: silentErrorReporter,
    });
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
    await expect(sentTo('staging', 'sink@orla.test', 5)).resolves.toBe('sink@orla.test');
    await expect(sentTo('production', 'sink@orla.test')).resolves.toBe('real@example.com');
  });

  it('spends no Resend quota on staging unless EMAIL_DAILY_SEND_CAP is set (VEN-661)', async () => {
    await expect(sentTo('staging', 'sink@orla.test')).resolves.toBeUndefined();
  });

  it('reopens, on boot, a day a lower cap closed, since raising the cap is a redeploy (VEN-661)', async () => {
    await database.db.delete(emailSendDays);
    const today = new Date().toISOString().slice(0, 10);
    await database.db
      .insert(emailSendDays)
      .values({ day: today, sent: 3, closedReason: 'cap', closedAt: new Date() });

    await sentTo('production', undefined, 10);

    const rows = await database.db
      .select({ sent: emailSendDays.sent, closedReason: emailSendDays.closedReason })
      .from(emailSendDays);
    expect(rows).toEqual([{ sent: 4, closedReason: null }]);
  });

  it("counts production's sends against the day's budget (VEN-661)", async () => {
    await database.db.delete(emailSendDays);

    await sentTo('production');

    const rows = await database.db.select({ sent: emailSendDays.sent }).from(emailSendDays);
    expect(rows).toEqual([{ sent: 1 }]);
  });

  describe('the lane mailbox (VEN-553)', () => {
    async function laneApp(deployEnv: string) {
      const app = await baseApp();
      await app.register(emailPlugin, {
        apiKey: 'key',
        from: 'a@b.test',
        deployEnv,
        reporter: silentErrorReporter,
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
