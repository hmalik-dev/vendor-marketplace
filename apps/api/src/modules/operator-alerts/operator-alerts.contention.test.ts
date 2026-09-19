import { users } from '@vendor-marketplace/db/schema';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EmailGateway, EmailMessage } from '../../lib/email.js';
import { createTestHarness, TEST_ENV, type TestHarness } from '../../testing/test-server.js';
import { alertNow, type OperatorAlertDeps } from './operator-alerts.service.js';
import { runOperatorDigest } from './operator-digest.service.js';

/** 08:00 in New York, so each day's digest is due. */
const FIRST_MORNING = new Date('2026-09-14T12:00:00Z');
const DAY = 24 * 60 * 60_000;
const DAYS = 8;

/**
 * VEN-405 acceptance 4 — the half PGlite cannot prove. Its one connection runs
 * each digest to completion before the next starts, so the second always finds
 * the first one's claim and the test would pass with the unique index deleted.
 * Here every API instance's run has its own pooled connection and they overlap.
 */
describe('operator alerts on two real connections', () => {
  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;

  /** One instance: its own mail gateway, the shared database. */
  function instance(now: Date): {
    deps: OperatorAlertDeps & { timeZone: string };
    sent: EmailMessage[];
  } {
    const sent: EmailMessage[] = [];
    const email: EmailGateway = {
      send: async (message) => {
        sent.push(message);
        return { providerMessageId: `resend-${message.idempotencyKey}` };
      },
    };

    return {
      sent,
      deps: {
        db: harness!.database.db,
        email,
        log: harness!.app.log,
        background: harness!.app.background,
        clock: () => now,
        to: TEST_ENV.OPERATOR_ALERT_EMAIL,
        webOrigin: TEST_ENV.WEB_URL,
        wait: async () => undefined,
        timeZone: 'America/New_York',
      },
    };
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 6 });
    harness = await createTestHarness({ database });

    // One sign-up inside each morning's window, so no day is empty.
    await harness.database.db.insert(users).values(
      Array.from({ length: DAYS }, (_, day) => ({
        authUserId: `user_contention_${day}`,
        email: `contention-${day}@example.com`,
        role: 'customer' as const,
        firstName: 'Casey',
        lastName: 'Rivera',
        createdAt: new Date(FIRST_MORNING.getTime() + day * DAY - 60 * 60_000),
      })),
    );
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  it('sends each morning digest once when two instances run it at the same moment', async () => {
    const sends: string[] = [];

    for (let day = 0; day < DAYS; day += 1) {
      const now = new Date(FIRST_MORNING.getTime() + day * DAY);
      const [left, right] = [instance(now), instance(now)];

      const results = await Promise.all([
        runOperatorDigest(left.deps, now),
        runOperatorDigest(right.deps, now),
      ]);

      expect(results.filter((result) => result === 'sent')).toHaveLength(1);
      expect(results.filter((result) => result === 'already-claimed')).toHaveLength(1);
      sends.push(...[...left.sent, ...right.sent].map((message) => message.subject));
    }

    expect(sends).toEqual(
      Array.from(
        { length: DAYS },
        (_, day) =>
          `[Orla ops] Daily digest for ${new Date(FIRST_MORNING.getTime() + day * DAY).toISOString().slice(0, 10)}`,
      ),
    );
  });

  it('sends one immediate alert when several instances raise it for the same subject at once', async () => {
    const now = new Date('2026-09-20T15:00:00Z');
    const instances = Array.from({ length: 4 }, () => instance(now));

    const results = await Promise.all(
      instances.map(({ deps }) =>
        alertNow(deps, {
          kind: 'dispute_opened',
          subjectId: 'case-contention',
          summary: 'Chargeback opened',
          details: ['Booking: booking-contention'],
          adminPath: '/admin/cases/case-contention',
        }),
      ),
    );

    expect(results.filter((result) => result === 'sent')).toHaveLength(1);
    expect(results.filter((result) => result === 'deduplicated')).toHaveLength(3);
    expect(instances.flatMap(({ sent }) => sent)).toHaveLength(1);
  });
});
