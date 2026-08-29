import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { laneDown, laneEnqueued, laneEnvFor, laneUp, parseLaneArgs } from './lane.js';

/**
 * Lane manifests live in the MAIN checkout so lanes can see each other's
 * claimed ports. `--git-common-dir` resolves to the main checkout's `.git`
 * from inside a worktree, where `--show-toplevel` would return the worktree.
 */
function mainCheckout(): string {
  const commonDir = execFileSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { encoding: 'utf8' },
  ).trim();

  return path.dirname(commonDir);
}

async function main(): Promise<void> {
  const parsed = parseLaneArgs(process.argv.slice(2));
  const worktree = process.cwd();

  if (parsed.kind === 'up') {
    const manifest = await laneUp(mainCheckout(), worktree, parsed.ticket);
    process.stdout.write(
      `✓ Lane ${manifest.ticket} up\n` +
        `  web    http://localhost:${manifest.webPort}\n` +
        `  api    http://localhost:${manifest.apiPort}\n` +
        `  db     ${manifest.database}\n\n` +
        `Run everything through: pnpm lane:exec ${manifest.ticket} -- <command>\n`,
    );
    return;
  }

  if (parsed.kind === 'pr') {
    const manifest = laneEnqueued(mainCheckout(), parsed.ticket, parsed.url);
    process.stdout.write(
      `✓ Lane ${manifest.ticket} enqueued\n` +
        `  branch ${manifest.branch}\n` +
        `  pr     ${manifest.prUrl ?? ''}\n\n` +
        `\`/land-lanes\` can resolve this lane now if the session ends first.\n`,
    );
    return;
  }

  if (parsed.kind === 'down') {
    await laneDown(mainCheckout(), worktree, parsed.ticket);
    process.stdout.write(`✓ Lane ${parsed.ticket} torn down\n`);
    return;
  }

  const [executable, ...args] = parsed.command;

  // parseLaneArgs guarantees a non-empty command; this narrows it for the
  // compiler, which cannot see that guarantee through the array index.
  if (!executable) {
    throw new Error('lane exec requires a command, for example `lane:exec 42 -- pnpm dev`.');
  }

  // stdio is inherited so a dev server streams rather than buffering until exit.
  const child = spawn(executable, args, {
    cwd: worktree,
    stdio: 'inherit' as const,
    env: laneEnvFor(worktree),
  });

  child.on('exit', (code: number | null) => {
    process.exit(code ?? 1);
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
