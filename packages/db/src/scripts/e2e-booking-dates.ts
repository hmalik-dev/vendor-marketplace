import { randomInt } from 'node:crypto';
import { createDatabase } from '../client.js';
import { freshEventDate, shiftBookingIntoPast } from '../e2e-booking-dates.js';
import { loadEnv } from '../load-env.js';
import { E2E_VENDOR_SLUG } from '../seed-e2e.js';
import { assertSafeTarget } from './safe-target.js';

/**
 * The paid booking journey's date control, as a command the Playwright suite
 * shells out to — specs cannot import this package (CJS versus `import.meta`).
 *
 *   pnpm --filter @vendor-marketplace/db e2e:dates fresh-date
 *   pnpm --filter @vendor-marketplace/db e2e:dates shift-past <bookingId>
 *
 * Prints one JSON object on stdout and nothing else, so the caller can parse it.
 */
async function main(): Promise<void> {
  loadEnv();
  assertSafeTarget('e2e booking dates');

  const [command, bookingId] = process.argv.slice(2);
  const { db, client } = createDatabase({ max: 1 });

  try {
    if (command === 'fresh-date') {
      const eventDate = await freshEventDate(db, {
        vendorSlug: E2E_VENDOR_SLUG,
        now: new Date(),
        pick: (dates) => dates[randomInt(dates.length)]!,
      });
      process.stdout.write(`${JSON.stringify({ eventDate })}\n`);
      return;
    }

    if (command === 'shift-past' && bookingId) {
      const shifted = await shiftBookingIntoPast(db, { bookingId, now: new Date() });
      process.stdout.write(`${JSON.stringify(shifted)}\n`);
      return;
    }

    throw new Error('Usage: e2e:dates fresh-date | e2e:dates shift-past <bookingId>');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
