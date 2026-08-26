import { createDatabase, loadEnv } from '@vendorhub/db';
import { parseEnv } from './config/env.js';
import { createS3Storage } from './lib/storage.js';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  // pnpm runs package scripts with the cwd set to the package directory, so
  // the repository-root `.env` the developer actually edits has to be loaded
  // explicitly. Real process variables still win over anything in the file.
  loadEnv();

  const env = parseEnv();
  const { db, client } = createDatabase();

  const app = await buildServer({ env, db, storage: createS3Storage(env) });

  /*
   * A deploy stops the old container by sending SIGTERM and waiting. Closing
   * Fastify first lets in-flight requests finish and stops new ones being
   * accepted, so a rollout drains instead of dropping responses; the database
   * pool is released afterwards, once nothing can still be querying it.
   */
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    // A platform that escalates SIGTERM to SIGKILL often sends the first signal
    // more than once; re-entering would close a closing server.
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down');

    try {
      await app.close();
      await client.end();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Shutdown did not complete cleanly');
      process.exit(1);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => void shutdown(signal));
  }

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  // The logger does not exist yet if boot failed, so this is the one raw write.
  process.stderr.write(`API failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
