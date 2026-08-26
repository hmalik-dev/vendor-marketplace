import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderEnvExample, renderTurboJson } from '@vendorhub/shared/env';
import { REPO_ROOT } from './context.js';

/**
 * Rewrites the two files derived from the env registry. Both writes are
 * idempotent: running this twice changes nothing, which is what lets the drift
 * test in `packages/shared` compare committed text to generated text.
 */
function main(): void {
  const changed: string[] = [];

  const examplePath = path.join(REPO_ROOT, '.env.example');
  const example = renderEnvExample();

  if (readFileSync(examplePath, 'utf8') !== example) {
    writeFileSync(examplePath, example);
    changed.push('.env.example');
  }

  const turboPath = path.join(REPO_ROOT, 'turbo.json');
  const currentTurbo = readFileSync(turboPath, 'utf8');
  const turbo = renderTurboJson(currentTurbo);

  if (currentTurbo !== turbo) {
    writeFileSync(turboPath, turbo);
    changed.push('turbo.json');
  }

  process.stdout.write(
    changed.length === 0
      ? 'Already up to date: .env.example, turbo.json\n'
      : `Regenerated ${changed.join(', ')}\n`,
  );
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`env:example failed: ${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
}
