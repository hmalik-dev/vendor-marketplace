import { emailSendDays } from '@vendor-marketplace/db/schema';
import { createPostgresTestDatabase } from '@vendor-marketplace/db/testing/postgres';
import { describe, expect, it } from 'vitest';
import { closeSendDay, reserveSend } from './email-send-cap.js';

/*
 * VEN-661: the half PGlite cannot prove. Its one connection runs each upsert to
 * completion before the next starts, so the cap would hold there with the
 * `setWhere` deleted. Here every reservation has its own pooled connection, as
 * two API instances sending at once would.
 */
describe('the daily send cap on real connections', () => {
  it('grants exactly the cap, however many sends race for the last slots', async () => {
    const database = await createPostgresTestDatabase({ poolSize: 8 });

    try {
      const granted = await Promise.all(
        Array.from({ length: 24 }, () => reserveSend(database.db, '2026-09-23', 5)),
      );

      expect(granted.filter(Boolean)).toHaveLength(5);
      expect(await database.db.select({ sent: emailSendDays.sent }).from(emailSendDays)).toEqual([
        { sent: 5 },
      ]);
    } finally {
      await database.close();
    }
  });

  it('lets exactly one of many racing refusals close the day, so Sentry is paged once', async () => {
    const database = await createPostgresTestDatabase({ poolSize: 8 });

    try {
      const now = new Date('2026-09-23T12:00:00Z');
      const closed = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          closeSendDay(database.db, '2026-09-23', i % 2 === 0 ? 'cap' : 'quota', now),
        ),
      );

      expect(closed.filter(Boolean)).toHaveLength(1);
    } finally {
      await database.close();
    }
  });
});
