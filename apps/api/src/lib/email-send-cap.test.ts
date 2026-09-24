import { emailSendDays } from '@vendor-marketplace/db/schema';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDatabase } from './database.js';
import {
  closeSendDay,
  ESSENTIAL_SEND_HEADROOM,
  EmailSendingClosedError,
  reopenCapClosedDay,
  reserveSend,
  sendDayClosedReason,
  withDailySendCap,
} from './email-send-cap.js';
import { EmailQuotaExceededError, type EmailGateway, type EmailMessage } from './email.js';

const MESSAGE: EmailMessage = {
  to: 'real@example.com',
  subject: 'A booking is confirmed',
  html: '<p>hi</p>',
  text: 'hi',
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
};

/** 23:59 UTC, so one minute later is the next budget day. */
const LATE = new Date('2026-09-23T23:59:00Z');

let database: TestDatabase;

describe('withDailySendCap (VEN-661)', () => {
  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
  });

  beforeEach(async () => {
    await database.db.delete(emailSendDays);
  });

  afterAll(async () => {
    await database.close();
  });

  function capped(
    cap: number,
    inner: EmailGateway['send'] = async () => ({ providerMessageId: 'x' }),
  ) {
    let now = LATE;
    const send = vi.fn(inner);
    const reporter = { capture: vi.fn() };
    const log = { error: vi.fn() };
    const gateway = withDailySendCap(
      { send },
      { db: database.db, cap, clock: () => now, reporter, log },
    );

    return {
      gateway,
      send,
      reporter,
      log,
      advance: (ms: number) => {
        now = new Date(now.getTime() + ms);
      },
    };
  }

  it('sends up to the cap, then refuses by name and pages once for the day', async () => {
    const { gateway, send, reporter, log } = capped(2);

    await gateway.send(MESSAGE);
    await gateway.send(MESSAGE);
    await expect(gateway.send(MESSAGE)).rejects.toThrow(
      'Email sending is closed for 2026-09-23: EMAIL_DAILY_SEND_CAP is reached',
    );
    await expect(gateway.send(MESSAGE)).rejects.toBeInstanceOf(EmailSendingClosedError);

    expect(send).toHaveBeenCalledTimes(2);
    expect(reporter.capture).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(
      { day: '2026-09-23', reason: 'cap', cap: 2 },
      'Email sending is closed for 2026-09-23: EMAIL_DAILY_SEND_CAP is reached',
    );
  });

  it('opens a fresh budget on the next UTC day, and pages again if that one closes too', async () => {
    const { gateway, send, reporter, advance } = capped(1);

    await gateway.send(MESSAGE);
    await expect(gateway.send(MESSAGE)).rejects.toBeInstanceOf(EmailSendingClosedError);
    advance(60_000);
    await gateway.send(MESSAGE);
    await expect(gateway.send(MESSAGE)).rejects.toBeInstanceOf(EmailSendingClosedError);

    expect(send).toHaveBeenCalledTimes(2);
    expect(reporter.capture).toHaveBeenCalledTimes(2);
  });

  it('treats a Resend quota refusal as closing the day: nothing else reaches Resend, and it pages once', async () => {
    const { gateway, send, reporter } = capped(50, async () => {
      throw new EmailQuotaExceededError('daily_quota_exceeded');
    });

    const first = await gateway.send(MESSAGE).catch((error: unknown) => error);
    await expect(gateway.send(MESSAGE)).rejects.toThrow(
      'Email sending is closed for 2026-09-23: the Resend quota is spent',
    );

    expect(first).toBeInstanceOf(EmailSendingClosedError);
    expect((first as EmailSendingClosedError).reason).toBe('quota');
    expect(send).toHaveBeenCalledTimes(1);
    expect(reporter.capture).toHaveBeenCalledTimes(1);
    expect(await sendDayClosedReason(database.db, '2026-09-23')).toBe('quota');
  });

  it('keeps the day open on any other failure, which the retry sweep may still recover', async () => {
    const { gateway, send, reporter } = capped(50, async () => {
      throw new Error('Resend refused the send (500)');
    });

    await expect(gateway.send(MESSAGE)).rejects.toThrow('Resend refused the send (500)');
    await expect(gateway.send(MESSAGE)).rejects.toThrow('Resend refused the send (500)');

    expect(send).toHaveBeenCalledTimes(2);
    expect(reporter.capture).not.toHaveBeenCalled();
    expect(await sendDayClosedReason(database.db, '2026-09-23')).toBeNull();
  });

  it('lets essential mail spend the headroom past a closed cap, and no further', async () => {
    const { gateway, send } = capped(1);
    const essential = { ...MESSAGE, essential: true };

    await gateway.send(MESSAGE);
    await expect(gateway.send(MESSAGE)).rejects.toBeInstanceOf(EmailSendingClosedError);
    for (let i = 0; i < ESSENTIAL_SEND_HEADROOM; i += 1) {
      await gateway.send(essential);
    }
    await expect(gateway.send(essential)).rejects.toBeInstanceOf(EmailSendingClosedError);

    expect(send).toHaveBeenCalledTimes(1 + ESSENTIAL_SEND_HEADROOM);
    expect(ESSENTIAL_SEND_HEADROOM).toBe(15);
  });

  it('refuses essential mail too once Resend says the quota is spent', async () => {
    let quotaSpent = false;
    const { gateway, send } = capped(50, async () => {
      if (quotaSpent) {
        return { providerMessageId: 'x' };
      }
      quotaSpent = true;
      throw new EmailQuotaExceededError('daily_quota_exceeded');
    });

    await expect(gateway.send(MESSAGE)).rejects.toBeInstanceOf(EmailSendingClosedError);
    await expect(gateway.send({ ...MESSAGE, essential: true })).rejects.toThrow(
      'the Resend quota is spent',
    );

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends essential mail uncounted when the database cannot reserve, and nothing else', async () => {
    const brokenDb = {
      insert: () => {
        throw new Error('connection refused');
      },
    } as unknown as AppDatabase;
    const send = vi.fn(async () => ({ providerMessageId: 'x' }));
    const log = { error: vi.fn() };
    const gateway = withDailySendCap(
      { send },
      { db: brokenDb, cap: 5, clock: () => LATE, reporter: { capture: vi.fn() }, log },
    );

    await expect(gateway.send(MESSAGE)).rejects.toThrow('connection refused');
    await expect(gateway.send({ ...MESSAGE, essential: true })).resolves.toEqual({
      providerMessageId: 'x',
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it('reopens a cap-closed day for a raised cap, and never a quota-closed one', async () => {
    const { gateway } = capped(1);
    await gateway.send(MESSAGE);
    await expect(gateway.send(MESSAGE)).rejects.toBeInstanceOf(EmailSendingClosedError);

    expect(await reopenCapClosedDay(database.db, '2026-09-23', 1)).toBe(false);
    expect(await reopenCapClosedDay(database.db, '2026-09-23', 5)).toBe(true);
    expect(await sendDayClosedReason(database.db, '2026-09-23')).toBeNull();

    const raised = capped(5);
    await raised.gateway.send(MESSAGE);
    expect(raised.send).toHaveBeenCalledTimes(1);

    await database.db.delete(emailSendDays);
    const quota = capped(5, async () => {
      throw new EmailQuotaExceededError('daily_quota_exceeded');
    });
    await expect(quota.gateway.send(MESSAGE)).rejects.toBeInstanceOf(EmailSendingClosedError);
    expect(await reopenCapClosedDay(database.db, '2026-09-23', 500)).toBe(false);
  });

  it('keeps a raised cap open through a rolling deploy: the old instance cannot re-close the day (VEN-688)', async () => {
    const oldCap = capped(2);
    const newCap = capped(5);

    await oldCap.gateway.send(MESSAGE);
    await oldCap.gateway.send(MESSAGE);
    await expect(oldCap.gateway.send(MESSAGE)).rejects.toBeInstanceOf(EmailSendingClosedError);
    expect(await sendDayClosedReason(database.db, '2026-09-23')).toBe('cap');

    // The new container boots and reopens the day; the old one is still serving.
    expect(await reopenCapClosedDay(database.db, '2026-09-23', 5)).toBe(true);

    await oldCap.gateway.send(MESSAGE);
    await newCap.gateway.send(MESSAGE);

    expect(oldCap.send).toHaveBeenCalledTimes(3);
    expect(newCap.send).toHaveBeenCalledTimes(1);
    expect(await sendDayClosedReason(database.db, '2026-09-23')).toBeNull();
    // 2 + 1 + 1 = 4 of 5; the fifth is the last either instance may take.
    await oldCap.gateway.send(MESSAGE);
    await expect(newCap.gateway.send(MESSAGE)).rejects.toBeInstanceOf(EmailSendingClosedError);
    // One page each for the two closures the budget really reached, none for a re-closure.
    expect(oldCap.reporter.capture).toHaveBeenCalledTimes(1);
    expect(newCap.reporter.capture).toHaveBeenCalledTimes(1);
  });

  it('records the raised cap before the day has closed, so a still-serving old instance cannot close it', async () => {
    const oldCap = capped(2);
    await oldCap.gateway.send(MESSAGE);

    await reopenCapClosedDay(database.db, '2026-09-23', 5);

    await oldCap.gateway.send(MESSAGE);
    await oldCap.gateway.send(MESSAGE);
    expect(await sendDayClosedReason(database.db, '2026-09-23')).toBeNull();
  });

  it('refuses to close a day the raised cap has given room, even after the reservation was refused (VEN-688)', async () => {
    const day = '2026-09-23';
    await reserveSend(database.db, day, 2);
    await reserveSend(database.db, day, 2);
    // The old instance's third reservation is refused; the redeploy lands before it closes the day.
    expect(await reserveSend(database.db, day, 2)).toBe(false);
    expect(await reopenCapClosedDay(database.db, day, 5)).toBe(false);

    expect(await closeSendDay(database.db, day, 'cap', LATE, 2)).toBe(false);
    expect(await sendDayClosedReason(database.db, day)).toBeNull();
    expect(await reserveSend(database.db, day, 5)).toBe(true);

    // At its own cap the day still closes, and only once.
    await reserveSend(database.db, day, 5);
    await reserveSend(database.db, day, 5);
    expect(await reserveSend(database.db, day, 5)).toBe(false);
    expect(await closeSendDay(database.db, day, 'cap', LATE, 5)).toBe(true);
    expect(await closeSendDay(database.db, day, 'cap', LATE, 5)).toBe(false);
  });
});
