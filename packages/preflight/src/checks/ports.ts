import { runCommand } from '../exec.js';
import { type Check, type CheckResult, fail, pass } from '../types.js';

export interface DevPort {
  readonly port: number;
  readonly service: string;
}

/**
 * A port a lane may have moved, falling back to the shared dev port.
 *
 * A lane's env supplies these as strings, and an unparseable one must not
 * become `NaN` in an `lsof` argument — that inspects nothing and reports the
 * port free, which is the same false pass this check exists to prevent.
 */
function portFrom(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

/**
 * Ports the dev servers bind, and what runs there.
 *
 * `pnpm lane:exec <n>` puts the lane's own `PORT` and `WEB_PORT` in the child
 * environment, so a lane must be gated on the ports it will actually bind.
 * Checking 3000/4000 there passes while the lane's real ports are held, and the
 * holder surfaces as `EADDRINUSE` mid-ticket instead.
 *
 * The two ports resolve from different places, which is not an oversight:
 *
 * - `apps/api` calls `loadEnv()` before reading `PORT` (`apps/api/src/index.ts`),
 *   so the repository-root `.env` moves the API port as surely as a lane does.
 *   That is `env` — the merged view, real variables already winning.
 * - `apps/web`'s dev script is `next dev ${WEB_PORT:+--port $WEB_PORT}`, a shell
 *   expansion that only ever sees a real environment variable. A `WEB_PORT` in
 *   `.env` moves nothing, so gating on one would report a port the web app will
 *   never bind.
 */
export function devPorts(
  env: NodeJS.ProcessEnv,
  processEnv: NodeJS.ProcessEnv,
): readonly DevPort[] {
  return [
    { port: portFrom(processEnv.WEB_PORT, 3000), service: 'apps/web' },
    { port: portFrom(env.PORT, 4000), service: 'apps/api' },
  ];
}

/** Process names that are this repository's own dev servers rather than a foreign holder. */
const OURS = /^(node|next-server|next|tsx|com\.docke)/;

export interface PortHolder {
  readonly command: string;
  readonly pid: string;
}

/** Parses `lsof -nP -iTCP:<port> -sTCP:LISTEN -F cp` output into its holders. */
export function parseHolders(output: string): PortHolder[] {
  const holders: PortHolder[] = [];
  let pid = '';

  for (const line of output.split('\n')) {
    if (line.startsWith('p')) {
      pid = line.slice(1);
    } else if (line.startsWith('c') && pid) {
      holders.push({ command: line.slice(1), pid });
    }
  }

  return holders;
}

export async function evaluatePort(port: number, service: string): Promise<CheckResult> {
  const name = `Port ${port} is available for ${service}`;
  const outcome = await runCommand('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-F', 'cp']);

  if (outcome.status === 'missing') {
    return pass('core', name, 'lsof is unavailable, so the port was not inspected');
  }

  // lsof exits non-zero with no output when nothing is listening.
  const holders = parseHolders(outcome.stdout);

  if (holders.length === 0) {
    return pass('core', name, 'free');
  }

  const foreign = holders.filter((holder) => !OURS.test(holder.command));

  if (foreign.length > 0) {
    const described = foreign.map((holder) => `${holder.command} (pid ${holder.pid})`).join(', ');

    return fail(
      'core',
      name,
      `held by ${described}`,
      `kill ${foreign.map((holder) => holder.pid).join(' ')}`,
    );
  }

  const described = holders.map((holder) => `${holder.command} (pid ${holder.pid})`).join(', ');

  return pass('core', name, `held by this project's dev server: ${described}`);
}

export const portsCheck: Check = {
  id: 10,
  title: 'Ports',
  async run(context) {
    if (context.target === 'production') {
      return [];
    }

    return Promise.all(
      devPorts(context.env, process.env).map(({ port, service }) => evaluatePort(port, service)),
    );
  },
};
