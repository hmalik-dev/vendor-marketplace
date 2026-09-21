import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { findDestructiveMigrations, MIGRATION_BASELINE } from './check.js';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const found = findDestructiveMigrations(path.join(root, 'packages/db/drizzle'));

if (found.length === 0) {
  process.stdout.write(`No destructive migration after ${String(MIGRATION_BASELINE)}.\n`);
} else {
  for (const { file, statements } of found) {
    process.stderr.write(
      `${file}: ${statements.join(', ')}. The release still serving runs against this migration; ` +
        'add `-- allow-destructive: <reason>` if it is safe, or split it across two releases.\n',
    );
  }
  process.exitCode = 1;
}
