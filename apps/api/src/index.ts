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

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await client.end();
    process.exit(0);
  };

  process.on('SIGINT', (signal) => void shutdown(signal));
  process.on('SIGTERM', (signal) => void shutdown(signal));

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  // The logger does not exist yet if boot failed, so this is the one raw write.
  process.stderr.write(`API failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
