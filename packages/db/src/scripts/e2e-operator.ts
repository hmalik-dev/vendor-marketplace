import { createDatabase } from '../client.js';
import { insertDisposableOperator, removeDisposableOperator } from '../e2e-operator.js';
import { loadEnv } from '../load-env.js';
import { assertSafeTarget } from './safe-target.js';

/**
 * The disposable operator's row, as a command the Playwright suite shells out
 * to — specs cannot import this package (CJS versus `import.meta`).
 *
 *   pnpm --filter @vendor-marketplace/db e2e:operator mint <authUserId> <email>
 *   pnpm --filter @vendor-marketplace/db e2e:operator remove <authUserId> <email>
 *
 * Prints one JSON object on stdout and nothing else, so the caller can parse it.
 */
async function main(): Promise<void> {
  loadEnv();
  assertSafeTarget('e2e disposable operator');

  const [command, authUserId, email] = process.argv.slice(2);

  if ((command !== 'mint' && command !== 'remove') || !authUserId || !email) {
    throw new Error('Usage: e2e:operator mint|remove <authUserId> <email>');
  }

  const { db, client } = createDatabase({ max: 1 });

  try {
    const result =
      command === 'mint'
        ? await insertDisposableOperator(db, { authUserId, email })
        : { removed: await removeDisposableOperator(db, { authUserId, email }) };
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
