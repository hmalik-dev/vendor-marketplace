import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');

/**
 * Loads environment variables from the repository-root `.env`, then from a
 * package-local `.env` if one exists.
 *
 * `import 'dotenv/config'` resolves against `process.cwd()`, and pnpm runs
 * package scripts with the cwd set to the package directory — so the root
 * `.env` that `.env.example` documents would otherwise never be read. Real
 * process environment variables always win; `dotenv` never overwrites them.
 */
export function loadEnv(): void {
  for (const candidate of [path.join(REPO_ROOT, '.env'), path.join(PACKAGE_ROOT, '.env')]) {
    if (existsSync(candidate)) {
      config({ path: candidate, quiet: true });
    }
  }
}
