import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface CommandOutcome {
  /** `missing` when the executable is not on PATH, distinct from a non-zero exit. */
  readonly status: 'ok' | 'failed' | 'missing';
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs a command without a shell and never throws. The `missing` status matters:
 * "Docker is not installed" and "Docker is installed but not running" need
 * different fixes, and collapsing them into one failure sends the operator down
 * the wrong path.
 */
export async function runCommand(
  command: string,
  args: readonly string[],
  timeoutMs = 10_000,
  env?: NodeJS.ProcessEnv,
): Promise<CommandOutcome> {
  try {
    const { stdout, stderr } = await run(command, [...args], {
      timeout: timeoutMs,
      ...(env ? { env } : {}),
    });
    return { status: 'ok', stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error: unknown) {
    const shaped = error as { code?: string | number; stdout?: string; stderr?: string };
    const status = shaped.code === 'ENOENT' ? 'missing' : 'failed';

    return {
      status,
      stdout: (shaped.stdout ?? '').trim(),
      stderr: (shaped.stderr ?? '').trim(),
    };
  }
}

/** Whether an executable resolves on `PATH`. */
export async function isInstalled(command: string): Promise<boolean> {
  return (await runCommand('which', [command])).status === 'ok';
}
