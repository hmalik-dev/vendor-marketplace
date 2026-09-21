import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { loadEnv } from '../load-env.js';
import { MailCodeError, parseArgs, readMailCode } from './e2e-mail-code.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 *   pnpm e2e:mail-code <address> [--after <iso>]
 *
 * Prints the six-digit code and nothing else; a refusal is one plain line on
 * stderr with exit 1. The mailbox variables come from the environment (loaded
 * from `.env.e2e.local`), never from an argument.
 */
async function main(): Promise<void> {
  loadEnv();
  config({ path: path.join(REPO_ROOT, '.env.e2e.local'), quiet: true });

  process.stdout.write(`${await readMailCode(parseArgs(process.argv.slice(2)))}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof MailCodeError ? error.message : 'The mail code read failed.';
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
