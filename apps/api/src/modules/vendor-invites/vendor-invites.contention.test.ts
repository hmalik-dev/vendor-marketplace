import { categories, vendorApplications } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import type { EmailGateway, EmailMessage } from '../../lib/email.js';
import { createBackgroundWork } from '../../lib/background.js';
import { submitVendorApplication, type VendorInviteMailDeps } from './vendor-invites.service.js';

/**
 * VEN-516: two submits for the same address, racing, claim the one-time
 * waitlist confirmation exactly once.
 *
 * On the driver production uses. PGlite runs one transaction to completion
 * before the next begins, so two `Promise.all`'d submits never overlap there —
 * `claimApplicationConfirmationAttempt`'s compare-and-swap would pass a green
 * suite with it deleted, back to reading `confirmation_email_attempts` before
 * writing it. The sender is slow on purpose, to hold each submit's background
 * send open long enough that both are guaranteed to be in flight together.
 */
describe('the vendor waitlist confirmation, under real contention', () => {
  const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
  const SEND_DELAY_MS = 200;

  let database: PostgresTestDatabase;
  let sent: EmailMessage[];

  const log = {
    error: () => undefined,
    info: () => undefined,
    warn: () => undefined,
  } as unknown as VendorInviteMailDeps['log'];

  const slowEmail: EmailGateway = {
    send: async (message) => {
      await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
      sent.push(message);
      return { providerMessageId: `resend-${message.idempotencyKey}` };
    },
  };

  function deps(): VendorInviteMailDeps {
    return {
      db: database.db,
      email: slowEmail,
      log,
      webOrigin: 'https://web.test',
      background: createBackgroundWork(log),
      now: () => new Date(),
    };
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase();

    await database.db
      .insert(categories)
      .values({ id: CATEGORY_ID, name: 'Florist', slug: 'florist' });
  });

  afterEach(async () => {
    sent = [];
    await database.db.delete(vendorApplications);
  });

  afterAll(async () => {
    await database.db.delete(categories);
    await database.close();
  });

  it('sends the confirmation once when two submits for the same address race', async () => {
    sent = [];
    const body = {
      email: 'racer@example.com',
      businessName: 'Racer Florals',
      category: CATEGORY_ID,
      city: 'Austin',
    };

    const [depsA, depsB] = [deps(), deps()];
    await Promise.all([
      submitVendorApplication(depsA, body, 'racer@example.com'),
      submitVendorApplication(depsB, body, 'racer@example.com'),
    ]);
    await Promise.all([depsA.background.drain(), depsB.background.drain()]);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.idempotencyKey).toMatch(/^vendor-application-confirmation-/);
    const [row] = await database.db.select().from(vendorApplications);
    expect(row).toMatchObject({ confirmationEmailAttempts: 1 });
    expect(row?.confirmationEmailSentAt).toBeInstanceOf(Date);
  });
});
