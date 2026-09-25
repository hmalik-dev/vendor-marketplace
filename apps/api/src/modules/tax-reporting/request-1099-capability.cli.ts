import { createDatabase, createListener, loadEnv } from '@vendor-marketplace/db';
import { parseEnv } from '../../config/env.js';
import { createS3Storage } from '../../lib/storage.js';
import { buildServer } from '../../server.js';
import { requestTaxCapabilityForVendors } from './request-1099-capability.js';

/**
 * `pnpm --filter api tax:request-1099-capability` (VEN-723, D49): asks Stripe to
 * collect and IRS-verify the address and TIN of every vendor account made before
 * the capability was requested at creation. Safe to run again: accounts that
 * already carry it are reported as `already` and not touched.
 */
loadEnv();

const env = parseEnv();
const { db, client } = createDatabase();
const listener = createListener(env.DATABASE_URL);

/*
 * The real instance with every timer off, so the gateway is the one the live
 * API holds and this pass moves no money and sends no mail.
 */
const app = await buildServer({
  env,
  db,
  storage: createS3Storage(env),
  payoutSweepIntervalMs: 0,
  expirySweepIntervalMs: 0,
  authReconcileIntervalMs: 0,
  realtimeListen: listener.listen,
});

try {
  const result = await requestTaxCapabilityForVendors(db, app.stripe, (line) =>
    process.stdout.write(`${line}\n`),
  );

  if (result.failed > 0) {
    process.exitCode = 1;
  }
} finally {
  await app.close();
  await Promise.all([client.end(), listener.close()]);
}
