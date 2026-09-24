import { createDatabase } from '../client.js';
import { insertDisposableAdmin, removeDisposableAdmin } from '../e2e-admin.js';
import { loadEnv } from '../load-env.js';
import { assertSafeTarget } from './safe-target.js';

/**
 * The disposable admin's row, as a command the Playwright suite shells out
 * to — specs cannot import this package (CJS versus `import.meta`).
 *
 *   pnpm --filter @vendor-marketplace/db e2e:admin mint <authUserId> <email>
 *   pnpm --filter @vendor-marketplace/db e2e:admin remove <authUserId> <email>
 *
 * Prints one JSON object on stdout and nothing else, so the caller can parse it.
 */
async function main(): Promise<void> {
  loadEnv();
  assertSafeTarget('e2e disposable admin');

  const [command, authUserId, email] = process.argv.slice(2);

  if ((command !== 'mint' && command !== 'remove') || !authUserId || !email) {
    throw new Error('Usage: e2e:admin mint|remove <authUserId> <email>');
  }

  const { db, client } = createDatabase({ max: 1 });

  try {
    const result =
      command === 'mint'
        ? await insertDisposableAdmin(db, { authUserId, email })
        : { removed: await removeDisposableAdmin(db, { authUserId, email }) };
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
